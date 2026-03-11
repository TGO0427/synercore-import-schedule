/**
 * Bill of Lading PDF Parser
 * Extracts structured data from BOL PDFs using text extraction and pattern matching.
 * Then cross-references against existing shipments to auto-flag discrepancies.
 */

import { queryAll } from '../db/connection.js';
import { logInfo, logWarn } from '../utils/logger.js';

export interface ParsedBolData {
  bol_number: string | null;
  supplier_name: string | null;
  carrier_name: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  consignee: string | null;
  shipper: string | null;
  notify_party: string | null;
  description_of_goods: string | null;
  container_numbers: string[];
  gross_weight_kg: number | null;
  volume_cbm: number | null;
  number_of_packages: number | null;
  freight_charges_usd: number | null;
  declared_value_usd: number | null;
  issue_date: string | null;
  ship_on_board_date: string | null;
  payment_terms: string | null;
  incoterm: string | null;
  raw_text: string;
  confidence: Record<string, number>;
}

export interface AuditFinding {
  field: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  bol_value: string | null;
  shipment_value: string | null;
}

export interface CostProtection {
  benchmark_rate_per_kg: number | null;
  expected_freight_usd: number | null;
  freight_variance_usd: number | null;
  weight_variance_kg: number | null;
  weight_variance_pct: number | null;
  is_duplicate: boolean;
}

export interface BolParseResult {
  extracted: ParsedBolData;
  matched_shipment: any | null;
  auto_audit: {
    status: 'pending' | 'discrepancy' | 'approved';
    findings: AuditFinding[];
    score: number;
  };
}

// ─── Validation helpers ───

// Words that are common false positives when extracted as field values
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'no', 'not',
  'is', 'are', 'was', 'be', 'as', 'if', 'his', 'her', 'see', 'agent', 'clause',
  'booking', 'ref', 'reference', 'number', 'date', 'port', 'name', 'above',
  'below', 'said', 'other', 'such', 'any', 'all', 'this', 'that', 'from',
  'with', 'shall', 'will', 'may', 'must', 'have', 'has', 'been', 'being',
]);

/** Reject values that are just stop words, too short, or look like clause fragments */
function isValidExtraction(value: string | null, minLength = 3): boolean {
  if (!value) return false;
  const cleaned = value.trim();
  if (cleaned.length < minLength) return false;
  // Reject if it's just a stop word
  if (STOP_WORDS.has(cleaned.toLowerCase())) return false;
  // Reject if it starts with a lowercase conjunction/preposition (clause fragment)
  if (/^(or|and|to|for|of|in|on|at|by|his|her|see|the|if)\s/i.test(cleaned)) return false;
  // Reject if it looks like a sentence fragment (too many common English words)
  const words = cleaned.split(/\s+/);
  const stopCount = words.filter(w => STOP_WORDS.has(w.toLowerCase())).length;
  if (words.length >= 3 && stopCount / words.length > 0.5) return false;
  return true;
}

/** Clean up trailing noise from an extracted value */
function cleanExtraction(value: string | null): string | null {
  if (!value) return null;
  let cleaned = value.trim();
  // Remove trailing colons, periods, commas
  cleaned = cleaned.replace(/[:\.,;]+$/, '').trim();
  // Remove trailing stop words that got accidentally captured
  const words = cleaned.split(/\s+/);
  while (words.length > 1 && STOP_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  cleaned = words.join(' ');
  return cleaned.length >= 2 ? cleaned : null;
}

// ─── Pattern definitions ───

const BOL_NUMBER_PATTERNS = [
  /B\/?L\s*(?:No\.?|Number|#|:)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:Bill\s+of\s+Lading|BOL)\s*(?:No\.?|Number|#|:)\s*[~:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  // MSC BOL format: MEDU... number after "BILL OF LADING No."
  /BILL\s+OF\s+LADING\s+No\.?\s*[~:\s]*(MEDU[A-Z0-9]{4,20})/i,
  /(?:Document\s*No\.?|Doc\s*#)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:MBOL|HBOL|MBL|HBL)\s*[:\s#]*([A-Z0-9][\w\-\/]{4,30})/i,
  // MSC-style BOL numbers standalone (e.g., MEDUHW533143, MEDUWA201799)
  /\b(MEDU[A-Z]{1,3}\d{5,10})\b/,
];

// Vessel: require explicit label, capture name with 3+ chars, must look like a proper name
const VESSEL_PATTERNS = [
  // MSC BOL: "VESSEL AND VOYAGE NO" on one line, then "MSC TARANTO - GA601W" on next
  /VESSEL\s+AND\s+VOYAGE\s+NO[^\n]*\n([A-Z][A-Za-z0-9\s]{2,30}?)\s*[\-–]\s*[A-Z0-9]/i,
  /(?:Vessel\s*(?:Name)?|Motor\s*Vessel|M\/V|Ocean\s*Vessel)\s*[:\s]+([A-Z][A-Za-z0-9\s\-\.]{2,40}?)(?:\s*(?:Voyage|Voy|V\/|$|\n))/i,
  /(?:Vessel\s*(?:Name)?|Motor\s*Vessel|M\/V)\s*[:\s]+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-\.]{1,38})/i,
];

// Voyage: require explicit "Voyage" or "Voy" label (NOT just "V." which is too ambiguous)
// Voyage numbers typically have digits: e.g., 2401E, 025W, V.123, GA601W
const VOYAGE_PATTERNS = [
  // MSC BOL: vessel and voyage on same line "MSC TARANTO - GA601W"
  /VESSEL\s+AND\s+VOYAGE\s+NO[^\n]*\n[A-Za-z0-9\s]+[\-–]\s*([A-Z0-9]{3,15})/i,
  /(?:Voyage|Voy\.?)\s*(?:No\.?|#)?\s*[:\s]*([A-Z0-9][\w\-]{2,20})/i,
];

// Ports: require the full label, capture only proper location names (not clause text)
// Port names: typically capitalized words, city/country names, 4+ chars
const PORT_LOADING_PATTERNS = [
  // MSC BOL OCR: vessel line has POL inline "MSC TARANTO - GA601W DALIAN.CHLNG XXXX"
  // Match text between voyage number and XXXX placeholder
  /[A-Z0-9]{3,10}W?\s+([A-Z][A-Za-z\.,\s]{3,30}?)\s+X{4,}/i,
  // MSC BOL: "PORT OF LOADING" header line, then actual port on next line
  /PORT\s+OF\s+LOADING[^\n]*\n[^\n]*?[A-Z0-9]+W?\s+([A-Z][A-Za-z\.,\s]{3,30}?)\s+X{4,}/im,
  /(?:Port\s+of\s+Loading)\s*[:\s]+([A-Z][A-Za-z\s,]{3,45}?)(?:\s*(?:Port\s+of|Vessel|Voyage|Carrier|Place|$|\n))/i,
  /(?:Port\s+of\s+Loading)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Loading\s+Port)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
];

const PORT_DISCHARGE_PATTERNS = [
  // MSC BOL OCR: booking ref line "177DPPPED60245 Cape Town, South Africa OOOO XXXX"
  /[A-Z0-9]{8,}\s+(.+?)\s+[OX]{4}/i,
  /(?:Port\s+of\s+Discharge)\s*[:\s]+([A-Z][A-Za-z\s,]{3,45}?)(?:\s*(?:Port\s+of|Vessel|Notify|Consignee|Place|$|\n))/i,
  /(?:Port\s+of\s+Discharge)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Place\s+of\s+Delivery|Final\s+Destination)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Discharge\s+Port)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
];

const CONSIGNEE_PATTERNS = [
  // MSC BOL: "CONSIGNEE:" followed by boilerplate, then company name on next line
  // Stop at LTD/PTY boundary (OCR may misread PTY as "flap)" etc.)
  /CONSIGNEE[:\s][^\n]*\n([A-Z][^\n]*?\b(?:PTY|LTD|INC|CORP|LLC)\b[^\n]{0,10}?\bLTD\b)/i,
  /CONSIGNEE[:\s][^\n]*\n([A-Z][^\n]*?\bLTD\b)/i,
  // Company name line after CONSIGNEE with address on next line
  /CONSIGNEE[:\s][^\n]*\n([A-Z][^\n]{4,80})\n/i,
  /(?:Consignee|Consigned\s+to)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const SHIPPER_PATTERNS = [
  // MSC BOL: "SHIPPER" followed by other column header on same line, company on next line
  /SHIPPER\s+(?:CARRIER|AGENT)[^\n]*\n([A-Z][^\n]*?(?:CO\.?,?\s*LTD|PTY\)?\s*LTD|INC\.?|CORP\.?|LLC|GMBH|S\.?A\.?))/i,
  /^SHIPPER\s*\n([A-Z][^\n]{4,100})/im,
  /(?:Shipper|Exporter)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const NOTIFY_PATTERNS = [
  // MSC BOL: "NOTIFY PARTIES" with clause note, then company on next line
  /NOTIFY\s+PART(?:Y|IES)\s*[:\s]*(?:\([^\)]*\)\s*\n)?([A-Z][A-Z\s]{3,}(?:PTY|LTD|INC|CO|FOOD|INDUSTRIES)[^\n]{0,80})/im,
  /(?:Notify\s+Party)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const CONTAINER_PATTERNS = [
  /([A-Z]{4}\d{7})/g, // Standard ISO container number: 4 letters + 7 digits
];

const WEIGHT_PATTERNS = [
  // Total/Gross weight in summary line (prefer over individual tare/net weights)
  /Total\s*[:\s|]*\s*([\d,\.]+)\s*(?:KGS?|Kgs?|kgs?)/i,
  /(?:Gross\s*(?:Cargo\s*)?Weight|G\.?W\.?)\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
  /(?:Total\s*Weight)\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
  /([\d,\.]+)\s*(?:KGS|KG)\s*(?:Gross)/i,
  // Standalone large weight values near "kgs" (skip tare weight which is smaller)
  /([\d,]{5,}\.?\d*)\s*kgs?\./i,
];

const VOLUME_PATTERNS = [
  // OCR may read "cu. m." as "cum]" or "cu m" or "cu.m"
  /(?:Volume|CBM|Measurement)\s*[:\s]*([\d,\.]+)\s*(?:CBM|M3|m3|cu\.?\s*m\.?)/i,
  /([\d,\.]+)\s*(?:CBM|M3|cu\.?\s*m)/i,
  // OCR garbled "cu. m." patterns
  /([\d,\.]+)\s*cum?\]?/i,
];

const PACKAGES_PATTERNS = [
  /(?:No\.?\s*of\s*(?:Packages|Pkgs|Pieces)|Packages|Quantity)\s*[:\s]*([\d,]+)/i,
  /([\d,]+)\s*(?:Packages|Pkgs|Pieces|Cartons?|Ctns?|Pallets|Plts)/i,
  /Total\s+Items[:\s]*([\d,]+)/i,
];

const FREIGHT_PATTERNS = [
  /(?:Freight|Freight\s+Charges?|Ocean\s+Freight)\s*[:\s]*(?:USD|US\$|\$)\s*([\d,\.]+)/i,
  /(?:USD|US\$|\$)\s*([\d,\.]+)\s*(?:Freight|as\s+agreed)/i,
  /(?:Freight|Freight\s+Charges?)\s*[:\s]*([\d,\.]+)/i,
];

const VALUE_PATTERNS = [
  /(?:Declared\s+Value|Invoice\s+Value|Cargo\s+Value)\s*[:\s]*(?:USD|US\$|\$)\s*([\d,\.]+)/i,
];

const DATE_PATTERNS = [
  /(?:Date\s+of\s+Issue|Issued?\s+Date)\s*[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:Date\s+of\s+Issue|Issued?\s+Date)\s*[:\s]*(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
];

const ONBOARD_DATE_PATTERNS = [
  /(?:Shipped\s+on\s+Board|On\s+Board\s+Date|Laden\s+on\s+Board)\s*[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:Shipped\s+on\s+Board|On\s+Board\s+Date)\s*[:\s]*(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
  // MSC BOL: "SHIPPED ON BOARD DATE" then date on next/same line (dd-Mon-yyyy)
  /SHIPPED\s+ON\s+BOARD\s+DATE\s*\n?\s*(\d{1,2}[\-\/]\w{3,9}[\-\/]\d{2,4})/i,
  // Standalone date format dd-Mon-yyyy near "Board" or "Shipped"
  /(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})/i,
];

const PAYMENT_PATTERNS = [
  /(?:Freight|Payment)\s*[:\s]*(Prepaid|Collect|Third\s+Party)/i,
  /\bFreight\s+(Prepaid|Collect)\b/i,
];

const INCOTERM_PATTERNS = [
  /\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/,
];

const DESCRIPTION_PATTERNS = [
  // Specific goods patterns first (more reliable than generic label matching)
  // Container line followed by goods description (e.g., "MSNU2831240 1759 Carton(s) of ...")
  /[A-Z]{4}\d{7}\s+(\d+\s+(?:Cartons?|Pkgs?|Pallets?|Pieces?|Bags?|Drums?)\(?s?\)?\s+of\s+[^\n]{5,200})/i,
  // HS CODE line has goods description before it
  /(\d+\s+(?:Cartons?|Pkgs?)\(?s?\)?\s+of\s+[A-Z][^\n]{5,200}?)\s*(?:HS\s*CODE|$)/i,
  // Generic label-based patterns
  /(?:Description\s+of\s+(?:Goods|Packages|Cargo))\s*[:\s]+([^\n]{5,500})/i,
  /(?:Commodity|Nature\s+of\s+Goods)\s*[:\s]+([^\n]{5,200})/i,
];

// ─── Helpers ───

function firstMatch(text: string, patterns: RegExp[], minLen = 3): string | null {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const cleaned = cleanExtraction(m[1]);
      if (cleaned && isValidExtraction(cleaned, minLen)) return cleaned;
    }
  }
  return null;
}

function parseNumber(text: string | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(text: string | null): string | null {
  if (!text) return null;
  try {
    // Handle dd-Mon-yyyy format (e.g., "07-Jan-2026") without timezone shift
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const monMatch = text.match(/(\d{1,2})[\-\/\s]+(\w{3,9})[\-\/\s]+(\d{4})/);
    if (monMatch) {
      const mon = monthMap[monMatch[2].substring(0, 3).toLowerCase()];
      if (mon) {
        return `${monMatch[3]}-${mon}-${monMatch[1].padStart(2, '0')}`;
      }
    }
    const d = new Date(text + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

function findAllContainers(text: string): string[] {
  const matches = text.match(CONTAINER_PATTERNS[0]);
  return matches ? [...new Set(matches)] : [];
}

// ─── OCR fallback for scanned/image PDFs ───

async function ocrPdfBuffer(pdfBuffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const sharp = (await import('sharp')).default;
  const Tesseract = (await import('tesseract.js')).default;

  const doc = await (pdfjsLib as any).getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const allText: string[] = [];

  // Process up to 3 pages (BOLs are typically 1-2 pages)
  const pageCount = Math.min(doc.numPages, 3);
  const worker = await Tesseract.createWorker('eng');

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();

    // Find embedded images in the page
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === (pdfjsLib as any).OPS.paintImageXObject || fn === (pdfjsLib as any).OPS.paintJpegXObject) {
        const imgName = ops.argsArray[i][0];
        try {
          const img = await page.objs.get(imgName);
          if (!img || !img.data || img.width < 200 || img.height < 200) continue;
          // kind=2 is RGB (3ch), kind=1 is RGBA (4ch), kind=3 is grayscale (1ch)
          const channels = img.kind === 2 ? 3 : img.kind === 3 ? 1 : 4;
          const pngBuf = await sharp(Buffer.from(img.data), {
            raw: { width: img.width, height: img.height, channels }
          }).greyscale().png().toBuffer();

          const { data } = await worker.recognize(pngBuf);
          if (data.text && data.text.trim().length > 20) {
            allText.push(data.text);
          }
        } catch (e) {
          logWarn('OCR image extraction failed', { imgName, error: (e as Error).message });
        }
      }
    }
  }

  await worker.terminate();
  return allText.join('\n');
}

// ─── Main parser ───

export async function parseBolPdf(pdfBuffer: Buffer): Promise<ParsedBolData> {
  // Import pdf-parse/lib/pdf-parse.js directly to avoid the index.js
  // debug mode check (!module.parent) which tries to load a test PDF file
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(pdfBuffer);
  let text = pdfData.text;

  // If text extraction returned minimal content, try OCR (scanned/image PDF)
  if (text.trim().length < 50) {
    logInfo('PDF has minimal text — attempting OCR for scanned document');
    try {
      text = await ocrPdfBuffer(pdfBuffer);
      logInfo(`OCR extracted ${text.length} characters`);
    } catch (err) {
      logWarn('OCR fallback failed', { error: (err as Error).message });
    }
  }

  const confidence: Record<string, number> = {};

  // Helper that records confidence
  const extract = (field: string, patterns: RegExp[]): string | null => {
    const val = firstMatch(text, patterns);
    confidence[field] = val ? 0.8 : 0;
    return val;
  };

  const bolNumber = extract('bol_number', BOL_NUMBER_PATTERNS);
  const vesselName = extract('vessel_name', VESSEL_PATTERNS);
  const voyageNumber = extract('voyage_number', VOYAGE_PATTERNS);
  const portOfLoading = extract('port_of_loading', PORT_LOADING_PATTERNS);
  const portOfDischarge = extract('port_of_discharge', PORT_DISCHARGE_PATTERNS);
  const consignee = extract('consignee', CONSIGNEE_PATTERNS);
  const shipper = extract('shipper', SHIPPER_PATTERNS);
  const notifyParty = extract('notify_party', NOTIFY_PATTERNS);
  const descriptionOfGoods = extract('description_of_goods', DESCRIPTION_PATTERNS);
  const containers = findAllContainers(text);
  confidence['container_numbers'] = containers.length > 0 ? 0.9 : 0;

  const weightStr = firstMatch(text, WEIGHT_PATTERNS);
  const grossWeightKg = parseNumber(weightStr);
  confidence['gross_weight_kg'] = grossWeightKg ? 0.85 : 0;

  const volumeStr = firstMatch(text, VOLUME_PATTERNS);
  const volumeCbm = parseNumber(volumeStr);
  confidence['volume_cbm'] = volumeCbm ? 0.85 : 0;

  const packagesStr = firstMatch(text, PACKAGES_PATTERNS);
  const numberOfPackages = packagesStr ? Math.round(parseNumber(packagesStr) || 0) || null : null;
  confidence['number_of_packages'] = numberOfPackages ? 0.8 : 0;

  const freightStr = firstMatch(text, FREIGHT_PATTERNS);
  const freightChargesUsd = parseNumber(freightStr);
  confidence['freight_charges_usd'] = freightChargesUsd ? 0.75 : 0;

  const valueStr = firstMatch(text, VALUE_PATTERNS);
  const declaredValueUsd = parseNumber(valueStr);
  confidence['declared_value_usd'] = declaredValueUsd ? 0.75 : 0;

  const issueDate = parseDate(extract('issue_date', DATE_PATTERNS));
  const shipOnBoardDate = parseDate(extract('ship_on_board_date', ONBOARD_DATE_PATTERNS));

  const paymentTermsRaw = firstMatch(text, PAYMENT_PATTERNS);
  const paymentTerms = paymentTermsRaw
    ? paymentTermsRaw.toLowerCase().replace(/\s+/g, '_') as any
    : null;

  const incoterm = firstMatch(text, INCOTERM_PATTERNS);
  confidence['incoterm'] = incoterm ? 0.95 : 0;

  // Carrier name — detect from known carrier patterns or explicit label
  let carrierName: string | null = null;
  // Check for well-known carriers first (reliable even with OCR)
  if (/MEDITERRANEAN\s+SHIPPING\s+COMPANY|MSC\b.*\b(?:S\.?A\.?|shipping)/i.test(text)) {
    carrierName = 'MSC';
  } else if (/MAERSK/i.test(text)) {
    carrierName = 'Maersk';
  } else if (/CMA[\s\-]*CGM/i.test(text)) {
    carrierName = 'CMA CGM';
  } else if (/HAPAG[\s\-]*LLOYD/i.test(text)) {
    carrierName = 'Hapag-Lloyd';
  } else if (/EVERGREEN/i.test(text)) {
    carrierName = 'Evergreen';
  } else if (/COSCO/i.test(text)) {
    carrierName = 'COSCO';
  } else if (/ONE[\s\-]*(?:LINE|NETWORK)/i.test(text)) {
    carrierName = 'ONE';
  } else {
    // Fallback: explicit label
    const carrierPatterns = [
      /(?:Carrier\s*(?:Name)?|Shipping\s+Line|Carrier\s*\/\s*Agent)\s*[:\s]+([A-Z][A-Za-z0-9\s\-\.&,()]{3,60})/i,
    ];
    for (const pat of carrierPatterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        const cleaned = cleanExtraction(m[1]);
        if (cleaned && isValidExtraction(cleaned, 4)) {
          carrierName = cleaned;
          break;
        }
      }
    }
  }
  confidence['carrier_name'] = carrierName ? 0.7 : 0;

  // Supplier — try shipper as fallback
  const supplierName = shipper;

  // ── Post-processing: clean common OCR artifacts ──
  const cleanOcrField = (val: string | null): string | null => {
    if (!val) return null;
    let v = val;
    // Fix common OCR misreads of (PTY) → "flap)", "Jem)", etc.
    v = v.replace(/\b(?:flap|Jem|lem|fem|flan)\)/gi, '(PTY)');
    // Fix "CHLNG" → "CHINA" (common OCR misread)
    v = v.replace(/\bCHLNG\b/g, 'CHINA');
    // Replace dots between words with commas (e.g., "DALIAN.CHINA" → "DALIAN, CHINA")
    v = v.replace(/([A-Z]{3,})\.([A-Z]{3,})/g, '$1, $2');
    // Remove trailing weight/volume that leaked into descriptions
    v = v.replace(/\s+[\d,]+\.?\d*\s*(?:kgs?|kg)\.?\s*$/i, '');
    return v.trim();
  };

  const cleanedPOL = cleanOcrField(portOfLoading);
  const cleanedPOD = cleanOcrField(portOfDischarge);
  const cleanedConsignee = cleanOcrField(consignee);
  const cleanedShipper = cleanOcrField(shipper);
  const cleanedNotify = cleanOcrField(notifyParty);
  const cleanedDesc = cleanOcrField(descriptionOfGoods);
  const cleanedSupplier = cleanOcrField(supplierName);

  logInfo(`BOL PDF parsed: BOL#=${bolNumber || 'unknown'}, vessel=${vesselName || 'unknown'}, containers=${containers.length}`);

  return {
    bol_number: bolNumber,
    supplier_name: cleanedSupplier,
    carrier_name: carrierName,
    vessel_name: vesselName,
    voyage_number: voyageNumber,
    port_of_loading: cleanedPOL,
    port_of_discharge: cleanedPOD,
    consignee: cleanedConsignee,
    shipper: cleanedShipper,
    notify_party: cleanedNotify,
    description_of_goods: cleanedDesc,
    container_numbers: containers,
    gross_weight_kg: grossWeightKg,
    volume_cbm: volumeCbm,
    number_of_packages: numberOfPackages,
    freight_charges_usd: freightChargesUsd,
    declared_value_usd: declaredValueUsd,
    issue_date: issueDate,
    ship_on_board_date: shipOnBoardDate,
    payment_terms: paymentTerms,
    incoterm: incoterm,
    raw_text: text.substring(0, 5000), // Keep first 5000 chars for reference
    confidence,
  };
}

// ─── Auto-audit against shipments ───

export async function autoAuditBol(extracted: ParsedBolData): Promise<BolParseResult['auto_audit'] & { matched_shipment: any | null; cost_protection: CostProtection }> {
  const findings: AuditFinding[] = [];
  let matchedShipment: any | null = null;
  const costProtection: CostProtection = {
    benchmark_rate_per_kg: null,
    expected_freight_usd: null,
    freight_variance_usd: null,
    weight_variance_kg: null,
    weight_variance_pct: null,
    is_duplicate: false,
  };

  // Try to find matching shipment by vessel name, order ref, or supplier
  try {
    const searchTerms: string[] = [];
    if (extracted.vessel_name) searchTerms.push(extracted.vessel_name);
    if (extracted.bol_number) searchTerms.push(extracted.bol_number);

    if (searchTerms.length > 0) {
      // Search by vessel name or order ref
      const conditions = [];
      const params: any[] = [];
      let idx = 1;

      if (extracted.vessel_name) {
        conditions.push(`LOWER(vessel_name) LIKE LOWER($${idx++})`);
        params.push(`%${extracted.vessel_name.substring(0, 30)}%`);
      }
      if (extracted.bol_number) {
        conditions.push(`LOWER(order_ref) LIKE LOWER($${idx++})`);
        params.push(`%${extracted.bol_number}%`);
      }
      if (extracted.supplier_name) {
        conditions.push(`LOWER(supplier) LIKE LOWER($${idx++})`);
        params.push(`%${extracted.supplier_name.substring(0, 30)}%`);
      }

      const shipments = await queryAll(
        `SELECT id, supplier, order_ref, vessel_name, quantity, cbm, pallet_qty,
                final_pod, product_name, forwarding_agent, incoterm, latest_status
         FROM shipments
         WHERE ${conditions.join(' OR ')}
         ORDER BY updated_at DESC
         LIMIT 5`,
        params
      );

      if (shipments.length > 0) {
        matchedShipment = shipments[0];
        findings.push({
          field: 'shipment_match',
          severity: 'info',
          message: `Matched to shipment: ${matchedShipment.order_ref || matchedShipment.id}`,
          bol_value: extracted.bol_number,
          shipment_value: matchedShipment.order_ref || matchedShipment.id,
        });

        // Cross-reference fields
        if (extracted.vessel_name && matchedShipment.vessel_name) {
          if (extracted.vessel_name.toLowerCase() !== matchedShipment.vessel_name.toLowerCase()) {
            findings.push({
              field: 'vessel_name',
              severity: 'warning',
              message: 'Vessel name mismatch between BOL and shipment record',
              bol_value: extracted.vessel_name,
              shipment_value: matchedShipment.vessel_name,
            });
          }
        }

        if (extracted.port_of_discharge && matchedShipment.final_pod) {
          const bolPod = extracted.port_of_discharge.toLowerCase();
          const shipPod = matchedShipment.final_pod.toLowerCase();
          if (!bolPod.includes(shipPod) && !shipPod.includes(bolPod)) {
            findings.push({
              field: 'port_of_discharge',
              severity: 'warning',
              message: 'Destination port mismatch',
              bol_value: extracted.port_of_discharge,
              shipment_value: matchedShipment.final_pod,
            });
          }
        }

        if (extracted.gross_weight_kg && matchedShipment.quantity) {
          const weightDiff = Math.abs(extracted.gross_weight_kg - parseFloat(matchedShipment.quantity));
          const percentDiff = (weightDiff / extracted.gross_weight_kg) * 100;
          if (percentDiff > 10) {
            findings.push({
              field: 'gross_weight_kg',
              severity: percentDiff > 25 ? 'error' : 'warning',
              message: `Weight differs by ${percentDiff.toFixed(1)}% from shipment quantity`,
              bol_value: String(extracted.gross_weight_kg),
              shipment_value: String(matchedShipment.quantity),
            });
          }
        }

        if (extracted.incoterm && matchedShipment.incoterm) {
          if (extracted.incoterm.toUpperCase() !== matchedShipment.incoterm.toUpperCase()) {
            findings.push({
              field: 'incoterm',
              severity: 'warning',
              message: 'Incoterm mismatch',
              bol_value: extracted.incoterm,
              shipment_value: matchedShipment.incoterm,
            });
          }
        }
      } else {
        findings.push({
          field: 'shipment_match',
          severity: 'info',
          message: 'No matching shipment found in the system',
          bol_value: extracted.bol_number,
          shipment_value: null,
        });
      }
    }
  } catch (error) {
    logWarn('Auto-audit shipment matching failed', { error: (error as Error).message });
  }

  // ── Cost protection: benchmark rate comparison ──
  try {
    if (extracted.port_of_loading || extracted.port_of_discharge) {
      const benchmarkConditions: string[] = [];
      const benchmarkParams: any[] = [];
      let bIdx = 1;

      if (extracted.port_of_loading) {
        benchmarkConditions.push(`LOWER(port_of_loading) LIKE LOWER($${bIdx++})`);
        benchmarkParams.push(`%${extracted.port_of_loading.substring(0, 30)}%`);
      }
      if (extracted.port_of_discharge) {
        benchmarkConditions.push(`LOWER(port_of_discharge) LIKE LOWER($${bIdx++})`);
        benchmarkParams.push(`%${extracted.port_of_discharge.substring(0, 30)}%`);
      }

      // Also try to match carrier if available
      if (extracted.carrier_name) {
        benchmarkConditions.push(`LOWER(carrier_name) LIKE LOWER($${bIdx++})`);
        benchmarkParams.push(`%${extracted.carrier_name.substring(0, 30)}%`);
      }

      const benchmarks = await queryAll(
        `SELECT rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd, carrier_name
         FROM freight_benchmarks
         WHERE ${benchmarkConditions.join(' AND ')}
           AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
         ORDER BY valid_from DESC NULLS LAST
         LIMIT 5`,
        benchmarkParams
      );

      // If no carrier-specific match, try without carrier
      let matchedBenchmarks = benchmarks;
      if (matchedBenchmarks.length === 0 && extracted.carrier_name) {
        const fallbackConditions: string[] = [];
        const fallbackParams: any[] = [];
        let fbIdx = 1;
        if (extracted.port_of_loading) {
          fallbackConditions.push(`LOWER(port_of_loading) LIKE LOWER($${fbIdx++})`);
          fallbackParams.push(`%${extracted.port_of_loading.substring(0, 30)}%`);
        }
        if (extracted.port_of_discharge) {
          fallbackConditions.push(`LOWER(port_of_discharge) LIKE LOWER($${fbIdx++})`);
          fallbackParams.push(`%${extracted.port_of_discharge.substring(0, 30)}%`);
        }
        if (fallbackConditions.length > 0) {
          matchedBenchmarks = await queryAll(
            `SELECT rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd, carrier_name
             FROM freight_benchmarks
             WHERE ${fallbackConditions.join(' AND ')}
               AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
             ORDER BY valid_from DESC NULLS LAST
             LIMIT 5`,
            fallbackParams
          );
        }
      }

      if (matchedBenchmarks.length > 0 && extracted.freight_charges_usd) {
        const rate = matchedBenchmarks[0];

        // Detect container type from BOL text/container numbers
        const bolText = (extracted.raw_text || '').toLowerCase();
        const containerInfo = extracted.container_numbers.join(' ').toLowerCase();
        const allText = `${bolText} ${containerInfo}`;

        let benchmarkRate: number | null = null;
        let containerType = '';

        // Try to identify container type from BOL content
        if (/40\s*h[cq]|40.*high\s*cube/i.test(allText)) {
          benchmarkRate = parseFloat(rate.rate_40hc_usd) || null;
          containerType = '40HC';
        } else if (/40\s*(?:gp|ft|dc|')|40.*(?:dry|general|standard)/i.test(allText)) {
          benchmarkRate = parseFloat(rate.rate_40gp_usd) || null;
          containerType = '40GP';
        } else if (/20\s*(?:gp|ft|dc|')|20.*(?:dry|general|standard)/i.test(allText)) {
          benchmarkRate = parseFloat(rate.rate_20gp_usd) || null;
          containerType = '20GP';
        }

        // Fallback: if freight charges are in container rate range, pick closest match
        if (!benchmarkRate) {
          const r20 = parseFloat(rate.rate_20gp_usd) || 0;
          const r40 = parseFloat(rate.rate_40gp_usd) || 0;
          const r40hc = parseFloat(rate.rate_40hc_usd) || 0;
          const freight = extracted.freight_charges_usd;

          // Use the rate closest to actual freight as best guess
          const options = [
            { rate: r20, type: '20GP' },
            { rate: r40, type: '40GP' },
            { rate: r40hc, type: '40HC' },
          ].filter(o => o.rate > 0);

          if (options.length > 0) {
            const closest = options.reduce((a, b) =>
              Math.abs(a.rate - freight) < Math.abs(b.rate - freight) ? a : b
            );
            benchmarkRate = closest.rate;
            containerType = closest.type;
          }
        }

        // Also try rate_per_kg if container rate not available
        if (!benchmarkRate && extracted.gross_weight_kg) {
          const ratePerKg = parseFloat(rate.rate_per_kg_usd);
          if (ratePerKg > 0) {
            benchmarkRate = ratePerKg * extracted.gross_weight_kg;
            containerType = 'per-kg';
            costProtection.benchmark_rate_per_kg = ratePerKg;
          }
        }

        if (benchmarkRate && benchmarkRate > 0) {
          const expectedFreight = containerType === 'per-kg' ? benchmarkRate : benchmarkRate;
          const variance = extracted.freight_charges_usd - expectedFreight;

          if (containerType !== 'per-kg') {
            costProtection.benchmark_rate_per_kg = benchmarkRate; // Store container rate for reference
          }
          costProtection.expected_freight_usd = Math.round(expectedFreight * 100) / 100;
          costProtection.freight_variance_usd = Math.round(variance * 100) / 100;

          if (variance > 0) {
            const pctOver = (variance / expectedFreight) * 100;
            findings.push({
              field: 'freight_charges_usd',
              severity: pctOver > 15 ? 'error' : pctOver > 5 ? 'warning' : 'info',
              message: `Freight $${extracted.freight_charges_usd.toFixed(2)} is $${variance.toFixed(2)} (${pctOver.toFixed(1)}%) above ${containerType} benchmark of $${expectedFreight.toFixed(2)} (${rate.carrier_name || 'avg'})`,
              bol_value: String(extracted.freight_charges_usd),
              shipment_value: String(expectedFreight.toFixed(2)),
            });
          } else if (variance < 0) {
            findings.push({
              field: 'freight_charges_usd',
              severity: 'info',
              message: `Freight $${extracted.freight_charges_usd.toFixed(2)} is $${Math.abs(variance).toFixed(2)} below ${containerType} benchmark of $${expectedFreight.toFixed(2)} (${rate.carrier_name || 'avg'})`,
              bol_value: String(extracted.freight_charges_usd),
              shipment_value: String(expectedFreight.toFixed(2)),
            });
          } else {
            findings.push({
              field: 'freight_charges_usd',
              severity: 'info',
              message: `Freight matches ${containerType} benchmark of $${expectedFreight.toFixed(2)} (${rate.carrier_name || 'avg'})`,
              bol_value: String(extracted.freight_charges_usd),
              shipment_value: String(expectedFreight.toFixed(2)),
            });
          }
        }
      }
    }

    // Weight variance against matched shipment
    if (matchedShipment && extracted.gross_weight_kg && matchedShipment.quantity) {
      const expectedWeight = parseFloat(matchedShipment.quantity);
      if (expectedWeight > 0) {
        const weightDiff = extracted.gross_weight_kg - expectedWeight;
        const weightPct = (weightDiff / expectedWeight) * 100;
        costProtection.weight_variance_kg = Math.round(weightDiff * 1000) / 1000;
        costProtection.weight_variance_pct = Math.round(weightPct * 100) / 100;
      }
    }
  } catch (error) {
    logWarn('Cost protection check failed', { error: (error as Error).message });
  }

  // ── Duplicate BOL detection ──
  try {
    if (extracted.bol_number) {
      const dupes = await queryAll(
        `SELECT id, bol_number, supplier_name, pdf_filename, created_at FROM bol_audits
         WHERE LOWER(bol_number) = LOWER($1)
         ORDER BY created_at DESC`,
        [extracted.bol_number]
      );
      if (dupes.length > 0) {
        costProtection.is_duplicate = true;
        findings.push({
          field: 'bol_number',
          severity: 'warning',
          message: `Possible duplicate: BOL ${extracted.bol_number} already exists (ID ${dupes[0].id}, created ${new Date(dupes[0].created_at).toLocaleDateString()})`,
          bol_value: extracted.bol_number,
          shipment_value: String(dupes[0].id),
          existing_filenames: dupes.map((d: any) => d.pdf_filename).filter(Boolean),
        });
      }
    }
  } catch (error) {
    logWarn('Duplicate check failed', { error: (error as Error).message });
  }

  // Check for missing critical fields — only BOL number is truly critical (error)
  // Others are informational since not all document types contain every field
  if (!extracted.bol_number) {
    findings.push({ field: 'bol_number', severity: 'error', message: 'Could not extract BOL number from PDF', bol_value: null, shipment_value: null });
  }
  if (!extracted.vessel_name) {
    findings.push({ field: 'vessel_name', severity: 'info', message: 'Vessel name not found in PDF', bol_value: null, shipment_value: null });
  }
  if (!extracted.gross_weight_kg) {
    findings.push({ field: 'gross_weight_kg', severity: 'info', message: 'Gross weight not found in PDF', bol_value: null, shipment_value: null });
  }
  if (extracted.container_numbers.length === 0) {
    findings.push({ field: 'container_numbers', severity: 'info', message: 'No container numbers found in PDF', bol_value: null, shipment_value: null });
  }

  // Calculate confidence score based on how many fields were successfully extracted
  // Weighted: essential fields worth more, optional fields less
  const fieldWeights: [string, number][] = [
    ['bol_number', 20],          // Essential
    ['supplier_name', 10],       // Important
    ['gross_weight_kg', 10],     // Important
    ['consignee', 8],            // Important
    ['shipper', 8],              // Important
    ['vessel_name', 7],          // Useful but not always present (air freight, quotes)
    ['port_of_loading', 7],      // Useful
    ['port_of_discharge', 7],    // Useful
    ['incoterm', 5],             // Useful
    ['payment_terms', 4],        // Nice to have
    ['container_numbers', 4],    // Nice to have (not present in air freight)
    ['freight_charges_usd', 4],  // Nice to have
    ['number_of_packages', 3],   // Nice to have
    ['carrier_name', 3],         // Nice to have
  ];
  const totalWeight = fieldWeights.reduce((s, [, w]) => s + w, 0);
  let earnedWeight = 0;
  for (const [field, weight] of fieldWeights) {
    const val = (extracted as any)[field];
    if (field === 'container_numbers') {
      if (val && val.length > 0) earnedWeight += weight;
    } else if (val) {
      earnedWeight += weight;
    }
  }
  const baseScore = (earnedWeight / totalWeight) * 100;

  // Penalize for actual discrepancies (errors/warnings from shipment cross-reference)
  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, Math.round(baseScore - errorCount * 15 - warningCount * 5)));

  // Determine auto-audit status
  // Only flag discrepancy for actual data mismatches, not missing optional fields
  let status: 'pending' | 'discrepancy' | 'approved' = 'pending';
  if (errorCount > 0) {
    status = 'discrepancy';
  } else if (score >= 50 && warningCount === 0) {
    status = 'approved';
  } else if (warningCount > 0) {
    status = 'discrepancy';
  }

  return { status, findings, score, matched_shipment: matchedShipment, cost_protection: costProtection };
}
