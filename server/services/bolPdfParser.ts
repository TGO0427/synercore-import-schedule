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

export interface BolParseResult {
  extracted: ParsedBolData;
  matched_shipment: any | null;
  auto_audit: {
    status: 'pending' | 'discrepancy' | 'approved';
    findings: AuditFinding[];
    score: number; // 0-100 confidence that BOL is correct
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
  /(?:Bill\s+of\s+Lading|BOL)\s*(?:No\.?|Number|#|:)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:Document\s*No\.?|Doc\s*#)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:MBOL|HBOL|MBL|HBL)\s*[:\s#]*([A-Z0-9][\w\-\/]{4,30})/i,
];

// Vessel: require explicit label, capture name with 3+ chars, must look like a proper name
const VESSEL_PATTERNS = [
  /(?:Vessel\s*(?:Name)?|Motor\s*Vessel|M\/V|Ocean\s*Vessel)\s*[:\s]+([A-Z][A-Za-z0-9\s\-\.]{2,40}?)(?:\s*(?:Voyage|Voy|V\/|$|\n))/i,
  /(?:Vessel\s*(?:Name)?|Motor\s*Vessel|M\/V)\s*[:\s]+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-\.]{1,38})/i,
];

// Voyage: require explicit "Voyage" or "Voy" label (NOT just "V." which is too ambiguous)
// Voyage numbers typically have digits: e.g., 2401E, 025W, V.123
const VOYAGE_PATTERNS = [
  /(?:Voyage|Voy\.?)\s*(?:No\.?|#)?\s*[:\s]*([A-Z0-9][\w\-]{2,20})/i,
];

// Ports: require the full label, capture only proper location names (not clause text)
// Port names: typically capitalized words, city/country names, 4+ chars
const PORT_LOADING_PATTERNS = [
  /(?:Port\s+of\s+Loading)\s*[:\s]+([A-Z][A-Za-z\s,]{3,45}?)(?:\s*(?:Port\s+of|Vessel|Voyage|Carrier|$|\n))/i,
  /(?:Port\s+of\s+Loading)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Place\s+of\s+Receipt)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Loading\s+Port)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
];

const PORT_DISCHARGE_PATTERNS = [
  /(?:Port\s+of\s+Discharge)\s*[:\s]+([A-Z][A-Za-z\s,]{3,45}?)(?:\s*(?:Port\s+of|Vessel|Notify|Consignee|$|\n))/i,
  /(?:Port\s+of\s+Discharge)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Place\s+of\s+Delivery|Final\s+Destination)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Discharge\s+Port)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
];

const CONSIGNEE_PATTERNS = [
  /(?:Consignee|Consigned\s+to)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const SHIPPER_PATTERNS = [
  /(?:Shipper|Exporter)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const NOTIFY_PATTERNS = [
  /(?:Notify\s+Party)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const CONTAINER_PATTERNS = [
  /([A-Z]{4}\d{7})/g, // Standard ISO container number: 4 letters + 7 digits
];

const WEIGHT_PATTERNS = [
  /(?:Gross\s*Weight|G\.?W\.?)\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
  /(?:Total\s*Weight)\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
  /([\d,\.]+)\s*(?:KGS|KG)\s*(?:Gross)/i,
  /Weight\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
];

const VOLUME_PATTERNS = [
  /(?:Volume|CBM|Measurement)\s*[:\s]*([\d,\.]+)\s*(?:CBM|M3|m3|cu\.?\s*m)/i,
  /([\d,\.]+)\s*(?:CBM|M3)/i,
];

const PACKAGES_PATTERNS = [
  /(?:No\.?\s*of\s*(?:Packages|Pkgs|Pieces)|Packages|Quantity)\s*[:\s]*([\d,]+)/i,
  /([\d,]+)\s*(?:Packages|Pkgs|Pieces|Cartons|Ctns|Pallets|Plts)/i,
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
];

const PAYMENT_PATTERNS = [
  /(?:Freight|Payment)\s*[:\s]*(Prepaid|Collect|Third\s+Party)/i,
];

const INCOTERM_PATTERNS = [
  /\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/,
];

const DESCRIPTION_PATTERNS = [
  /(?:Description\s+of\s+(?:Goods|Packages|Cargo)|Particulars)\s*[:\s]+([^\n]{5,500})/i,
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
    const d = new Date(text);
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

// ─── Main parser ───

export async function parseBolPdf(pdfBuffer: Buffer): Promise<ParsedBolData> {
  // Import pdf-parse/lib/pdf-parse.js directly to avoid the index.js
  // debug mode check (!module.parent) which tries to load a test PDF file
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text;
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

  // Carrier name — look for explicit "Carrier" label followed by a company name
  let carrierName: string | null = null;
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
  confidence['carrier_name'] = carrierName ? 0.7 : 0;

  // Supplier — try shipper as fallback
  const supplierName = shipper;

  logInfo(`BOL PDF parsed: BOL#=${bolNumber || 'unknown'}, vessel=${vesselName || 'unknown'}, containers=${containers.length}`);

  return {
    bol_number: bolNumber,
    supplier_name: supplierName,
    carrier_name: carrierName,
    vessel_name: vesselName,
    voyage_number: voyageNumber,
    port_of_loading: portOfLoading,
    port_of_discharge: portOfDischarge,
    consignee: consignee,
    shipper: shipper,
    notify_party: notifyParty,
    description_of_goods: descriptionOfGoods,
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

export async function autoAuditBol(extracted: ParsedBolData): Promise<BolParseResult['auto_audit'] & { matched_shipment: any | null }> {
  const findings: AuditFinding[] = [];
  let matchedShipment: any | null = null;

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

  // Check for missing critical fields
  if (!extracted.bol_number) {
    findings.push({ field: 'bol_number', severity: 'error', message: 'Could not extract BOL number from PDF', bol_value: null, shipment_value: null });
  }
  if (!extracted.vessel_name) {
    findings.push({ field: 'vessel_name', severity: 'warning', message: 'Vessel name not found in PDF', bol_value: null, shipment_value: null });
  }
  if (!extracted.gross_weight_kg) {
    findings.push({ field: 'gross_weight_kg', severity: 'warning', message: 'Gross weight not found in PDF', bol_value: null, shipment_value: null });
  }
  if (extracted.container_numbers.length === 0) {
    findings.push({ field: 'container_numbers', severity: 'warning', message: 'No container numbers found in PDF', bol_value: null, shipment_value: null });
  }

  // Calculate confidence score
  const criticalFields = ['bol_number', 'vessel_name', 'gross_weight_kg', 'port_of_loading', 'port_of_discharge'];
  const extractedCount = criticalFields.filter(f => (extracted as any)[f]).length;
  const baseScore = (extractedCount / criticalFields.length) * 70;
  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, Math.round(baseScore + 30 - errorCount * 15 - warningCount * 5)));

  // Determine auto-audit status
  let status: 'pending' | 'discrepancy' | 'approved' = 'pending';
  if (errorCount > 0) {
    status = 'discrepancy';
  } else if (score >= 80 && warningCount === 0) {
    status = 'approved';
  } else if (warningCount > 0) {
    status = 'discrepancy';
  }

  return { status, findings, score, matched_shipment: matchedShipment };
}
