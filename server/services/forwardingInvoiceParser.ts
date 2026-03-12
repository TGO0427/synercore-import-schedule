/**
 * Forwarding Agent Invoice Parser
 * Extracts structured data from forwarding agent invoices (DHL, etc.)
 * and matches to existing BOL records to update freight charges.
 */

import { logInfo, logWarn } from '../utils/logger.js';

export interface ForwardingInvoiceData {
  invoice_number: string | null;
  ocean_bol_number: string | null;
  house_bol_number: string | null;
  shipper: string | null;
  consignee: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  origin_port: string | null;
  destination_port: string | null;
  etd: string | null;
  eta: string | null;
  container_number: string | null;
  container_type: string | null;
  freight_usd: number | null;
  exchange_rate: number | null;
  raw_text: string;
}

/** Parse DHL-style European number format: "2 550,00" → 2550.00 */
function parseDhlAmount(raw: string): number | null {
  if (!raw) return null;
  // Strip spaces (thousand separators)
  let cleaned = raw.replace(/\s/g, '');
  // If comma with exactly 2 trailing digits, treat as decimal separator
  cleaned = cleaned.replace(/,(\d{2})$/, '.$1');
  // Remove remaining commas (thousands)
  cleaned = cleaned.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Parse dd-mm-yy or dd-mm-yyyy date to ISO string */
function parseDhlDate(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  let year = m[3];
  if (year.length === 2) year = '20' + year;
  return `${year}-${month}-${day}`;
}

export async function parseForwardingInvoice(pdfBuffer: Buffer): Promise<ForwardingInvoiceData> {
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text;

  // Invoice number
  const invoiceMatch = text.match(/TAX\s+INVOICE\s+(\S+)/i);
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : null;

  // BOL numbers — try multiple label formats
  const oceanBolPatterns = [
    /OCEAN\s+B(?:ILL\s+OF\s+LADING|\/L|L)\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
    /O\.?B\.?\/?L\.?\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
    /MBL\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
    /MASTER\s+B(?:ILL|\/L|L)\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
    /B\/L\s*(?:NO\.?)?\s*[:\s]*([A-Z]{4}\w{8,})/i,
    /BL\s*(?:NO\.?|NUMBER)\s*[:\s]+(\S+)/i,
    /BILL\s+OF\s+LADING\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
  ];
  let oceanBolNumber: string | null = null;
  for (const pat of oceanBolPatterns) {
    const m = text.match(pat);
    if (m) { oceanBolNumber = m[1].trim(); break; }
  }

  const houseBolPatterns = [
    /HOUSE\s+B(?:ILL\s+OF\s+LADING|\/L|L)\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
    /H\.?B\.?\/?L\.?\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
    /HBL\s*(?:NO\.?)?\s*[:\s]+(\S+)/i,
  ];
  let houseBolNumber: string | null = null;
  for (const pat of houseBolPatterns) {
    const m = text.match(pat);
    if (m) { houseBolNumber = m[1].trim(); break; }
  }

  // Fallback: look for common BOL number formats anywhere (MEDU, OOLU, ONEYP, COSU, etc.)
  if (!oceanBolNumber && !houseBolNumber) {
    const bolFallback = text.match(/\b((?:MEDU|OOLU|ONEYP|COSU|HDMU|MAEU|MSCU|ZIMU|HLCU)[A-Z0-9]{6,})\b/i);
    if (bolFallback) oceanBolNumber = bolFallback[1].toUpperCase();
  }

  // Shipper & Consignee
  const shipperMatch = text.match(/SHIPPER\s*:\s*(.+)/i);
  const shipper = shipperMatch ? shipperMatch[1].trim() : null;

  const consigneeMatch = text.match(/CONSIGNEE\s*:\s*(.+)/i);
  const consignee = consigneeMatch ? consigneeMatch[1].trim() : null;

  // Vessel / Voyage: "CHIBA C / 091W"
  let vesselName: string | null = null;
  let voyageNumber: string | null = null;
  const vesselMatch = text.match(/VESSEL\s*\/\s*VOYAGE\s*[:\s]+(.+)/i);
  if (vesselMatch) {
    const parts = vesselMatch[1].trim().split(/\s*\/\s*/);
    vesselName = parts[0]?.trim() || null;
    voyageNumber = parts[1]?.trim() || null;
  }

  // Origin: "MYPKG = Port Klang, Malaysia" with optional ETD
  let originPort: string | null = null;
  let etd: string | null = null;
  const originMatch = text.match(/ORIGIN\s*[:\s]+\w+\s*=\s*(.+?)(?:\s+ETD\s*[:\s]*(\S+))?$/im);
  if (originMatch) {
    originPort = originMatch[1]?.trim().replace(/,?\s*$/, '') || null;
    etd = parseDhlDate(originMatch[2]) || null;
  }

  // Destination: "ZADUR = Durban, South Africa" with optional ETA
  let destinationPort: string | null = null;
  let eta: string | null = null;
  const destMatch = text.match(/DESTINATION\s*[:\s]+\w+\s*=\s*(.+?)(?:\s+ETA\s*[:\s]*(\S+))?$/im);
  if (destMatch) {
    destinationPort = destMatch[1]?.trim().replace(/,?\s*$/, '') || null;
    eta = parseDhlDate(destMatch[2]) || null;
  }

  // Containers: "KKFU7905025 - 40HC"
  const containerMatch = text.match(/CONTAINERS?\s*[:\s]+([A-Z]{4}\w{7})\s*[\-–]?\s*(20GP|40GP|40HC|40HQ)?/i);
  const containerNumber = containerMatch ? containerMatch[1] : null;
  let containerType = containerMatch?.[2]?.toUpperCase() || null;
  if (containerType === '40HQ') containerType = '40HC';

  // Freight USD: "Freight USD 2 550,00 @ 16,027500"
  let freightUsd: number | null = null;
  let exchangeRate: number | null = null;
  const freightMatch = text.match(/Freight\s+USD\s+([\d\s,\.]+?)(?:\s*@\s*([\d,\.]+))?(?:\s|$)/i);
  if (freightMatch) {
    freightUsd = parseDhlAmount(freightMatch[1]);
    exchangeRate = freightMatch[2] ? parseDhlAmount(freightMatch[2]) : null;
  }

  // Also try: "FREIGHT USD amount" in CHARGES section
  if (!freightUsd) {
    const altFreight = text.match(/FREIGHT\s*.*?USD\s*([\d\s,\.]+)/i);
    if (altFreight) freightUsd = parseDhlAmount(altFreight[1]);
  }

  logInfo(`Forwarding invoice parsed: invoice=${invoiceNumber || 'unknown'}, BOL=${oceanBolNumber || houseBolNumber || 'unknown'}, freight=$${freightUsd || 'unknown'}`);

  return {
    invoice_number: invoiceNumber,
    ocean_bol_number: oceanBolNumber,
    house_bol_number: houseBolNumber,
    shipper,
    consignee,
    vessel_name: vesselName,
    voyage_number: voyageNumber,
    origin_port: originPort,
    destination_port: destinationPort,
    etd,
    eta,
    container_number: containerNumber,
    container_type: containerType,
    freight_usd: freightUsd,
    exchange_rate: exchangeRate,
    raw_text: text.substring(0, 5000),
  };
}
