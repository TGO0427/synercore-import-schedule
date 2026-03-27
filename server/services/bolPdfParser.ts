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
  // MSC-style BOL numbers (e.g., MEDUHW533143, MEDUWA201799) — highest priority
  /\b(MEDU[A-Z]{1,3}\d{5,10})\b/,
  // OOCL-style BOL numbers (e.g., OOLU8881386790)
  /\b(OOLU\d{7,15})\b/,
  // OOCL Sea Waybill: "SEA WAYBILL NO. (WAYBILL) OOLU8881386790"
  /WAYBILL\s+NO\.?\s*\(WAYBILL\)\s*\n?\s*([A-Z]{4}\d{7,15})/i,
  // Customs Worksheet: "TRANSPORT DOCUMENT NUMBER : OOLU8881386790"
  /TRANSPORT\s+DOCUMENT\s+(?:NUMBER|NO\.?)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /B\/?L\s*(?:No\.?|Number|#|:)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:Bill\s+of\s+Lading|BOL)\s*(?:No\.?|Number|#|:)\s*[~:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /BILL\s+OF\s+LADING\s+No\.?\s*[~:\s]*(MEDU[A-Z0-9]{4,20})/i,
  /(?:Document\s*No\.?|Doc\s*#)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:MBOL|HBOL|MBL|HBL)\s*[:\s#]*([A-Z0-9][\w\-\/]{4,30})/i,
  // Generic: "SEA WAYBILL No." then BOL on next line
  /SEA\s+WAYBILL\s+No\.?\s*\n\s*([A-Z]{4}\d{7,15})/i,
];

// Vessel: require explicit label, capture name with 3+ chars, must look like a proper name
const VESSEL_PATTERNS = [
  // ONE page 2: "VESSEL VOYAGE: CHIBA C 091W" (may run into "B/L NO")
  /VESSEL\s+VOYAGE\s*:\s*([A-Z][A-Z\s]+\w*\s+\d+\w?)(?:B\/L|$|\n)/i,
  // OOCL: vessel name appears near "ORIGINALS TO BE RELEASED AT" section
  /ORIGINALS\s+TO\s+BE\s+RELEASED\s+AT\s*\n[^\n]*\n\s*([A-Z][A-Za-z\s]+\w*\s+\d+\w*)\s*\n/i,
  // OOCL fallback: look for "VESSEL/VOYAGE/FLAG" then scan ahead for vessel-like name
  /VESSEL\s*\/\s*VOYAGE[^\n]*\n[\s\S]*?^([A-Z][A-Z\s]{2,20}\s+\d+\w{0,3})\s*$/im,
  // MSC: standalone "MSC KALAMATA VII - ZF602A" (vessel name - voyage)
  /\b(MSC\s+[A-Z][A-Z\s]{2,25}?\w+)\s*[\-–]\s*[A-Z0-9]{3,15}\b/,
  // MSC BOL: "VESSEL AND VOYAGE NO" on one line, then "MSC TARANTO - GA601W" on next
  /VESSEL\s+AND\s+VOYAGE\s+NO[^\n]*\n([A-Z][A-Za-z0-9\s]{2,30}?)\s*[\-–]\s*[A-Z0-9]/i,
  /(?:Vessel\s*(?:Name)?|Motor\s*Vessel|M\/V|Ocean\s*Vessel)\s*[:\s]+([A-Z][A-Za-z0-9\s\-\.]{2,40}?)(?:\s*(?:Voyage|Voy|V\/|$|\n))/i,
  /(?:Vessel\s*(?:Name)?|Motor\s*Vessel|M\/V)\s*[:\s]+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-\.]{1,38})/i,
];

// Words that should never be extracted as vessel names
const VESSEL_BLACKLIST = /^(?:BILL\s+OF\s+LADING|BILL\s+OF\s+ENTRY|CUSTOMS\s+WORKSHEET|SHIPPING\s+ORDER|DRAFT|ORIGINAL|COPY|SHANGHAI|DURBAN|CAPE\s+TOWN|PORT\s+KELANG|LOADING|ARRIVAL|VOYAGE\s+NO|RECEIVED)$/i;

// Voyage: require explicit "Voyage" or "Voy" label (NOT just "V." which is too ambiguous)
// Voyage numbers typically have digits: e.g., 2401E, 025W, V.123, GA601W
const VOYAGE_PATTERNS = [
  // ONE: "VESSEL VOYAGE: CHIBA C 091W" — voyage is trailing code (may run into B/L)
  /VESSEL\s+VOYAGE\s*:\s*[A-Z][A-Z\s]+?\s+(\d+\w?)(?:B\/L|$|\n)/i,
  // OOCL: vessel+voyage on one line "CHIBA C 91W" — voyage is trailing code with digits
  /ORIGINALS\s+TO\s+BE\s+RELEASED\s+AT\s*\n[^\n]*\n\s*[A-Z][A-Za-z\s]+?\s+(\d+\w{0,3})\s*\n/i,
  // MSC: standalone "MSC KALAMATA VII - ZF602A" — extract voyage after dash
  /\bMSC\s+[A-Z][A-Z\s]{2,25}?\w+\s*[\-–]\s*([A-Z0-9]{3,15})\b/,
  // MSC BOL: vessel and voyage on same line "MSC TARANTO - GA601W"
  /VESSEL\s+AND\s+VOYAGE\s+NO[^\n]*\n[A-Za-z0-9\s]+[\-–]\s*([A-Z0-9]{3,15})/i,
  /(?:Voyage|Voy\.?)\s*(?:No\.?|#)?\s*[:\s]*([A-Z0-9][\w\-]{2,20})/i,
];

// Ports: require the full label, capture only proper location names (not clause text)
// Port names: typically capitalized words, city/country names, 4+ chars
const PORT_LOADING_PATTERNS = [
  // Standalone: "Port Klang, Malaysia" or "QINGDAO" near loading context
  /(?:PLACE\s+OF\s+RECEIPT|PRE-CARRIAGE)[^\n]*\n[^\n]*?\b(PORT\s+KLANG|QINGDAO|SHANGHAI|DALIAN|TIANJIN|NINGBO|JAKARTA)\b/im,
  // OOCL/MSC: "PORT OF LOADING" on one line, port name on next line (single line only)
  /PORT\s+OF\s+LOADING\s*\n\s*([A-Z][A-Za-z ,\-\.]{3,40})/im,
  // MSC BOL OCR: vessel line has POL inline "MSC TARANTO - GA601W DALIAN.CHLNG XXXX"
  /[A-Z0-9]{3,10}W?\s+([A-Z][A-Za-z\., ]{3,30}?)\s+X{4,}/i,
  // MSC BOL: "PORT OF LOADING" header line, then actual port on next line
  /PORT\s+OF\s+LOADING[^\n]*\n[^\n]*?[A-Z0-9]+W?\s+([A-Z][A-Za-z\., ]{3,30}?)\s+X{4,}/im,
  /(?:Port\s+of\s+Loading)\s*[:\s]+([A-Z][A-Za-z ,]{3,45}?)(?:\s*(?:Port\s+of|Vessel|Voyage|Carrier|Place|$|\n))/i,
  /(?:Port\s+of\s+Loading)\s*[:\s]+([A-Z][A-Za-z][A-Za-z ,\-]{2,40})/i,
  /(?:Loading\s+Port)\s*[:\s]+([A-Z][A-Za-z][A-Za-z ,\-]{2,40})/i,
];

const PORT_DISCHARGE_PATTERNS = [
  // Standalone SA port with country: "DURBAN, SOUTH AFRICA" or "Cape Town, South Africa"
  // OCR-tolerant: "South Afica", "South Af" etc.
  /\b(DURBAN|Cape\s+Town|Port\s+Elizabeth),?\s+South\s+Af\w*\b/i,
  // OCR: "Cape Town South Afica" without comma
  /\b(Cape\s+Town)\s+South/i,
  // OOCL/MSC: "PORT OF DISCHARGE" on one line, port name on next line (single line only)
  /PORT\s+OF\s+DISCHARGE\s*\n\s*([A-Z][A-Za-z ,\-\.]{3,40})/im,
  // OCR: port name appears after booking ref line near "PORT OF DISCHARGE"
  /PORT\s+OF\s+DISCHARGE[^\n]*\n[^\n]*?(Cape\s+Town|Durban|Port\s+Elizabeth)[^\n]*/im,
  // MSC BOL OCR: booking ref line "177DPPPED60245 Cape Town, South Africa OOOO XXXX"
  /[A-Z0-9]{8,}\s+(.+?)\s+[OX]{4}/i,
  /(?:Port\s+of\s+Discharge)\s*[:\s]+([A-Z][A-Za-z\s,]{3,45}?)(?:\s*(?:Port\s+of|Vessel|Notify|Consignee|Place|$|\n))/i,
  /(?:Port\s+of\s+Discharge)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Place\s+of\s+Delivery|Final\s+Destination)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
  /(?:Discharge\s+Port)\s*[:\s]+([A-Z][A-Za-z][A-Za-z\s,\-]{2,40})/i,
];

const CONSIGNEE_PATTERNS = [
  // OCR-tolerant: "AFRICAN FOOD" appears in garbled text near KLAPMUTS address
  /\b(AFRICAN\s+FOOD\s+\w+[^\n]{0,40}?(?:PTY|LTD|@\w+LTD)[^\n]{0,20})/i,
  // OOCL: "CONSIGNEE (COMPLETE NAME AND ADDRESS)" — company may span two lines: "(PTY)\nLTD"
  /CONSIGNEE\s*\(?(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS\)?[^\n]*\n\s*([A-Z][^\n]*?\(PTY\)\s*\n\s*LTD)/i,
  /CONSIGNEE\s*\(?(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS\)?[^\n]*\n\s*([A-Z][^\n]*?(?:PTY|LTD|INC|CORP|LLC)[^\n]{0,20}?\bLTD\b)/i,
  /CONSIGNEE\s*\(?(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS\)?[^\n]*\n\s*([A-Z][^\n]{4,100})/i,
  // Generic: "CONSIGNEE'S COMPLETE NAME AND ADDRESS" — may span two lines
  /CONSIGNEE'?S?\s+(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS[^\n]*\n\s*([A-Z][^\n]*?\(PTY\)\s*\n\s*LTD)/i,
  /CONSIGNEE'?S?\s+(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS[^\n]*\n\s*([A-Z][^\n]*?(?:PTY|LTD|INC|CORP|LLC)[^\n]{0,20}?\bLTD\b)/i,
  /CONSIGNEE'?S?\s+(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS[^\n]*\n\s*([A-Z][^\n]{4,100})/i,
  // Customs Worksheet: "IMPORTER : AFRICAN FOOD INDUSTRIES (PTY) LTD"
  /IMPORTER\s*[:\s]+([A-Z][^\n]{4,100})/i,
  // MSC BOL: "CONSIGNEE:" followed by boilerplate, then company name on next line
  /CONSIGNEE[:\s][^\n]*\n([A-Z][^\n]*?\b(?:PTY|LTD|INC|CORP|LLC)\b[^\n]{0,10}?\bLTD\b)/i,
  /CONSIGNEE[:\s][^\n]*\n([A-Z][^\n]*?\bLTD\b)/i,
  // Company name line after CONSIGNEE with address on next line
  /CONSIGNEE[:\s][^\n]*\n([A-Z][^\n]{4,80})\n/i,
  /(?:Consignee|Consigned\s+to)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const SHIPPER_PATTERNS = [
  // Known suppliers (OCR-tolerant) — direct company name detection
  /\b(QIDA\s+CHEMICAL[^\n]{0,30})/i,
  /\b(SACCO\s+S\.?R\.?L[^\n]{0,30})/i,
  /\b(SHAKTI\s+CHEMICAL[^\n]{0,30})/i,
  /\b(AROMSA\s+BESIN[^\n]{0,40})/i,
  /\b(AB\s+MAURI[^\n]{0,30})/i,
  /\b(ECOLEX\s+SDN[^\n]{0,30})/i,
  // OOCL: "SHIPPER/EXPORTER (COMPLETE NAME AND ADDRESS)" then company on next line
  /SHIPPER\s*\/\s*EXPORTER[^\n]*\n\s*([A-Z][^\n]*?(?:CO\.?,?\s*LTD|PTY\)?\s*LTD|INC\.?|CORP\.?|LLC|GMBH|S\.?A\.?))/i,
  /SHIPPER\s*\/\s*EXPORTER[^\n]*\n\s*([A-Z][^\n]{4,100})/i,
  // Generic: "SHIPPER'S COMPLETE NAME AND ADDRESS" then company on next line
  /SHIPPER'?S?\s+(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS[^\n]*\n\s*([A-Z][^\n]*?(?:CO\.?,?\s*LTD|PTY\)?\s*LTD|INC\.?|CORP\.?|LLC|GMBH|S\.?A\.?))/i,
  /SHIPPER'?S?\s+(?:COMPLETE\s+)?NAME\s+AND\s+ADDRESS[^\n]*\n\s*([A-Z][^\n]{4,100})/i,
  // MSC BOL: "SHIPPER" followed by other column header on same line, company on next line
  /SHIPPER\s+(?:CARRIER|AGENT)[^\n]*\n([A-Z][^\n]*?(?:CO\.?,?\s*LTD|PTY\)?\s*LTD|INC\.?|CORP\.?|LLC|GMBH|S\.?A\.?))/i,
  /^SHIPPER\s*\n([A-Z][^\n]{4,100})/im,
  /(?:Shipper|Exporter)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const NOTIFY_PATTERNS = [
  // OOCL: "NOTIFY PARTY (COMPLETE NAME AND ADDRESS)" then company on next line
  /NOTIFY\s+PARTY\s*\(?[^)]*\)?\s*[:\s]*\n\s*([A-Z][^\n]*?(?:PTY|LTD|INC|CORP|LLC|INDUSTRIES)[^\n]{0,80})/im,
  // MSC BOL: "NOTIFY PARTIES" with clause note, then company on next line
  /NOTIFY\s+PART(?:Y|IES)\s*[:\s]*(?:\([^\)]*\)\s*\n)?([A-Z][A-Z\s]{3,}(?:PTY|LTD|INC|CO|FOOD|INDUSTRIES)[^\n]{0,80})/im,
  /(?:Notify\s+Party)\s*[:\s]+([A-Z][^\n]{4,100})/i,
];

const CONTAINER_PATTERNS = [
  /([A-Z]{4}\d{7})/g, // Standard ISO container number: 4 letters + 7 digits
];

const WEIGHT_PATTERNS = [
  // OOCL/carrier TOTAL line: "TOTAL:  960    24592.000KGS  40.000CBM"
  /TOTAL\s*:?\s*\d*\s+([\d,]+\.?\d*)\s*KGS/i,
  // Summary weight in rightmost column (large values, 4+ digits before KGS)
  /([\d,]{4,}\.?\d*)\s*KGS\b/i,
  // Total/Gross weight in summary line (prefer over individual tare/net weights)
  /Total\s+Gross\s+Weight\s+([\d,\.]+)\s*(?:KGS?|Kgs?|kgs?|Ks)/i,
  /Total\s*[:\s|]*\s*([\d,\.]+)\s*(?:KGS?|Kgs?|kgs?)/i,
  /(?:Gross\s*(?:Cargo\s*)?Weight|G\.?W\.?)\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
  /(?:Total\s*Weight)\s*[:\s]*([\d,\.]+)\s*(?:KGS?|Kgs?|kg)/i,
  /([\d,\.]+)\s*(?:KGS|KG)\s*(?:Gross)/i,
  // Standalone large weight values near "kgs" (skip tare weight which is smaller)
  /([\d,]{5,}\.?\d*)\s*kgs?\./i,
  // OCR-tolerant: "22401000 Ks" (missing decimal, "Ks" instead of "Kgs")
  /(?:Gross\s+Weight|Total\s+Gross)\s+([\d,]{5,}\.?\d*)\s*K\w{0,2}\b/i,
];

const VOLUME_PATTERNS = [
  // OCR may read "cu. m." as "cum]" or "cu m" or "cu.m"
  /(?:Volume|CBM|Measurement)\s*[:\s]*([\d,\.]+)\s*(?:CBM|M3|m3|cu\.?\s*m\.?)/i,
  /([\d,\.]+)\s*(?:CBM|M3|cu\.?\s*m)/i,
  // OCR garbled "cu. m." patterns
  /([\d,\.]+)\s*cum?\]?/i,
];

const PACKAGES_PATTERNS = [
  // MSC: "Total Items :   600" / OCR: "Total ems es" → "Total Items 890"
  /Total\s+(?:Items|ems|lte?ms)\s*[:\s]*(\d[\d,]*)/i,
  // OOCL TOTAL line: "TOTAL:  960"
  /TOTAL\s*:?\s*(\d{2,})\s+[\d,]+\.?\d*\s*KGS/i,
  /(?:No\.?\s*of\s*(?:Packages|Pkgs|Pieces)|Packages|Quantity)\s*[:\s]*([\d,]+)/i,
  /([\d,]+)\s*(?:Packages|Pkgs|Pieces|Cartons?|Ctns?|Bags?|Pallets|Plts)/i,
];

const FREIGHT_PATTERNS = [
  // Customs Worksheet: "FREIGHT / INSURANCE (deducted) 3360.00 USD"
  /FREIGHT\s*\/\s*INSURANCE\s*\(?[^)]*\)?\s*([\d,\.]+)\s*USD/i,
  /(?:Freight|Freight\s+Charges?|Ocean\s+Freight)\s*[:\s]*(?:USD|US\$|\$)\s*([\d,\.]+)/i,
  /(?:USD|US\$|\$)\s*([\d,\.]+)\s*(?:Freight|as\s+agreed)/i,
  /(?:Freight|Freight\s+Charges?)\s*[:\s]*([\d,\.]+)/i,
];

const VALUE_PATTERNS = [
  // Customs Worksheet: "SUPPLIER'S INVOICE #QD260105(CIF) 65520.00 USD"
  /SUPPLIER'?S?\s+INVOICE\s*#?\w*\s*\(?[^)]*\)?\s*([\d,\.]+)\s*USD/i,
  /(?:Declared\s+Value|Invoice\s+Value|Cargo\s+Value)\s*[:\s]*(?:USD|US\$|\$)\s*([\d,\.]+)/i,
  /(?:Foreign\s+Amount)\s*[:\s]*(?:USD|US\$|\$)?\s*([\d,\.]+)\s*USD/i,
];

const DATE_PATTERNS = [
  /(?:Date\s+of\s+Issue|Issued?\s+Date)\s*[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:Date\s+of\s+Issue|Issued?\s+Date)\s*[:\s]*(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
  // MSC: "PLACE AND DATE OF ISSUE" then "Qingdao, China\n19-Dec-2025" or "19:Dec 2025"
  /DATE\s+OF\s+(?:ISSUE|SUE)\s*\n[^\n]*\n\s*(\d{1,2}[\-:\/]\w{3,9}[\-\s\/]\d{4})/im,
];

const ONBOARD_DATE_PATTERNS = [
  // OOCL: "DATE LADEN ON BOARD" then date (16 JAN 2026)
  /DATE\s+LADEN\s+ON\s+BOARD\s*[:\s=]*(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
  // Customs Worksheet: "SHIPPED ON BOARD : 16/01/2026"
  /SHIPPED\s+ON\s+BOARD\s*[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:Shipped\s+on\s+Board|On\s+Board\s+Date|Laden\s+on\s+Board)\s*[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:Shipped\s+on\s+Board|On\s+Board\s+Date|Laden\s+on\s+Board)\s*[:\s]*(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
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
  // OOCL: "960 SODIUM CARBOXYMETHYL CELLULOSE" (quantity + product name, no "of")
  /\d+\s+(?:BAGS?|CARTONS?|PKGS?)\s+[\s\S]*?\d+\s+((?:SODIUM|[A-Z]{4,})\s+[A-Z\s]{5,100})/i,
  // Quantity + product name pattern (e.g., "960 BAGS ... SODIUM CARBOXYMETHYL CELLULOSE")
  /(\d+\s+(?:Cartons?|Pkgs?|Bags?|Drums?|Pieces?)\s+[A-Z][A-Z\s\-()]{5,200})/i,
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
    const monMatch = text.match(/(\d{1,2})[\-\/:\s]+(\w{3,9})[\-\/:\s]+(\d{4})/);
    if (monMatch) {
      const mon = monthMap[monMatch[2].substring(0, 3).toLowerCase()];
      if (mon) {
        return `${monMatch[3]}-${mon}-${monMatch[1].padStart(2, '0')}`;
      }
    }
    // Handle dd/mm/yyyy or dd-mm-yyyy (common in customs docs, South African format)
    const ddmmMatch = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (ddmmMatch) {
      const day = parseInt(ddmmMatch[1]);
      const month = parseInt(ddmmMatch[2]);
      // If day > 12, it must be dd/mm format; if month > 12, it's mm/dd
      // Default to dd/mm (South African convention)
      if (day <= 31 && month <= 12) {
        return `${ddmmMatch[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
    let foundLargeImage = false;

    // Try embedded images first (scanned PDFs)
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === (pdfjsLib as any).OPS.paintImageXObject || fn === (pdfjsLib as any).OPS.paintJpegXObject) {
        const imgName = ops.argsArray[i][0];
        try {
          const img = await page.objs.get(imgName);
          if (!img || !img.data || img.width < 200 || img.height < 200) continue;
          foundLargeImage = true;
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

    // If no large embedded images found, the PDF likely uses vector/path rendering.
    // Render the full page to a high-res image and OCR that.
    if (!foundLargeImage) {
      logInfo(`Page ${p}: no large images found — rendering full page for OCR`);
      try {
        // @napi-rs/canvas is an optional dep — may not be available on all platforms
        let createCanvas: any;
        try {
          createCanvas = (await import('@napi-rs/canvas')).createCanvas;
        } catch {
          logWarn('Full-page OCR unavailable: @napi-rs/canvas not installed');
          continue;
        }
        const scale = 2.0; // 2x for readable OCR quality
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx as any, viewport }).promise;
        const pngBuf = canvas.toBuffer('image/png');

        const { data } = await worker.recognize(pngBuf);
        if (data.text && data.text.trim().length > 20) {
          allText.push(data.text);
          logInfo(`Page ${p}: full-page OCR extracted ${data.text.length} chars`);
        }
      } catch (e) {
        logWarn('Full-page render OCR failed', { page: p, error: (e as Error).message });
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
  let vesselName = extract('vessel_name', VESSEL_PATTERNS);
  // Reject false positive vessel names (document titles etc.)
  if (vesselName && VESSEL_BLACKLIST.test(vesselName)) {
    vesselName = null;
    confidence['vessel_name'] = 0;
  }
  const voyageNumber = extract('voyage_number', VOYAGE_PATTERNS);
  let portOfLoading = extract('port_of_loading', PORT_LOADING_PATTERNS);
  let portOfDischarge = extract('port_of_discharge', PORT_DISCHARGE_PATTERNS);

  // Post-processing: detect port swap from garbled multi-column PDF extraction
  // Asian ports are loading origins, SA ports are discharge destinations
  const ASIAN_PORTS = /^(?:QINGDAO|SHANGHAI|DALIAN|TIANJIN|NINGBO|SHENZHEN|XIAMEN|GUANGZHOU|JAKARTA|PORT\s+KELANG|BUSAN|HONG\s*KONG|YOKOHAMA|TOKYO|KAOHSIUNG)/i;
  const SA_PORTS = /^(?:DURBAN|CAPE\s+TOWN|PORT\s+ELIZABETH|COEGA|NGQURA)/i;

  // If discharge is an Asian port, it's almost certainly the loading port (swap)
  if (portOfDischarge && ASIAN_PORTS.test(portOfDischarge)) {
    const correctPOL = portOfDischarge;
    // Try to find the real discharge port from text
    const saMatch = text.match(/\b(Durban|Cape\s+Town|Port\s+Elizabeth)[,\s]+South\s+Africa\b/i);
    portOfLoading = correctPOL;
    portOfDischarge = saMatch ? saMatch[1] : portOfLoading === portOfDischarge ? null : portOfLoading;
    if (portOfDischarge === portOfLoading) portOfDischarge = null;
    confidence['port_of_loading'] = 0.7;
    confidence['port_of_discharge'] = saMatch ? 0.7 : 0;
  }
  // If loading is a SA port and discharge is null/non-Asian, they might also be swapped
  if (portOfLoading && SA_PORTS.test(portOfLoading) && portOfDischarge && ASIAN_PORTS.test(portOfDischarge) === false) {
    const temp = portOfLoading;
    portOfLoading = portOfDischarge;
    portOfDischarge = temp;
    confidence['port_of_loading'] = 0.6;
    confidence['port_of_discharge'] = 0.6;
  }
  let consignee = extract('consignee', CONSIGNEE_PATTERNS);
  let shipper = extract('shipper', SHIPPER_PATTERNS);
  const notifyParty = extract('notify_party', NOTIFY_PATTERNS);
  let descriptionOfGoods = extract('description_of_goods', DESCRIPTION_PATTERNS);
  // Reject descriptions that are document titles or legal text
  const DESC_BLACKLIST = /^(?:ORIGINAL|NON\s+NEGOTIABLE|RECEIVED|PARTICULARS|SIGNED|PAGE|COPY|DRAFT|CARRIER)/i;
  if (descriptionOfGoods && DESC_BLACKLIST.test(descriptionOfGoods)) {
    descriptionOfGoods = null;
    confidence['description_of_goods'] = 0;
  }
  let containers = findAllContainers(text);
  // Filter out false positives: substrings of the BOL number (e.g., "EDUR9513553" from "MEDUR9513553")
  if (bolNumber) {
    containers = containers.filter(c => !bolNumber.includes(c) && !c.includes(bolNumber));
  }
  confidence['container_numbers'] = containers.length > 0 ? 0.9 : 0;

  const weightStr = firstMatch(text, WEIGHT_PATTERNS);
  let grossWeightKg = parseNumber(weightStr);
  // OCR often merges decimal "22401.000 Kgs" into "22401000 Ks" — detect and fix
  // Typical single-container sea freight is 5,000–30,000 kg; values >100,000 are suspect
  if (grossWeightKg && grossWeightKg > 100000 && grossWeightKg % 1000 === 0) {
    grossWeightKg = grossWeightKg / 1000;
  }
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
  } else if (/ORIENT\s+OVERSEAS|OOCL/i.test(text)) {
    carrierName = 'OOCL';
  } else if (/COSCO/i.test(text)) {
    carrierName = 'COSCO';
  } else if (/Ocean\s+Network\s+Express|ONE[\s\-]*(?:LINE|NETWORK)/i.test(text)) {
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

  // Reject shipper values that are legal disclaimers/clause fragments
  const SHIPPER_BLACKLIST = /^(?:BUT\s+NOT|NOT\s+RESPONSIBLE|AS\s+AGENT|ACCORDING|RECEIVED|SAID|APPARENT)/i;
  if (shipper && SHIPPER_BLACKLIST.test(shipper)) {
    shipper = null;
    confidence['shipper'] = 0;
  }

  // Reject consignee values that are form labels/noise
  const CONSIGNEE_BLACKLIST = /^(?:TRANSPORT\s+CODE|TRANSPORT\s+DOCUMENT|CUSTOMS|DECLARATION|FORWARDING|FMC\s*NO|RECEIVED|PARTICULARS|SIGNED|PAGE)/i;
  if (consignee && CONSIGNEE_BLACKLIST.test(consignee)) {
    consignee = null;
    confidence['consignee'] = 0;
  }

  // Post-processing: normalize OCR-garbled known company names
  const KNOWN_COMPANIES: [RegExp, string][] = [
    [/AFRICAN\s+FOOD\s+(?:MOUS\s+TRES|INDUSTRIES|INDUSTR\w+|IND\w+)[^\n]{0,30}?(?:@TILTD|PTY\)?\.?\s*LTD|\(PTY\)\s*LTD)/i, 'AFRICAN FOOD INDUSTRIES (PTY) LTD'],
    [/QIDA\s+CHEM\w+[^\n]{0,20}?(?:PTY|LTD)/i, 'QIDA CHEMICAL PTY LTD'],
    [/SACCO\s+S\.?R\.?L/i, 'SACCO S.R.L'],
    [/SHAKTI\s+CHEM\w+/i, 'SHAKTI CHEMICALS'],
  ];
  const normalizeCompany = (val: string | null): string | null => {
    if (!val) return null;
    for (const [pattern, canonical] of KNOWN_COMPANIES) {
      if (pattern.test(val)) return canonical;
    }
    return val;
  };
  consignee = normalizeCompany(consignee);
  shipper = normalizeCompany(shipper);

  // Supplier — try shipper as fallback, or consignee for customs worksheets (importer)
  const supplierName = shipper || null;

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

  // Clean port names: strip common noise phrases from OOCL/carrier formats
  const cleanPort = (val: string | null): string | null => {
    if (!val) return null;
    let v = cleanOcrField(val) || '';
    // Remove noise phrases that leak into port names
    v = v.replace(/\b(?:LOADING\s+PIER|PLACE\s+OF\s+DELIVERY|PLACE\s+OF\s+RECEIPT|CY\s*\/?\s*CY|CFS\s*\/?\s*CFS)\b/gi, '');
    // Remove trailing country after comma if it's a duplicate city (e.g., "DURBAN ... DURBAN, SOUTH A" → "DURBAN")
    v = v.replace(/,\s*SOUTH\s+AF?\w*$/i, '');
    // Remove duplicate city names (e.g., "DURBAN DURBAN" → "DURBAN")
    const words = v.trim().split(/\s+/);
    if (words.length >= 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
      words.splice(1, 1);
    }
    v = words.join(' ').trim();
    // Remove trailing commas/spaces
    v = v.replace(/[,\s]+$/, '').trim();
    return v.length >= 2 ? v : null;
  };

  const cleanedPOL = cleanPort(portOfLoading);
  const cleanedPOD = cleanPort(portOfDischarge);
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
  // Always benchmark against "MSC Standard" as the baseline rate.
  // Match benchmarks to the BOL's ship-on-board date (or issue date as fallback).
  // If no date-matched benchmarks exist, fall back to the most recent one.
  try {
    // Use cleaned port names for benchmark matching
    const bolPOL = cleanedPOL || extracted.port_of_loading;
    const bolPOD = cleanedPOD || extracted.port_of_discharge;
    // BOL date for benchmark period matching: prefer ship_on_board_date
    const bolDate = extracted.ship_on_board_date || extracted.issue_date || null;

    if (bolPOL || bolPOD) {
      // Extract just the city name (first word) for flexible matching
      const polCity = bolPOL ? bolPOL.split(/[\s,]+/)[0].substring(0, 30) : null;
      const podCity = bolPOD ? bolPOD.split(/[\s,]+/)[0].substring(0, 30) : null;

      // Helper to build port matching conditions
      const buildPortConditions = (pCity: string | null, pFull: string | null, field: string, params: any[], startIdx: number): { conditions: string[]; nextIdx: number } => {
        const conditions: string[] = [];
        let idx = startIdx;
        if (pCity) {
          conditions.push(`(LOWER(${field}) LIKE LOWER($${idx}) OR LOWER($${idx + 1}) LIKE '%' || LOWER(${field}) || '%')`);
          params.push(`%${pCity}%`, (pFull || pCity).substring(0, 60));
          idx += 2;
        }
        return { conditions, nextIdx: idx };
      };

      // Try MSC Standard first (always the baseline benchmark)
      // dateMatch: 'exact' uses the BOL date to find the right benchmark period,
      //            'any' ignores dates (most recent), 'none' for null-date benchmarks only
      const tryBenchmarkQuery = async (portConditions: string[], portParams: any[], dateMatch: 'exact' | 'any' | 'none'): Promise<any[]> => {
        let validClause = '';
        let orderClause = 'ORDER BY valid_from DESC NULLS LAST';

        if (dateMatch === 'exact' && bolDate) {
          // Find benchmark whose period covers the BOL date
          validClause = `AND (valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_from <= '${bolDate}'::date AND valid_until >= '${bolDate}'::date)`;
          orderClause = 'ORDER BY valid_from DESC';
        } else if (dateMatch === 'none') {
          // Only null-date (always-active) benchmarks
          validClause = 'AND valid_from IS NULL AND valid_until IS NULL';
        }
        // dateMatch === 'any' has no date filter — picks most recent

        if (portConditions.length === 0) return [];

        // First: try MSC Standard
        const mscIdx = portParams.length + 1;
        const mscResults = await queryAll(
          `SELECT rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd, carrier_name, valid_from, valid_until
           FROM freight_benchmarks
           WHERE ${portConditions.join(' AND ')}
             AND LOWER(carrier_name) = LOWER($${mscIdx})
             ${validClause}
           ${orderClause}
           LIMIT 1`,
          [...portParams, 'MSC Standard']
        );
        if (mscResults.length > 0) return mscResults;

        // Fallback: any carrier for the same route
        return queryAll(
          `SELECT rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd, carrier_name, valid_from, valid_until
           FROM freight_benchmarks
           WHERE ${portConditions.join(' AND ')}
             ${validClause}
           ${orderClause}
           LIMIT 5`,
          portParams
        );
      };

      // Build port conditions for full route
      let params1: any[] = [];
      let idx1 = 1;
      const pol1 = buildPortConditions(polCity, bolPOL, 'port_of_loading', params1, idx1);
      idx1 = pol1.nextIdx;
      const pod1 = buildPortConditions(podCity, bolPOD, 'port_of_discharge', params1, idx1);
      const conds1 = [...pol1.conditions, ...pod1.conditions];

      // Step 1: Match on BOL date + full route (exact period match)
      let matchedBenchmarks = bolDate ? await tryBenchmarkQuery(conds1, params1, 'exact') : [];

      // Step 2: BOL date + discharge port only
      if (matchedBenchmarks.length === 0 && bolDate && podCity) {
        let params2: any[] = [];
        const pod2 = buildPortConditions(podCity, bolPOD, 'port_of_discharge', params2, 1);
        matchedBenchmarks = await tryBenchmarkQuery(pod2.conditions, params2, 'exact');
      }

      // Step 3: Null-date (always-active) benchmarks for full route
      if (matchedBenchmarks.length === 0) {
        matchedBenchmarks = await tryBenchmarkQuery(conds1, params1, 'none');
      }

      // Step 4: Null-date benchmarks for discharge port only
      if (matchedBenchmarks.length === 0 && podCity) {
        let params3: any[] = [];
        const pod3 = buildPortConditions(podCity, bolPOD, 'port_of_discharge', params3, 1);
        matchedBenchmarks = await tryBenchmarkQuery(pod3.conditions, params3, 'none');
      }

      // Step 5: Final fallback — any benchmark for the route (most recent)
      if (matchedBenchmarks.length === 0) {
        matchedBenchmarks = await tryBenchmarkQuery(conds1, params1, 'any');
      }
      if (matchedBenchmarks.length === 0 && podCity) {
        let params4: any[] = [];
        const pod4 = buildPortConditions(podCity, bolPOD, 'port_of_discharge', params4, 1);
        matchedBenchmarks = await tryBenchmarkQuery(pod4.conditions, params4, 'any');
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
        // OOCL format: "/PCL/FCL /40HC/" or "/FCL/FCL /40GP/"
        if (/\/(?:PCL|FCL|LCL)\s*\/\s*(?:PCL|FCL|LCL)\s*\/\s*(40H[CQ]|40GP|20GP)\b/i.test(allText)) {
          const ctMatch = allText.match(/\/(?:PCL|FCL|LCL)\s*\/\s*(?:PCL|FCL|LCL)\s*\/\s*(40H[CQ]|40GP|20GP)/i);
          if (ctMatch) {
            const ct = ctMatch[1].toUpperCase();
            if (ct === '40HC' || ct === '40HQ') { benchmarkRate = parseFloat(rate.rate_40hc_usd) || null; containerType = '40HC'; }
            else if (ct === '40GP') { benchmarkRate = parseFloat(rate.rate_40gp_usd) || null; containerType = '40GP'; }
            else if (ct === '20GP') { benchmarkRate = parseFloat(rate.rate_20gp_usd) || null; containerType = '20GP'; }
          }
        } else if (/40\s*h[cq]|40.*high\s*cube/i.test(allText)) {
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
