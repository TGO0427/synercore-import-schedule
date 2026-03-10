/**
 * Rate Sheet Parser
 * Extracts freight benchmark rates from uploaded Excel files.
 * Supports two formats:
 *   1. Grouped format: port name as section header, then carrier rows with 20GP/40GP/40HC columns
 *   2. Flat template format: one row per rate with POL, POD, Carrier, 20GP, 40GP, 40HC columns
 */

import { logInfo, logWarn } from '../utils/logger.js';

export interface ExtractedRate {
  port_of_loading: string;
  port_of_discharge: string;
  rate_per_kg_usd: number | null;
  rate_20gp_usd: number | null;
  rate_40gp_usd: number | null;
  rate_40hc_usd: number | null;
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
  'port kelang': 'Port Kelang', 'port klang': 'Port Kelang', 'kelang': 'Port Kelang',
  'jakarta': 'Jakarta', 'tanjung priok': 'Jakarta',
  'tianjin': 'Tianjin', 'xingang': 'Tianjin', 'tianjin / xingang': 'Tianjin',
  'dalian': 'Dalian',
  'gebze': 'Gebze',
  'xiamen': 'Xiamen',
  'yantian': 'Yantian',
  'ho chi minh': 'Ho Chi Minh', 'hcmc': 'Ho Chi Minh',
  'bangkok': 'Bangkok', 'laem chabang': 'Laem Chabang',
  'chennai': 'Chennai', 'colombo': 'Colombo',
};

const KNOWN_PORTS = [...new Set(Object.values(PORT_ALIASES))];

function normalizePort(raw: string): string {
  const cleaned = raw.trim().replace(/[^\w\s\-\/]/g, '').toLowerCase();
  return PORT_ALIASES[cleaned] || raw.trim().replace(/\s+/g, ' ');
}

function isPortName(text: string): boolean {
  const normalized = normalizePort(text);
  return KNOWN_PORTS.some(p => p.toLowerCase() === normalized.toLowerCase());
}

// ─── Excel Parser ───

export async function parseExcelRateSheet(buffer: Buffer, filename: string): Promise<ExtractedRate[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let rates: ExtractedRate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) continue;

    // Try flat template format first (has POL + POD columns)
    const flatRates = parseFlatFormat(rows, sheetName, filename);
    if (flatRates.length > 0) {
      rates.push(...flatRates);
      logInfo(`Sheet "${sheetName}": flat format — ${flatRates.length} rates`);
      continue;
    }

    // Try grouped format (port sections with 20GP/40GP/40HC headers)
    const groupedRates = parseGroupedFormat(rows, sheetName, filename);
    if (groupedRates.length > 0) {
      rates.push(...groupedRates);
      logInfo(`Sheet "${sheetName}": grouped format — ${groupedRates.length} rates`);
      continue;
    }

    logWarn(`Sheet "${sheetName}": could not detect rate format, skipping`);
  }

  logInfo(`Rate sheet parsed: ${rates.length} rates extracted from ${filename}`);
  return rates;
}

// ─── Flat Template Format ───
// POL | POD | Rate/kg | 20GP | 40GP | 40HC | Carrier | Mode | Valid From | Valid Until | Notes

function parseFlatFormat(rows: any[][], sheetName: string, filename: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Find header row with POL + POD columns
  let headerIdx = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c: any) => String(c).toLowerCase().trim());
    const mapped = detectFlatColumns(row);
    if (mapped.pol >= 0 && mapped.pod >= 0 && (mapped.rateKg >= 0 || mapped.rate20gp >= 0 || mapped.rate40gp >= 0 || mapped.rate40hc >= 0)) {
      headerIdx = i;
      colMap = mapped;
      break;
    }
  }

  if (headerIdx < 0) return [];

  const carrierName = detectCarrier(sheetName, rows.slice(0, 5));
  const mode = detectMode(sheetName, rows.slice(0, 5));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const pol = String(row[colMap.pol] || '').trim();
    const pod = String(row[colMap.pod] || '').trim();

    if (!pol || !pod || pol.length < 2 || pod.length < 2) continue;
    if (['total', 'subtotal', 'average', 'notes', 'terms'].some(w => pol.toLowerCase().includes(w))) continue;

    const rateKg = parseRate(row[colMap.rateKg]);
    const rate20gp = parseRate(row[colMap.rate20gp]);
    const rate40gp = parseRate(row[colMap.rate40gp]);
    const rate40hc = parseRate(row[colMap.rate40hc]);

    if (rateKg === null && rate20gp === null && rate40gp === null && rate40hc === null) continue;

    let validFrom: string | null = null;
    let validUntil: string | null = null;
    if (colMap.validFrom >= 0) validFrom = parseExcelDate(row[colMap.validFrom]);
    if (colMap.validUntil >= 0) validUntil = parseExcelDate(row[colMap.validUntil]);

    const rowCarrier = colMap.carrier >= 0 ? String(row[colMap.carrier] || '').trim() : '';
    const rowMode = colMap.mode >= 0 ? String(row[colMap.mode] || '').trim().toLowerCase() : '';
    const rowNotes = colMap.notes >= 0 ? String(row[colMap.notes] || '').trim() : '';

    rates.push({
      port_of_loading: normalizePort(pol),
      port_of_discharge: normalizePort(pod),
      rate_per_kg_usd: rateKg,
      rate_20gp_usd: rate20gp,
      rate_40gp_usd: rate40gp,
      rate_40hc_usd: rate40hc,
      carrier_name: rowCarrier || carrierName,
      transport_mode: (['sea', 'air', 'road'].includes(rowMode) ? rowMode : mode) as string,
      valid_from: validFrom,
      valid_until: validUntil,
      notes: rowNotes || `Imported from ${filename}, sheet: ${sheetName}`,
    });
  }

  return rates;
}

// ─── Grouped Section Format ───
// Port name as section header, then header row with 20GP/40GP/40HC,
// then carrier rows with rates. POD defaults to Durban.

function parseGroupedFormat(rows: any[][], sheetName: string, filename: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];
  const mode = detectMode(sheetName, rows.slice(0, 5));

  // Default POD — Synercore imports to Durban
  const defaultPod = 'Durban';

  let currentPort: string | null = null;
  let colMap: { carrier: number; gp20: number; gp40: number; hc40: number } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.map((c: any) => String(c).trim());

    // Check if this row is a container-type header (20GP, 40GP, 40HC)
    const headerCheck = detectContainerHeader(cells);
    if (headerCheck) {
      // The port name is usually in the row above or in the same row's first cell
      // or a couple rows above
      const portName = findPortAbove(rows, i) || findPortInRow(cells);
      if (portName) {
        currentPort = normalizePort(portName);
        colMap = headerCheck;
        logInfo(`Detected port section: ${currentPort} at row ${i + 1}`);
      }
      continue;
    }

    // If we have a current port and column map, try to parse rate rows
    if (currentPort && colMap) {
      const carrierCell = String(row[colMap.carrier] || '').trim();
      if (!carrierCell || carrierCell.length < 2) continue;

      // Skip if this looks like another port header or section break
      if (isPortName(carrierCell)) {
        currentPort = normalizePort(carrierCell);
        continue;
      }
      if (['total', 'subtotal', 'average', '20gp', '40gp', '40hc'].some(w => carrierCell.toLowerCase() === w)) continue;

      const rate20gp = parseRate(row[colMap.gp20]);
      const rate40gp = parseRate(row[colMap.gp40]);
      const rate40hc = parseRate(row[colMap.hc40]);

      if (rate20gp === null && rate40gp === null && rate40hc === null) {
        // No rates — might be end of section
        colMap = null;
        continue;
      }

      rates.push({
        port_of_loading: currentPort,
        port_of_discharge: defaultPod,
        rate_per_kg_usd: null,
        rate_20gp_usd: rate20gp,
        rate_40gp_usd: rate40gp,
        rate_40hc_usd: rate40hc,
        carrier_name: carrierCell,
        transport_mode: mode,
        valid_from: null,
        valid_until: null,
        notes: `Imported from ${filename}, sheet: ${sheetName}`,
      });
    }
  }

  return rates;
}

/**
 * Detect a row that contains container type headers (20GP, 40GP, 40HC)
 * Returns column positions or null if not a header row
 */
function detectContainerHeader(cells: string[]): { carrier: number; gp20: number; gp40: number; hc40: number } | null {
  let gp20 = -1, gp40 = -1, hc40 = -1;

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/^20(gp|ft|dc)?$/.test(c)) gp20 = i;
    else if (/^40(gp|ft|dc)?$/.test(c)) gp40 = i;
    else if (/^40hc$|^40hq$/.test(c)) hc40 = i;
  }

  // Need at least 20GP and one of 40GP/40HC
  if (gp20 >= 0 && (gp40 >= 0 || hc40 >= 0)) {
    // Carrier column is the first column (usually col 0) before the rate columns
    const carrier = Math.min(...[gp20, gp40, hc40].filter(n => n >= 0)) > 0 ? 0 : -1;
    // If carrier couldn't be determined, skip
    if (carrier < 0) return null;
    return { carrier, gp20, gp40: gp40 >= 0 ? gp40 : -1, hc40: hc40 >= 0 ? hc40 : -1 };
  }

  return null;
}

/**
 * Look at the rows above a container header to find the port name
 */
function findPortAbove(rows: any[][], headerRowIdx: number): string | null {
  // Check up to 3 rows above
  for (let offset = 1; offset <= 3 && headerRowIdx - offset >= 0; offset++) {
    const row = rows[headerRowIdx - offset];
    for (const cell of row) {
      const text = String(cell).trim();
      if (text.length >= 3 && isPortName(text)) return text;
    }
  }
  return null;
}

/**
 * Check if any cell in the row is a port name (for merged-cell layouts)
 */
function findPortInRow(cells: string[]): string | null {
  for (const cell of cells) {
    if (cell.length >= 3 && isPortName(cell)) return cell;
  }
  return null;
}

// ─── Column Detection (Flat Format) ───

function detectFlatColumns(headerRow: string[]): Record<string, number> {
  const result: Record<string, number> = {
    pol: -1, pod: -1, rateKg: -1, rate20gp: -1, rate40gp: -1, rate40hc: -1,
    validFrom: -1, validUntil: -1, carrier: -1, mode: -1, notes: -1
  };

  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i];
    if (!h) continue;

    if (/origin|pol|port\s*of\s*load|loading|from|departure/.test(h)) result.pol = i;
    else if (/dest|pod|port\s*of\s*dis|discharge|to|arrival/.test(h)) result.pod = i;
    else if (/rate.*kg|per.*kg|usd.*kg|kg.*rate|freight.*kg/.test(h)) result.rateKg = i;
    else if (/20\s*gp|20\s*fcl|20.*ft|20.*container/.test(h)) result.rate20gp = i;
    else if (/40\s*gp|40\s*fcl|40.*ft|40.*container/.test(h)) result.rate40gp = i;
    else if (/40\s*hc|40\s*hq/.test(h)) result.rate40hc = i;
    else if (/valid\s*from|effective|start\s*date/.test(h)) result.validFrom = i;
    else if (/valid\s*(?:to|until)|expir|end\s*date/.test(h)) result.validUntil = i;
    else if (/^carrier$|carrier\s*name|forwarder|freight\s*agent/.test(h)) result.carrier = i;
    else if (/^mode$|transport\s*mode|ship.*mode|freight\s*mode/.test(h)) result.mode = i;
    else if (/^notes$|remarks|comment/.test(h)) result.notes = i;
  }

  return result;
}

// ─── Shared Helpers ───

function detectCarrier(sheetName: string, headerRows: any[][]): string | null {
  const text = [sheetName, ...headerRows.map(r => r.join(' '))].join(' ').toLowerCase();
  const carriers = [
    { patterns: ['dhl', 'dhl global', 'dhl freight'], name: 'DHL' },
    { patterns: ['dsv', 'dsv panalpina'], name: 'DSV' },
    { patterns: ['afrigistics'], name: 'Afrigistics' },
    { patterns: ['maersk'], name: 'Maersk' },
    { patterns: ['msc special', 'msc standard', 'mediterranean shipping'], name: 'MSC' },
    { patterns: ['cma cgm', 'cma-cgm'], name: 'CMA CGM' },
    { patterns: ['hapag', 'hapag-lloyd'], name: 'Hapag-Lloyd' },
    { patterns: ['evergreen'], name: 'Evergreen' },
    { patterns: ['cosco'], name: 'COSCO' },
    { patterns: ['ocean network express'], name: 'ONE' },
  ];
  for (const c of carriers) {
    if (c.patterns.some(p => text.includes(p))) return c.name;
  }
  return null;
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
