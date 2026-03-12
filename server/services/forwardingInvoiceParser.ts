/**
 * Forwarding Agent Invoice Parser
 * Extracts structured data from forwarding agent invoices (DHL, etc.)
 * and matches to existing BOL records to update freight charges.
 *
 * DHL invoices extract as multi-column tables where labels and values
 * run together without separators. This parser handles that format.
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

/** Known carrier BOL prefixes */
const CARRIER_BOL_PREFIXES = ['MEDU', 'OOLU', 'ONEYP', 'COSU', 'HDMU', 'MAEU', 'MSCU', 'ZIMU', 'HLCU', 'CMDU', 'EGLV', 'APLU', 'YMLU'];

export async function parseForwardingInvoice(pdfBuffer: Buffer): Promise<ForwardingInvoiceData> {
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text;

  // Invoice number: "TAX INVOICE S1230432"
  const invoiceMatch = text.match(/TAX\s+INVOICE\s+(\S+)/i);
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : null;

  // === BOL Numbers ===
  // DHL format: labels and values on consecutive lines, concatenated without spaces:
  //   VESSEL / VOYAGEOCEAN BILL OF LADINGHOUSE BILL OF LADING
  //   CHIBA C / 091WONEYPKGF84728500PKGA81047
  let oceanBolNumber: string | null = null;
  let houseBolNumber: string | null = null;

  // Primary: scan for carrier-prefix BOL numbers anywhere in the text
  // In DHL concatenated format, ocean+house run together: "ONEYPKGF84728500PKGA81047"
  const prefixPattern = new RegExp(`((?:${CARRIER_BOL_PREFIXES.join('|')})[A-Z0-9]{6,})`, 'i');
  const carrierBolMatch = text.match(prefixPattern);
  if (carrierBolMatch) {
    const blob = carrierBolMatch[1].toUpperCase();
    // Split at digit→uppercase-letter boundary (ocean BOL ends in digits, house BL starts with letters)
    const splitMatch = blob.match(/^([A-Z]+\d+[A-Z]*\d+)([A-Z][A-Z0-9]+)$/);
    if (splitMatch) {
      oceanBolNumber = splitMatch[1];
      houseBolNumber = splitMatch[2];
    } else {
      oceanBolNumber = blob;
    }
  }

  // Fallback: try labeled formats if carrier prefix didn't match
  if (!oceanBolNumber) {
    const labeledPatterns = [
      /OCEAN\s+B(?:ILL\s+OF\s+LADING|\/L)\s*(?:NO\.?)?\s*[:\s]+([A-Z0-9]{6,})/i,
      /O\.?B\.?\/?L\.?\s*(?:NO\.?)?\s*[:\s]+([A-Z0-9]{6,})/i,
      /MBL\s*(?:NO\.?)?\s*[:\s]+([A-Z0-9]{6,})/i,
      /B\/L\s*(?:NO\.?)?\s*[:\s]*([A-Z]{4}\w{8,})/i,
    ];
    for (const pat of labeledPatterns) {
      const m = text.match(pat);
      if (m) { oceanBolNumber = m[1].trim(); break; }
    }
  }

  if (!houseBolNumber) {
    const houseLabeledPatterns = [
      /HOUSE\s+B(?:ILL\s+OF\s+LADING|\/L)\s*(?:NO\.?)?\s*[:\s]+([A-Z0-9]{4,})/i,
      /HBL\s*(?:NO\.?)?\s*[:\s]+([A-Z0-9]{4,})/i,
    ];
    for (const pat of houseLabeledPatterns) {
      const m = text.match(pat);
      if (m) { houseBolNumber = m[1].trim(); break; }
    }
  }

  // === Shipper & Consignee ===
  // DHL format: "SHIPPERCONSIGNEE\nECOLEX SDN BHDAFRICAN FOOD INDUSTRIES"
  // Also try: "SHIPPER\nname\nCONSIGNEE\nname"
  let shipper: string | null = null;
  let consignee: string | null = null;

  const shipConMatch = text.match(/SHIPPER\s*CONSIGNEE\s*\n(.+)/i);
  if (shipConMatch) {
    const valueLine = shipConMatch[1].trim();
    // Try to split at a known consignee name or at a capital-letter boundary
    // Look for the consignee in the BOL (we'll use a simple heuristic — find the DB BOL's consignee later)
    // For now, leave shipper/consignee extraction to the BOL
  } else {
    const shipperMatch = text.match(/SHIPPER\s*[:\s]\s*(.+)/i);
    if (shipperMatch) shipper = shipperMatch[1].trim();

    const consigneeMatch = text.match(/CONSIGNEE\s*[:\s]\s*(.+)/i);
    if (consigneeMatch) consignee = consigneeMatch[1].trim();
  }

  // === Vessel / Voyage ===
  // DHL: "VESSEL / VOYAGEOCEAN BILL..." header, value line: "CHIBA C / 091WONEYPKGF84728500..."
  let vesselName: string | null = null;
  let voyageNumber: string | null = null;

  // If we found an ocean BOL, the vessel/voyage is everything before it on the same line
  if (oceanBolNumber) {
    const vesselLineMatch = text.match(new RegExp(`^(.+?)${oceanBolNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im'));
    if (vesselLineMatch) {
      const vesselVoyageStr = vesselLineMatch[1].trim();
      const vvParts = vesselVoyageStr.split(/\s*\/\s*/);
      if (vvParts.length >= 2) {
        vesselName = vvParts[0]?.trim() || null;
        voyageNumber = vvParts[vvParts.length - 1]?.trim() || null;
      } else if (vesselVoyageStr) {
        vesselName = vesselVoyageStr;
      }
    }
  }

  // Fallback: labeled pattern
  if (!vesselName) {
    const vesselMatch = text.match(/VESSEL\s*(?:\/\s*VOYAGE)?\s*[:\s]+([A-Z][A-Z\s]+?)(?:\s*\/\s*(\w+))?(?:\s*(?:OCEAN|BILL|$))/im);
    if (vesselMatch) {
      vesselName = vesselMatch[1]?.trim() || null;
      voyageNumber = vesselMatch[2]?.trim() || voyageNumber;
    }
  }

  // === Origin / Destination with ETD / ETA ===
  // DHL format: "ORIGINETDDESTINATIONETA\nMYPKG = Port Klang, Malaysia18-01-26ZADUR = Durban, South Africa11-02-26"
  let originPort: string | null = null;
  let etd: string | null = null;
  let destinationPort: string | null = null;
  let eta: string | null = null;

  // Try DHL concatenated format — value line contains origin, ETD date, destination, ETA date
  const originDestLine = text.match(/ORIGIN\s*ETD\s*DESTINATION\s*ETA\s*\n(.+)/i);
  if (originDestLine) {
    const line = originDestLine[1].trim();
    // Pattern: "MYPKG = Port Klang, Malaysia18-01-26ZADUR = Durban, South Africa11-02-26"
    // Split at the port code pattern (5-char code like ZADUR)
    const odMatch = line.match(/\w+\s*=\s*(.+?)(\d{1,2}-\d{1,2}-\d{2,4})\s*(\w+)\s*=\s*(.+?)(\d{1,2}-\d{1,2}-\d{2,4})/);
    if (odMatch) {
      originPort = odMatch[1]?.trim().replace(/,?\s*$/, '') || null;
      etd = parseDhlDate(odMatch[2]) || null;
      destinationPort = odMatch[4]?.trim().replace(/,?\s*$/, '') || null;
      eta = parseDhlDate(odMatch[5]) || null;
    }
  }

  // Fallback: separate ORIGIN / DESTINATION lines
  if (!originPort) {
    const originMatch = text.match(/ORIGIN\s*[:\s]+\w+\s*=\s*(.+?)(?:\s+ETD\s*[:\s]*(\S+))?$/im);
    if (originMatch) {
      originPort = originMatch[1]?.trim().replace(/,?\s*$/, '') || null;
      etd = parseDhlDate(originMatch[2]) || null;
    }
  }
  if (!destinationPort) {
    const destMatch = text.match(/DESTINATION\s*[:\s]+\w+\s*=\s*(.+?)(?:\s+ETA\s*[:\s]*(\S+))?$/im);
    if (destMatch) {
      destinationPort = destMatch[1]?.trim().replace(/,?\s*$/, '') || null;
      eta = parseDhlDate(destMatch[2]) || null;
    }
  }

  // === Containers ===
  // "KKFU7905025 - 40HC" or just the container number anywhere
  const containerMatch = text.match(/([A-Z]{4}\d{7})\s*[\-–]?\s*(20GP|40GP|40HC|40HQ)?/i);
  const containerNumber = containerMatch ? containerMatch[1] : null;
  let containerType = containerMatch?.[2]?.toUpperCase() || null;
  if (containerType === '40HQ') containerType = '40HC';

  // === Freight USD ===
  // DHL: "Freight USD 2 550,00 @ 16,027500Zero Rated"
  // The amount and rate are in European format; "Zero Rated" follows immediately
  let freightUsd: number | null = null;
  let exchangeRate: number | null = null;

  // Greedy match: capture everything between "USD" and "@" or "Zero" or end-of-line
  const freightMatch = text.match(/Freight\s+USD\s+([\d\s,\.]+?)\s*@\s*([\d\s,\.]+?)(?:Zero|VAT|\s*\n)/i);
  if (freightMatch) {
    freightUsd = parseDhlAmount(freightMatch[1]);
    exchangeRate = parseDhlAmount(freightMatch[2]);
  }

  // Try without exchange rate
  if (!freightUsd) {
    const freightOnly = text.match(/Freight\s+USD\s+([\d\s,\.]+?)(?:Zero|VAT|\s*\n)/i);
    if (freightOnly) {
      freightUsd = parseDhlAmount(freightOnly[1]);
    }
  }

  // Fallback: "FREIGHT USD amount" or "FREIGHT ... USD amount"
  if (!freightUsd) {
    const altFreight = text.match(/FREIGHT\s*.*?USD\s*([\d\s,\.]+?)(?:Zero|VAT|\s*\n|$)/i);
    if (altFreight) freightUsd = parseDhlAmount(altFreight[1]);
  }

  logInfo(`Forwarding invoice parsed: invoice=${invoiceNumber || 'unknown'}, BOL=${oceanBolNumber || houseBolNumber || 'unknown'}, freight=$${freightUsd || 'unknown'}, vessel=${vesselName || 'unknown'}`);

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
