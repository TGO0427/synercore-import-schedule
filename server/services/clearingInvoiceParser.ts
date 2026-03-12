/**
 * Clearing Agent Invoice Parser
 * Extracts structured data from clearing agent invoices (AGX International, etc.)
 * Parses header fields, shipment details, and itemised charge lines.
 */

import { logInfo, logWarn } from '../utils/logger.js';

export interface ClearingChargeLine {
  description: string;
  vat_code: string | null;
  roe: number | null;
  foreign_amount: number | null;
  local_amount: number | null;
  vat_amount: number | null;
}

export interface ClearingInvoiceData {
  invoice_number: string | null;
  account_no: string | null;
  invoice_date: string | null;
  due_date: string | null;
  file_ref: string | null;
  importer: string | null;
  origin: string | null;
  vessel: string | null;
  voyage_number: string | null;
  mobl: string | null;
  hobl: string | null;
  sob_date: string | null;
  eta: string | null;
  supplier: string | null;
  destination: string | null;
  packages: number | null;
  gross_mass: number | null;
  volume: number | null;
  chargeable_weight: number | null;
  container_numbers: string[];
  container_type: string | null;
  client_reference: string | null;
  charges: ClearingChargeLine[];
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  raw_text: string;
}

/** Parse ZAR amount: "142,326.75" or "5,430.00" or "5430.00" → number */
function parseZarAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Parse AGX date formats: "25-Feb-2026" or "2026/01/18" or "14-Apr-2026" → ISO */
function parseAgxDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // ISO-ish: 2026/01/18
  const isoMatch = trimmed.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Named month: 25-Feb-2026 or 14-Apr-2026
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const namedMatch = trimmed.match(/(\d{1,2})[\-\/\s]([A-Za-z]{3})[\-\/\s](\d{4})/);
  if (namedMatch) {
    const mon = months[namedMatch[2].toLowerCase()];
    if (mon) return `${namedMatch[3]}-${mon}-${namedMatch[1].padStart(2, '0')}`;
  }

  return null;
}

/** Known carrier BOL prefixes */
const CARRIER_BOL_PREFIXES = ['MEDU', 'OOLU', 'ONEYP', 'COSU', 'HDMU', 'MAEU', 'MSCU', 'ZIMU', 'HLCU', 'CMDU', 'EGLV', 'APLU', 'YMLU'];

export async function parseClearingInvoice(pdfBuffer: Buffer): Promise<ClearingInvoiceData> {
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text;

  // === Header fields ===
  // Invoice number: "Invoice No. IN20124" or "IN20124" near TAX INVOICE
  const invoiceNoMatch = text.match(/Invoice\s*(?:No\.?|Number)\s*[:\s]*([A-Z]*\d+)/i)
    || text.match(/\b(IN\d{4,})\b/);
  const invoiceNumber = invoiceNoMatch ? invoiceNoMatch[1].trim() : null;

  // Account number
  const accountMatch = text.match(/Account\s*No\.?\s*[:\s]*([A-Z]{2,}\d+)/i);
  const accountNo = accountMatch ? accountMatch[1].trim() : null;

  // Invoice date
  const invDateMatch = text.match(/Invoice\s*Date\s*[:\s]*(\d{1,2}[\-\/\s][A-Za-z]{3}[\-\/\s]\d{4})/i)
    || text.match(/Invoice\s*Date\s*[:\s]*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i);
  const invoiceDate = invDateMatch ? parseAgxDate(invDateMatch[1]) : null;

  // Due date
  const dueDateMatch = text.match(/Due\s*Date\s*[:\s]*(\d{1,2}[\-\/\s][A-Za-z]{3}[\-\/\s]\d{4})/i)
    || text.match(/Due\s*Date\s*[:\s]*(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i);
  const dueDate = dueDateMatch ? parseAgxDate(dueDateMatch[1]) : null;

  // File ref
  const fileRefMatch = text.match(/File\s*Ref\.?\s*(?:No\.?)?\s*[:\s]*([A-Z]{2,}\d+)/i);
  const fileRef = fileRefMatch ? fileRefMatch[1].trim() : null;

  // === Shipment details ===
  // AGX pdf-parse extracts labels (lines 7-20) and values (lines 31+) separately.
  // Labels: Importer, Origin, Vessel, MOBL, S.O.B., No. of Packages, Gross Mass, Volume,
  //         Supplier, Destination, HOBL, E.T.A, Client Reference, Chargeable Wt.
  // Values appear later in the same order.
  // Strategy: build a label→index map, then map each label to its value by position.

  const lines = text.split('\n');

  // Known AGX shipment detail labels in display order
  const DETAIL_LABELS = [
    'Importer', 'Origin', 'Vessel', 'MOBL', 'S.O.B.',
    'No. of Packages', 'Gross Mass (kg)', 'Volume',
    'Supplier', 'Destination', 'HOBL', 'E.T.A',
    'Client Reference', 'Chargeable Wt.',
  ];

  // Find where labels start (look for "Importer" line)
  let labelStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Importer$/i.test(lines[i].trim())) { labelStartIdx = i; break; }
  }

  // Build label positions (relative to labelStartIdx)
  const labelPositions: Record<string, number> = {};
  if (labelStartIdx >= 0) {
    let pos = 0;
    for (let i = labelStartIdx; i < lines.length && pos < DETAIL_LABELS.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Check if this line matches any expected label
      for (const lbl of DETAIL_LABELS) {
        if (line.toLowerCase().startsWith(lbl.toLowerCase())) {
          labelPositions[lbl] = pos;
          pos++;
          break;
        }
      }
      // If we hit CHARGES section, stop
      if (/^CHARGES$/i.test(line)) break;
    }
  }

  // Find where values start — look for the address block (after "VAT No.:" value)
  // Values start after the "To:" address block. Find the first value by looking for
  // a line that matches "AFRICAN FOOD INDUSTRIES" or the importer name pattern
  // Actually simpler: values start right after the charge header line "DescriptionVAT Code..."
  // and begin at the first non-header value line.
  // From the raw text, values start at the line with the importer name.

  // Find value block: first line that looks like an importer/company name after the address
  let valueStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{10}$/.test(lines[i].trim())) {
      // VAT number line — values start right after
      valueStartIdx = i + 1;
      break;
    }
  }

  const getFieldByPosition = (label: string): string | null => {
    const pos = labelPositions[label];
    if (pos == null || valueStartIdx < 0) return null;
    const idx = valueStartIdx + pos;
    if (idx < lines.length) {
      const val = lines[idx]?.trim();
      if (val && !val.startsWith('ZAR')) return val;
    }
    return null;
  };

  const importer = getFieldByPosition('Importer');
  const origin = getFieldByPosition('Origin');
  const supplier = getFieldByPosition('Supplier');
  const destination = getFieldByPosition('Destination');
  const clientReference = getFieldByPosition('Client Reference');

  // Vessel: "CHIBA C  (Voy. No: 091W)"
  let vessel: string | null = null;
  let voyageNumber: string | null = null;
  const vesselField = getFieldByPosition('Vessel');
  if (vesselField) {
    const voyMatch = vesselField.match(/(.+?)\s*\(?Voy\.?\s*(?:No\.?)?[:\s]*([A-Z0-9]+)\)?/i);
    if (voyMatch) {
      vessel = voyMatch[1].trim();
      voyageNumber = voyMatch[2].trim();
    } else {
      vessel = vesselField;
    }
  }

  // MOBL — use position first, then carrier prefix fallback
  let mobl = getFieldByPosition('MOBL');
  // Validate MOBL looks like a BOL number (not another label or garbage)
  if (mobl && /^(S\.O\.B|E\.T\.A|No\.|Gross|Volume|Supplier|Destination|HOBL)/i.test(mobl)) {
    mobl = null;
  }

  // HOBL — may be empty on the invoice (shifts subsequent positions)
  let hobl: string | null = null;
  const hoblField = getFieldByPosition('HOBL');
  if (hoblField && !/^(E\.T\.A|\d{4}\/|Client|Charge)/i.test(hoblField)) {
    hobl = hoblField;
  }

  // Fallback: scan for carrier prefix if MOBL didn't match
  if (!mobl) {
    const prefixPat = new RegExp(`((?:${CARRIER_BOL_PREFIXES.join('|')})[A-Z0-9]{6,14})`, 'i');
    const carrierMatch = text.match(prefixPat);
    if (carrierMatch) mobl = carrierMatch[1].toUpperCase();
  }

  // S.O.B. date
  const sobField = getFieldByPosition('S.O.B.');
  const sobDate = sobField ? parseAgxDate(sobField) : null;

  // ETA
  const etaField = getFieldByPosition('E.T.A');
  const eta = etaField ? parseAgxDate(etaField) : null;

  // Packages
  const pkgField = getFieldByPosition('No. of Packages');
  const packages = pkgField ? parseInt(pkgField) || null : null;

  // Gross mass
  const massField = getFieldByPosition('Gross Mass (kg)');
  const grossMass = massField ? parseZarAmount(massField) : null;

  // Volume
  const volField = getFieldByPosition('Volume');
  const volume = volField ? parseZarAmount(volField) : null;

  // Chargeable weight
  const cwField = getFieldByPosition('Chargeable Wt.');
  const chargeableWeight = cwField ? parseZarAmount(cwField) : null;

  // Container numbers: "KKFU-7905025 40GP" or "KKFU790502540GP"
  // Look in "Cont. No(s):" section or standalone container patterns
  // Avoid matching inside BOL numbers (e.g., ONEYPKGF84728500)
  const containerNumbers: string[] = [];
  let containerType: string | null = null;

  // First try the Cont. No(s) section
  const contSection = text.match(/Cont\.?\s*No\(?s?\)?\s*:?\s*\n?(.+)/i);
  if (contSection) {
    const contLine = contSection[1];
    const cm = contLine.match(/([A-Z]{4})[\-\s]?(\d{7})\s*(20\s*GP|40\s*GP|40\s*HC|40\s*HQ)?/i);
    if (cm) {
      containerNumbers.push(`${cm[1]}${cm[2]}`.toUpperCase());
      if (cm[3]) {
        containerType = cm[3].replace(/\s/g, '').toUpperCase();
        if (containerType === '40HQ') containerType = '40HC';
      }
    }
  }

  // Fallback: scan for container patterns that start with known container prefixes
  // (4 letters ending in U for standard ISO containers, e.g., KKFU, TCLU, MRKU)
  if (containerNumbers.length === 0) {
    const contMatches = text.matchAll(/\b([A-Z]{3}U)[\-\s]?(\d{7})\s*(20\s*GP|40\s*GP|40\s*HC|40\s*HQ)?/gi);
    for (const cm of contMatches) {
      const num = `${cm[1]}${cm[2]}`.toUpperCase();
      if (!containerNumbers.includes(num)) containerNumbers.push(num);
      if (cm[3] && !containerType) {
        containerType = cm[3].replace(/\s/g, '').toUpperCase();
        if (containerType === '40HQ') containerType = '40HC';
      }
    }
  }

  // === Charges table ===
  // AGX pdf-parse extracts charge lines in reverse column order:
  //   "ZAR142,326.75CUSTOMS VATN1.00000"           (N = no VAT: ZAR + amount + desc + vatCode + roe)
  //   "ZAR5,430.00814.50UNPACK / REPACK...S1.00000" (S = with VAT: ZAR + amount + vatAmt + desc + vatCode + roe)
  const charges: ClearingChargeLine[] = [];

  // Find all charge lines starting with "ZAR" followed by an amount
  const chargeLinePattern = /ZAR([\d,]+\.\d{2})([\d,]+\.\d{2})?(.+?)(S|N|Z)(\d+\.\d+)/g;
  let chargeMatch;
  while ((chargeMatch = chargeLinePattern.exec(text)) !== null) {
    const localAmount = parseZarAmount(chargeMatch[1]);
    const possibleVat = chargeMatch[2] ? parseZarAmount(chargeMatch[2]) : null;
    let description = chargeMatch[3].trim();
    const vatCode = chargeMatch[4];
    const roe = parseFloat(chargeMatch[5]);

    // For S (standard VAT) lines, possibleVat is the VAT amount
    // For N (no VAT) lines, possibleVat is null and description may include extra text
    let vatAmount: number | null = null;
    if (vatCode === 'S' && possibleVat != null) {
      vatAmount = possibleVat;
    } else if (vatCode === 'N' && possibleVat != null) {
      // The "VAT amount" was actually part of the description — prepend it back
      description = chargeMatch[2] + description;
    }

    // Skip header/noise
    if (/^Description|^VAT Code|^Foreign/i.test(description)) continue;

    charges.push({
      description,
      vat_code: vatCode,
      roe,
      foreign_amount: null,
      local_amount: localAmount,
      vat_amount: vatAmount,
    });
  }

  // === Totals ===
  // AGX column extraction order:
  //   line: "123,921.59"             ← subtotal value
  //   line: "Foreign Currency..."
  //   line: "TOTAL AMOUNT DUE :"
  //   line: "149,054.43VAT :"        ← VAT value concatenated with label
  //   line: "SUBTOTAL (EXCL VAT) :"
  //   line: "272,976.02"             ← total value
  const subtotalMatch = text.match(/([\d,]+\.\d{2})\s*\n\s*Foreign\s*Currency/i);
  const subtotal = subtotalMatch ? parseZarAmount(subtotalMatch[1]) : null;

  const vatTotalMatch = text.match(/([\d,]+\.\d{2})\s*VAT\s*:/i);
  const vat = vatTotalMatch ? parseZarAmount(vatTotalMatch[1]) : null;

  // Total is the line after "SUBTOTAL (EXCL VAT) :"
  const totalIdx = lines.findIndex(l => /SUBTOTAL\s*\(EXCL\s*VAT\)/i.test(l));
  let total: number | null = null;
  if (totalIdx >= 0 && totalIdx + 1 < lines.length) {
    total = parseZarAmount(lines[totalIdx + 1].trim());
  }
  if (!total) {
    // Fallback: find largest amount in the totals section
    const totalMatch = text.match(/TOTAL\s*AMOUNT\s*DUE[\s\S]{0,200}?([\d,]+\.\d{2})\s*\n\s*ZAR/i);
    if (totalMatch) total = parseZarAmount(totalMatch[1]);
  }

  logInfo(`Clearing invoice parsed: invoice=${invoiceNumber || 'unknown'}, MOBL=${mobl || 'unknown'}, charges=${charges.length}, total=R${total || 'unknown'}`);

  return {
    invoice_number: invoiceNumber,
    account_no: accountNo,
    invoice_date: invoiceDate,
    due_date: dueDate,
    file_ref: fileRef,
    importer,
    origin,
    vessel,
    voyage_number: voyageNumber,
    mobl,
    hobl,
    sob_date: sobDate,
    eta,
    supplier,
    destination,
    packages,
    gross_mass: grossMass,
    volume,
    chargeable_weight: chargeableWeight,
    container_numbers: containerNumbers,
    container_type: containerType,
    client_reference: clientReference,
    charges,
    subtotal,
    vat,
    total,
    raw_text: text.substring(0, 8000),
  };
}

/**
 * Parse AGX rate sheet PDF into clearing rate benchmark entries
 */
export interface ClearingRateEntry {
  description: string;
  per_type: string;
  unit_rate_zar: number;
  vat_amount: number | null;
  category: string;
  route: string | null;
}

export async function parseAgxRateSheet(pdfBuffer: Buffer): Promise<ClearingRateEntry[]> {
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text;
  const entries: ClearingRateEntry[] = [];

  // Detect sections
  let currentCategory = 'transport';
  const lines = text.split('\n');

  for (const line of lines) {
    if (/DESTINATION\s+CHARGES/i.test(line)) { currentCategory = 'destination'; continue; }
    if (/CAPE\s+TOWN\s+OFFSITE|WAREHOUSE/i.test(line)) { currentCategory = 'warehouse'; continue; }
    if (/^RATE\s+DESCRIPTION|^Payment\s+Terms|^REMARKS|^GENERAL|^ALL\s+BUSINESS/i.test(line.trim())) continue;

    // Match rate lines: "description ... QUANTITY ... ZAR amount ... ZAR vat ... ZAR subtotal"
    // Or: "LOCAL CARTAGE: CPT TO KLAPMUTS PER CONTAINER < 20 TON 1 ZAR 6970,00 ZAR 1 045,50 ZAR 6 970,00"
    const rateMatch = line.match(
      /^(.{15,}?)(PER\s+[A-Z][A-Z\s<>0-9]+?)\s+(\d+)\s+ZAR\s+([\d\s,]+\.\d{2})\s+ZAR\s+([\d\s,\-]+\.\?\d{0,2}|[\d\s,]+\.\d{2}|-)\s+ZAR\s+([\d\s,]+\.\d{2}|-|TBC)/i
    );
    if (rateMatch) {
      const desc = rateMatch[1].trim();
      const perType = rateMatch[2].trim().toLowerCase();
      const price = parseZarAmount(rateMatch[4].replace(/\s/g, ''));
      if (desc && price && price > 0) {
        // Extract route from description if present
        let route: string | null = null;
        const routeMatch = desc.match(/:\s*(.+?)$/);
        if (routeMatch) route = routeMatch[1].trim();

        entries.push({
          description: desc,
          per_type: perType,
          unit_rate_zar: price,
          vat_amount: parseZarAmount((rateMatch[5] || '').replace(/\s/g, '')),
          category: currentCategory,
          route,
        });
      }
      continue;
    }

    // Simpler pattern for destination charges: "DESCRIPTION ... ZAR amount"
    const simpleRate = line.match(/^(.{10,}?)\s+(?:PER\s+)?(\w[\w\s<>]*?)\s+\d+\s+ZAR\s+([\d\s,]+,\d{2})/i);
    if (simpleRate) {
      const desc = simpleRate[1].trim();
      const price = parseZarAmount(simpleRate[3].replace(/\s/g, '').replace(/,(\d{2})$/, '.$1'));
      if (desc && price && price > 0 && !/^RATE|^MODE|^FILE/i.test(desc)) {
        entries.push({
          description: desc,
          per_type: simpleRate[2].trim().toLowerCase(),
          unit_rate_zar: price,
          vat_amount: null,
          category: currentCategory,
          route: null,
        });
      }
    }
  }

  // If line-by-line didn't work well, use known AGX rate sheet patterns
  // AGX rate sheet uses European number format: "6970,00" (comma = decimal)
  // PDF text concatenates price+VAT: "ZAR360,0054,00ZAR" = price 360,00 + vat 54,00
  // Capture pattern: ZAR then digits + comma + exactly 2 digits (European format)
  if (entries.length < 3) {
    const knownRates = [
      { pat: /LOCAL\s+CARTAGE:\s*CPT\s+TO\s+KLAPMUTS\s*PER\s+CONTAINER\s*<\s*20\s*TON.*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: CPT TO KLAPMUTS', per: 'per container < 20 ton', cat: 'transport' },
      { pat: /LOCAL\s+CARTAGE:\s*CPT\s+TO\s+KLAPMUTS\s*PER\s+CONTAINER\s*21[\-–]28\s*TON.*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: CPT TO KLAPMUTS 21-28 TON', per: 'per container 21-28 ton', cat: 'transport' },
      { pat: /LOCAL\s+CARTAGE:\s*CPT\s+TO\s+KLAPMUTS\s*PER\s+SUPERLINK.*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: CPT TO KLAPMUTS SUPERLINK', per: 'per superlink', cat: 'transport' },
      { pat: /LOCAL\s+CARTAGE:\s*CPT\s+PORT\s+TO\s+MONTAGUE.*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: CPT PORT TO MONTAGUE GARDENS', per: 'per container < 20 ton', cat: 'transport' },
      { pat: /TRANSPORT:\s*DBN\s+PORT\s+TO\s+PRETORIA\s*PER\s+20FT.*?ZAR(\d+,\d{2})/i, desc: 'TRANSPORT: DBN PORT TO PRETORIA PER 20FT', per: 'per 20ft container', cat: 'transport' },
      { pat: /TRANSPORT:\s*DBN\s+PORT\s+TO\s+PRETORIA\s*PER\s+40FT.*?ZAR(\d+,\d{2})/i, desc: 'TRANSPORT: DBN PORT TO PRETORIA PER 40FT', per: 'per 40ft container', cat: 'transport' },
      { pat: /TRANSPORT:\s*DBN\s+PORT\s+TO\s+WHS.*?ZAR(\d+,\d{2})/i, desc: 'TRANSPORT: DBN PORT TO WHS', per: 'per container', cat: 'transport' },
      { pat: /UNPACK\s*\/?\s*RELOAD\s.*?ZAR(\d+,\d{2})/i, desc: 'UNPACK / RELOAD', per: 'per container', cat: 'transport' },
      { pat: /CARTAGE:\s*DBN\s+WHS\s+TO\s+PRETORIA[\s\S]*?OPTION\s+A[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: DBN WHS TO PRETORIA TAUTLINER A', per: 'per tautliner', cat: 'transport' },
      { pat: /CARTAGE:\s*DBN\s+WHS\s+TO\s+PRETORIA[\s\S]*?OPTION\s+B[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: DBN WHS TO PRETORIA TAUTLINER B', per: 'per tautliner', cat: 'transport' },
      { pat: /CARTAGE:\s*DBN\s+WHS\s+TO\s+PRETORIA\s*PER\s+6M.*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: DBN WHS TO PRETORIA 6M DECKSPACE', per: 'per 6m deckspace', cat: 'transport' },
      { pat: /CARTAGE:\s*DBN\s+WHS\s+TO\s+PRETORIA[\s\S]*?12M.*?ZAR(\d+,\d{2})/i, desc: 'LOCAL CARTAGE: DBN WHS TO PRETORIA 12M DECKSPACE', per: 'per 12m deckspace', cat: 'transport' },
      { pat: /CTO\s+FEE.*?ZAR(\d+,\d{2})/i, desc: 'CTO FEE', per: 'per container', cat: 'destination' },
      { pat: /PORT\s+HEALTH\s+INSPECTION.*?ZAR(\d+,\d{2})/i, desc: 'PORT HEALTH INSPECTION', per: 'per hour', cat: 'destination' },
      { pat: /DAFF\s+INSPECTION.*?ZAR(\d+,\d{2})/i, desc: 'DAFF INSPECTION', per: 'per hour', cat: 'destination' },
      { pat: /STATE\s+VET\s+CANCELLATION.*?ZAR(\d+,\d{2})/i, desc: 'STATE VET CANCELLATION FEE', per: 'per container', cat: 'destination' },
      { pat: /CUSTOMS\s+DECLARATION.*?ZAR(\d+,\d{2})/i, desc: 'CUSTOMS DECLARATION', per: 'per declaration', cat: 'destination' },
      { pat: /AGENCY\s+FEE.*?ZAR(\d+,\d{2})/i, desc: 'AGENCY FEE', per: 'per shipment @ 3.5% min R1187', cat: 'destination' },
      { pat: /CARGO\s+DUES\s*PER\s+20FT.*?ZAR(\d+,\d{2})/i, desc: 'CARGO DUES 20FT', per: 'per 20ft container', cat: 'destination' },
      { pat: /CARGO\s+DUES\s*PER\s+40FT.*?ZAR(\d+,\d{2})/i, desc: 'CARGO DUES 40FT', per: 'per 40ft container', cat: 'destination' },
      { pat: /CONTAINER\s+UNPACKING\s+CHARGES[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'CONTAINER UNPACKING CHARGES', per: 'per container', cat: 'warehouse' },
      { pat: /STORAGE\s+PER\s+PER\s+PALLET\s*R43[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'STORAGE PER PALLET (WEEK 1)', per: 'per pallet per week', cat: 'warehouse' },
      { pat: /STORAGE\s+PER\s+PER\s+PALLET\s*R53[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'STORAGE PER PALLET (WEEK 2+)', per: 'per pallet per week', cat: 'warehouse' },
      { pat: /WMS\s+LOGGING[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'WMS LOGGING', per: 'per pallet', cat: 'warehouse' },
      { pat: /HANDLING[\s\S]*?RELEASE\s+COSTS[\s\S]*?ZAR(\d+,\d{2})/i, desc: 'HANDLING/RELEASE COSTS', per: 'per pallet', cat: 'warehouse' },
    ];

    entries.length = 0; // clear any partial results
    for (const { pat, desc, per, cat } of knownRates) {
      const m = text.match(pat);
      if (m) {
        // European format: "6970,00" → replace comma decimal → "6970.00"
        const amount = m[1].replace(',', '.');
        const price = parseFloat(amount);
        if (!isNaN(price) && price > 0) {
          entries.push({ description: desc, per_type: per, unit_rate_zar: price, vat_amount: null, category: cat, route: null });
        }
      }
    }
  }

  logInfo(`AGX rate sheet parsed: ${entries.length} rate entries found`);
  return entries;
}
