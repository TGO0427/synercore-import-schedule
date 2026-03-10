/**
 * Rate Sheet Parser
 * Extracts freight benchmark rates from uploaded PDF or Excel files.
 * Supports tabular rate sheets from forwarders (DHL, DSV, Afrigistics, etc.)
 */

import { logInfo, logWarn } from '../utils/logger.js';

export interface ExtractedRate {
  port_of_loading: string;
  port_of_discharge: string;
  rate_per_kg_usd: number | null;
  rate_per_cbm_usd: number | null;
  min_charge_usd: number | null;
  carrier_name: string | null;
  transport_mode: string;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
}

// ─── Common port name normalization ───

const PORT_ALIASES: Record<string, string> = {
  'dbn': 'Durban', 'durban': 'Durban', 'dur': 'Durban',
  'cpt': 'Cape Town', 'cape town': 'Cape Town', 'capetown': 'Cape Town',
  'jnb': 'Johannesburg', 'johannesburg': 'Johannesburg', 'jhb': 'Johannesburg',
  'pta': 'Pretoria', 'pretoria': 'Pretoria',
  'sha': 'Shanghai', 'shanghai': 'Shanghai',
  'ningbo': 'Ningbo', 'ngb': 'Ningbo',
  'shenzhen': 'Shenzhen', 'szx': 'Shenzhen',
  'guangzhou': 'Guangzhou', 'can': 'Guangzhou',
  'qingdao': 'Qingdao', 'tao': 'Qingdao',
  'mumbai': 'Mumbai', 'nhava sheva': 'Mumbai', 'bom': 'Mumbai',
  'istanbul': 'Istanbul', 'ist': 'Istanbul', 'mersin': 'Mersin',
  'rotterdam': 'Rotterdam', 'rtm': 'Rotterdam',
  'hamburg': 'Hamburg', 'ham': 'Hamburg',
  'singapore': 'Singapore', 'sin': 'Singapore',
  'hong kong': 'Hong Kong', 'hkg': 'Hong Kong',
  'busan': 'Busan', 'pus': 'Busan',
  'maputo': 'Maputo', 'mpm': 'Maputo',
  'dar es salaam': 'Dar es Salaam', 'dar': 'Dar es Salaam',
  'mombasa': 'Mombasa', 'mba': 'Mombasa',
  'beira': 'Beira',
};

function normalizePort(raw: string): string {
  const cleaned = raw.trim().replace(/[^\w\s\-]/g, '').toLowerCase();
  return PORT_ALIASES[cleaned] || raw.trim().replace(/\s+/g, ' ');
}

// ─── Excel Parser ───

export async function parseExcelRateSheet(buffer: Buffer, filename: string): Promise<ExtractedRate[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const rates: ExtractedRate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) continue;

    // Find header row — look for columns containing port/origin/destination/rate keywords
    let headerIdx = -1;
    let colMap: Record<string, number> = {};

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i].map((c: any) => String(c).toLowerCase().trim());
      const mapped = detectColumns(row);
      if (mapped.pol >= 0 && mapped.pod >= 0 && (mapped.rateKg >= 0 || mapped.rateCbm >= 0 || mapped.rate >= 0)) {
        headerIdx = i;
        colMap = mapped as any;
        break;
      }
    }

    if (headerIdx < 0) {
      logWarn(`Sheet "${sheetName}": could not detect rate columns, skipping`);
      continue;
    }

    logInfo(`Sheet "${sheetName}": detected columns at row ${headerIdx + 1}`);

    // Detect carrier from sheet name or first rows
    const carrierName = detectCarrier(sheetName, rows.slice(0, 5));
    const mode = detectMode(sheetName, rows.slice(0, 5));

    // Parse data rows
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const pol = String(row[colMap.pol] || '').trim();
      const pod = String(row[colMap.pod] || '').trim();

      if (!pol || !pod || pol.length < 2 || pod.length < 2) continue;

      // Skip total/summary rows
      const polLower = pol.toLowerCase();
      if (['total', 'subtotal', 'average', 'notes', 'terms', 'conditions'].some(w => polLower.includes(w))) continue;

      const rateKg = parseRate(row[colMap.rateKg]);
      const rateCbm = parseRate(row[colMap.rateCbm]);
      const genericRate = parseRate(row[colMap.rate]);
      const minCharge = parseRate(row[colMap.minCharge]);

      // Need at least one rate
      if (rateKg === null && rateCbm === null && genericRate === null) continue;

      let validFrom: string | null = null;
      let validUntil: string | null = null;
      if (colMap.validFrom >= 0) validFrom = parseExcelDate(row[colMap.validFrom]);
      if (colMap.validUntil >= 0) validUntil = parseExcelDate(row[colMap.validUntil]);

      // Per-row carrier/mode override sheet-level detection
      const rowCarrier = colMap.carrier >= 0 ? String(row[colMap.carrier] || '').trim() : '';
      const rowMode = colMap.mode >= 0 ? String(row[colMap.mode] || '').trim().toLowerCase() : '';
      const rowNotes = colMap.notes >= 0 ? String(row[colMap.notes] || '').trim() : '';

      rates.push({
        port_of_loading: normalizePort(pol),
        port_of_discharge: normalizePort(pod),
        rate_per_kg_usd: rateKg ?? genericRate,
        rate_per_cbm_usd: rateCbm,
        min_charge_usd: minCharge,
        carrier_name: rowCarrier || carrierName,
        transport_mode: (['sea', 'air', 'road'].includes(rowMode) ? rowMode : mode) as string,
        valid_from: validFrom,
        valid_until: validUntil,
        notes: rowNotes || `Imported from ${filename}, sheet: ${sheetName}`,
      });
    }
  }

  logInfo(`Rate sheet parsed: ${rates.length} rates extracted from ${filename}`);
  return rates;
}

// ─── PDF Parser ───

export async function parsePdfRateSheet(buffer: Buffer, filename: string): Promise<ExtractedRate[]> {
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(buffer);
  const text = pdfData.text;
  const rates: ExtractedRate[] = [];

  const carrierName = detectCarrierFromText(text);
  const mode = text.match(/\b(air\s*freight|air\s*cargo|airfreight)\b/i) ? 'air' : 'sea';

  // Strategy 1: Look for tabular patterns — lines with ports and numbers
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);

  // Try to find rate lines: "Shanghai - Durban  $0.085/kg" or "Shanghai  Durban  85  120  50"
  const rateLinePattern = /^([A-Z][A-Za-z\s\-\.]{2,30}?)[\s\-→>]+([A-Z][A-Za-z\s\-\.]{2,30}?)[\s:]+[\$]?([\d,\.]+)/i;
  const rateLinePattern2 = /([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{2,20})?)\s{2,}([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{2,20})?)\s{2,}([\d,\.]+)/;

  for (const line of lines) {
    let match = line.match(rateLinePattern) || line.match(rateLinePattern2);
    if (match) {
      const pol = match[1].trim();
      const pod = match[2].trim();
      const rateVal = parseRate(match[3]);

      if (!rateVal || rateVal <= 0) continue;
      const polLower = pol.toLowerCase();
      const podLower = pod.toLowerCase();

      // Reject common non-port words
      const REJECT_WORDS = [
        'total', 'subtotal', 'from', 'origin', 'port', 'notes', 'terms',
        'environmental', 'fee', 'charge', 'surcharge', 'adjustment', 'fuel',
        'currency', 'rate', 'description', 'service', 'type', 'code',
        'subject', 'effective', 'valid', 'conditions', 'general', 'special',
        'please', 'contact', 'note', 'important', 'additional', 'applicable',
        'minimum', 'maximum', 'weight', 'volume', 'transit', 'schedule',
        'amendment', 'revision', 'update', 'advisory', 'client', 'customer',
      ];
      if (REJECT_WORDS.some(w => polLower === w || podLower === w)) continue;

      // POL/POD must look like place names — reject if both are common English words
      const KNOWN_PORTS = Object.values(PORT_ALIASES);
      const polIsKnown = KNOWN_PORTS.some(p => p.toLowerCase() === polLower);
      const podIsKnown = KNOWN_PORTS.some(p => p.toLowerCase() === podLower);
      if (!polIsKnown && !podIsKnown) continue; // At least one must be a recognized port

      // Determine if rate is per kg or per CBM based on context
      const isPerKg = /per\s*kg|\/kg|usd\/kg/i.test(line) || rateVal < 1;
      const isPerCbm = /per\s*cbm|\/cbm|per\s*m3/i.test(line) || rateVal > 50;

      rates.push({
        port_of_loading: normalizePort(pol),
        port_of_discharge: normalizePort(pod),
        rate_per_kg_usd: isPerKg ? rateVal : null,
        rate_per_cbm_usd: isPerCbm ? rateVal : null,
        min_charge_usd: null,
        carrier_name: carrierName,
        transport_mode: mode,
        valid_from: null,
        valid_until: null,
        notes: `Imported from ${filename} (PDF)`,
      });
    }
  }

  // Strategy 2: Look for specific rate mentions
  const specificPatterns = [
    /(?:rate|freight|charge)\s*[:\s]*(?:USD|US\$|\$)\s*([\d,\.]+)\s*(?:per|\/)\s*(?:kg|kgs)/gi,
    /(?:USD|US\$|\$)\s*([\d,\.]+)\s*(?:per|\/)\s*(?:kg|kgs)/gi,
  ];

  // Extract any validity dates from the document
  const validMatch = text.match(/(?:valid|effective|validity)\s*(?:from|:)\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  const expiryMatch = text.match(/(?:valid\s+until|expiry|expires|valid\s+to)\s*[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);

  if (rates.length > 0 && (validMatch || expiryMatch)) {
    const validFrom = validMatch ? parseDateString(validMatch[1]) : null;
    const validUntil = expiryMatch ? parseDateString(expiryMatch[1]) : null;
    for (const rate of rates) {
      if (!rate.valid_from && validFrom) rate.valid_from = validFrom;
      if (!rate.valid_until && validUntil) rate.valid_until = validUntil;
    }
  }

  logInfo(`PDF rate sheet parsed: ${rates.length} rates extracted from ${filename}`);
  return rates;
}

// ─── Helpers ───

function detectColumns(headerRow: string[]): Record<string, number> {
  const result: Record<string, number> = { pol: -1, pod: -1, rateKg: -1, rateCbm: -1, rate: -1, minCharge: -1, validFrom: -1, validUntil: -1, carrier: -1, mode: -1, notes: -1 };

  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i];
    if (!h) continue;

    if (/origin|pol|port\s*of\s*load|loading|from|departure/.test(h)) result.pol = i;
    else if (/dest|pod|port\s*of\s*dis|discharge|to|arrival/.test(h)) result.pod = i;
    else if (/rate.*kg|per.*kg|usd.*kg|kg.*rate|freight.*kg/.test(h)) result.rateKg = i;
    else if (/rate.*cbm|per.*cbm|usd.*cbm|cbm.*rate|per.*m3/.test(h)) result.rateCbm = i;
    else if (/^rate$|freight\s*rate|ocean\s*freight|rate\s*usd|usd\s*rate|price/.test(h)) result.rate = i;
    else if (/min.*charge|minimum|min\s*rate/.test(h)) result.minCharge = i;
    else if (/valid\s*from|effective|start\s*date/.test(h)) result.validFrom = i;
    else if (/valid\s*(?:to|until)|expir|end\s*date/.test(h)) result.validUntil = i;
    else if (/^carrier$|carrier\s*name|forwarder|freight\s*agent/.test(h)) result.carrier = i;
    else if (/^mode$|transport\s*mode|ship.*mode|freight\s*mode/.test(h)) result.mode = i;
    else if (/^notes$|remarks|comment/.test(h)) result.notes = i;
  }

  return result;
}

function detectCarrier(sheetName: string, headerRows: any[][]): string | null {
  const text = [sheetName, ...headerRows.map(r => r.join(' '))].join(' ').toLowerCase();
  const carriers = [
    { patterns: ['dhl', 'dhl global', 'dhl freight'], name: 'DHL' },
    { patterns: ['dsv', 'dsv panalpina'], name: 'DSV' },
    { patterns: ['afrigistics'], name: 'Afrigistics' },
    { patterns: ['maersk'], name: 'Maersk' },
    { patterns: ['msc', 'mediterranean shipping'], name: 'MSC' },
    { patterns: ['cma cgm', 'cma-cgm'], name: 'CMA CGM' },
    { patterns: ['hapag', 'hapag-lloyd'], name: 'Hapag-Lloyd' },
    { patterns: ['evergreen'], name: 'Evergreen' },
    { patterns: ['cosco'], name: 'COSCO' },
    { patterns: ['one', 'ocean network express'], name: 'ONE' },
  ];
  for (const c of carriers) {
    if (c.patterns.some(p => text.includes(p))) return c.name;
  }
  return null;
}

function detectCarrierFromText(text: string): string | null {
  return detectCarrier('', [text.substring(0, 2000).split('\n').map(l => l)]);
}

function detectMode(sheetName: string, headerRows: any[][]): string {
  const text = [sheetName, ...headerRows.map(r => r.join(' '))].join(' ').toLowerCase();
  if (/air\s*freight|air\s*cargo|airfreight|air\s*rate/.test(text)) return 'air';
  if (/road|trucking|inland/.test(text)) return 'road';
  return 'sea';
}

function parseRate(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/[,$\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) || num < 0 ? null : num;
}

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  // Excel serial date number
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return parseDateString(String(val));
}

function parseDateString(text: string): string | null {
  if (!text) return null;
  try {
    const d = new Date(text);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}
