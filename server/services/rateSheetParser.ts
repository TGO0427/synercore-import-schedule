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

interface SectionInfo {
  port: string;
  carrierCol: number;
  gp20Col: number;
  gp40Col: number;
  hc40Col: number;
}

function parseGroupedFormat(rows: any[][], sheetName: string, filename: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];
  const mode = detectMode(sheetName, rows.slice(0, 5));
  const defaultPod = 'Durban';

  // Active sections — multiple can be active simultaneously (side-by-side layout)
  let activeSections: SectionInfo[] = [];
  // Pending ports found in a row, waiting for container headers in the next row
  let pendingPorts: { name: string; col: number }[] = [];

  logInfo(`Grouped format scan: ${rows.length} rows in sheet "${sheetName}"`);
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    logInfo(`  Row ${i}: ${JSON.stringify((rows[i] || []).slice(0, 10))}`);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const cells = row.map((c: any) => String(c).trim());

    // Detect ALL container header groups in this row (supports side-by-side sections)
    const headerGroups = detectAllContainerHeaders(cells);

    if (headerGroups.length > 0) {
      // Match each header group with a port name (from row above or pending ports)
      activeSections = [];
      for (const hg of headerGroups) {
        // Find port name for this group: check pending ports near this column, or look above
        let portName = findPortForGroup(pendingPorts, hg.gp20);
        if (!portName) portName = findPortAboveNearCol(rows, i, hg.gp20);
        if (portName) {
          activeSections.push({
            port: normalizePort(portName),
            carrierCol: hg.carrier,
            gp20Col: hg.gp20,
            gp40Col: hg.gp40,
            hc40Col: hg.hc40,
          });
          logInfo(`Port section: "${normalizePort(portName)}" at row ${i + 1}, carrier=${hg.carrier} 20GP=${hg.gp20} 40GP=${hg.gp40} 40HC=${hg.hc40}`);
        }
      }
      pendingPorts = [];
      continue;
    }

    // Check if this row contains port names (for the next header row)
    const portsInRow: { name: string; col: number }[] = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      if (cell.length >= 3 && isPortName(cell)) {
        portsInRow.push({ name: cell, col: c });
      }
    }
    if (portsInRow.length > 0) {
      pendingPorts = portsInRow;
      // Don't clear activeSections yet — port name rows might interleave with data rows
    }

    // Parse rate data from active sections
    for (const section of activeSections) {
      const carrierCell = String(row[section.carrierCol] || '').trim();
      if (!carrierCell || carrierCell.length < 2) continue;
      if (isPortName(carrierCell)) continue;
      const cl = carrierCell.toLowerCase();
      if (['total', 'subtotal', 'average', '20gp', '40gp', '40hc', '20', '40'].some(w => cl === w)) continue;

      const rate20gp = parseRate(row[section.gp20Col]);
      const rate40gp = section.gp40Col >= 0 ? parseRate(row[section.gp40Col]) : null;
      const rate40hc = section.hc40Col >= 0 ? parseRate(row[section.hc40Col]) : null;

      if (rate20gp === null && rate40gp === null && rate40hc === null) continue;

      rates.push({
        port_of_loading: section.port,
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

    // If we found port names and no rates were extracted, the sections may be resetting
    if (portsInRow.length > 0 && activeSections.length > 0) {
      // Check if port names are in different positions than active sections
      const newArea = portsInRow.some(p => !activeSections.some(s => Math.abs(s.gp20Col - p.col) < 3));
      if (newArea) activeSections = [];
    }
  }

  return rates;
}

/** Detect ALL container header groups in a row (for side-by-side layouts) */
function detectAllContainerHeaders(cells: string[]): { carrier: number; gp20: number; gp40: number; hc40: number }[] {
  const groups: { carrier: number; gp20: number; gp40: number; hc40: number }[] = [];

  // Find all 20GP positions
  const gp20Positions: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i].toLowerCase().replace(/[\s\-_'"]/g, '');
    if (/^20(gp|ft|dc|')?$/.test(c)) gp20Positions.push(i);
  }

  for (const gp20 of gp20Positions) {
    // Look for 40GP and 40HC near this 20GP (within 3 columns)
    let gp40 = -1, hc40 = -1;
    for (let j = gp20 + 1; j < Math.min(gp20 + 4, cells.length); j++) {
      const c = cells[j].toLowerCase().replace(/[\s\-_'"]/g, '');
      if (/^40(gp|ft|dc|')?$/.test(c) && gp40 < 0) gp40 = j;
      else if (/^40h[cq]$/.test(c)) hc40 = j;
    }

    if (gp40 >= 0 || hc40 >= 0) {
      // Carrier column is the column just before 20GP (or col 0 if 20GP is at col 1)
      const carrier = gp20 > 0 ? gp20 - 1 : -1;
      if (carrier >= 0) {
        groups.push({ carrier, gp20, gp40, hc40 });
      }
    }
  }

  return groups;
}

/** Find a pending port name that's near the given column */
function findPortForGroup(pendingPorts: { name: string; col: number }[], gp20Col: number): string | null {
  // The port name is usually in the same column as 20GP or the carrier col (gp20-1)
  for (const p of pendingPorts) {
    if (Math.abs(p.col - gp20Col) <= 2 || Math.abs(p.col - (gp20Col - 1)) <= 1) {
      return p.name;
    }
  }
  return null;
}

/** Find a port name in rows above, near the given column */
function findPortAboveNearCol(rows: any[][], headerRowIdx: number, nearCol: number): string | null {
  for (let offset = 1; offset <= 3 && headerRowIdx - offset >= 0; offset++) {
    const row = rows[headerRowIdx - offset];
    for (let c = 0; c < (row?.length || 0); c++) {
      const text = String(row[c]).trim();
      if (text.length >= 3 && isPortName(text) && Math.abs(c - nearCol) <= 2) {
        return text;
      }
    }
  }
  return null;
}

/**
 * Detect a row that contains container type headers (20GP, 40GP, 40HC)
 * Returns column positions or null if not a header row
 */
function detectContainerHeader(cells: string[]): { carrier: number; gp20: number; gp40: number; hc40: number } | null {
  let gp20 = -1, gp40 = -1, hc40 = -1;

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i].toLowerCase().replace(/[\s\-_'"]/g, '');
    // Match: "20GP", "20", "20'", "20FT", "20DC", "20 GP"
    if (/^20(gp|ft|dc|')?$/.test(c) && gp20 < 0) gp20 = i;
    // Match: "40GP", "40", "40FT", "40DC" (but not if already matched as 40HC)
    else if (/^40(gp|ft|dc|')?$/.test(c) && gp40 < 0) gp40 = i;
    // Match: "40HC", "40HQ", "40'HC"
    else if (/^40h[cq]$/.test(c)) hc40 = i;
  }

  // Need at least 20GP and one of 40GP/40HC
  if (gp20 >= 0 && (gp40 >= 0 || hc40 >= 0)) {
    // Carrier column is before the first rate column
    const firstRateCol = Math.min(...[gp20, gp40, hc40].filter(n => n >= 0));
    const carrier = firstRateCol > 0 ? 0 : -1;
    if (carrier < 0) return null;
    return { carrier, gp20, gp40, hc40 };
  }

  return null;
}

/**
 * Look at the rows above a container header to find the port name
 */
function findPortAbove(rows: any[][], headerRowIdx: number): string | null {
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
 * Check if any cell in the row is a port name, excluding container header columns
 */
function findPortInRow(cells: string[], headerCols?: { gp20: number; gp40: number; hc40: number }): string | null {
  const skipCols = new Set(headerCols ? [headerCols.gp20, headerCols.gp40, headerCols.hc40].filter(n => n >= 0) : []);
  for (let i = 0; i < cells.length; i++) {
    if (skipCols.has(i)) continue;
    if (cells[i].length >= 3 && isPortName(cells[i])) return cells[i];
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
