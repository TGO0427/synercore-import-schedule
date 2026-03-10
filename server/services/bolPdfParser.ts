/**
 * Bill of Lading PDF Parser
 * Extracts structured data from BOL PDFs using text extraction and pattern matching.
 * Then cross-references against existing shipments to auto-flag discrepancies.
 */

import pdf from 'pdf-parse';
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

// ─── Pattern definitions ───

const BOL_NUMBER_PATTERNS = [
  /B\/?L\s*(?:No\.?|Number|#|:)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:Bill\s+of\s+Lading|BOL)\s*(?:No\.?|Number|#|:)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:Document\s*No\.?|Doc\s*#)\s*[:\s]*([A-Z0-9][\w\-\/]{4,30})/i,
  /(?:MBOL|HBOL|MBL|HBL)\s*[:\s#]*([A-Z0-9][\w\-\/]{4,30})/i,
];

const VESSEL_PATTERNS = [
  /(?:Vessel|Ship|Motor\s*Vessel|M\/?V|V\.)\s*[:\s]*["']?([A-Z][A-Za-z\s\-\.]{2,40}?)["']?\s*(?:V\.|Voyage|$|\n)/i,
  /(?:Ocean\s*Vessel)\s*[:\s]*([A-Z][A-Za-z\s\-\.]{2,40})/i,
];

const VOYAGE_PATTERNS = [
  /(?:Voyage|Voy\.?|V\.)\s*(?:No\.?|#)?\s*[:\s]*([A-Z0-9][\w\-]{1,20})/i,
];

const PORT_LOADING_PATTERNS = [
  /(?:Port\s+of\s+Loading|POL|Load(?:ing)?\s+Port)\s*[:\s]*([A-Za-z\s,\-\.]{3,50})/i,
  /(?:Place\s+of\s+Receipt)\s*[:\s]*([A-Za-z\s,\-\.]{3,50})/i,
];

const PORT_DISCHARGE_PATTERNS = [
  /(?:Port\s+of\s+Discharge|POD|Discharge\s+Port)\s*[:\s]*([A-Za-z\s,\-\.]{3,50})/i,
  /(?:Place\s+of\s+Delivery|Final\s+Destination)\s*[:\s]*([A-Za-z\s,\-\.]{3,50})/i,
];

const CONSIGNEE_PATTERNS = [
  /(?:Consignee|Consigned\s+to)\s*[:\s]*([^\n]{5,100})/i,
];

const SHIPPER_PATTERNS = [
  /(?:Shipper|Exporter)\s*[:\s]*([^\n]{5,100})/i,
];

const NOTIFY_PATTERNS = [
  /(?:Notify\s+Party|Notify)\s*[:\s]*([^\n]{5,100})/i,
];

const CONTAINER_PATTERNS = [
  /([A-Z]{4}\d{7})/g, // Standard ISO container number: 4 letters + 7 digits
];

const WEIGHT_PATTERNS = [
  /(?:Gross\s*Weight|G\.?W\.?|Weight)\s*[:\s]*[\s]*([\d,\.]+)\s*(?:KG|KGS|Kgs|kg)/i,
  /(?:Total\s*Weight)\s*[:\s]*([\d,\.]+)\s*(?:KG|KGS|Kgs|kg)/i,
  /([\d,\.]+)\s*(?:KGS|KG)\s*(?:Gross)/i,
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
];

const VALUE_PATTERNS = [
  /(?:Declared\s+Value|Invoice\s+Value|Value)\s*[:\s]*(?:USD|US\$|\$)\s*([\d,\.]+)/i,
];

const DATE_PATTERNS = [
  /(?:Date\s+of\s+Issue|Issued?\s+Date|Date)\s*[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  /(?:Date\s+of\s+Issue|Issued?\s+Date|Date)\s*[:\s]*(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
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
  /(?:Description\s+of\s+(?:Goods|Packages|Cargo)|Particulars)\s*[:\s]*([^\n]{5,500})/i,
  /(?:Commodity|Goods)\s*[:\s]*([^\n]{5,200})/i,
];

// ─── Helpers ───

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m && m[1]) return m[1].trim();
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

  // Carrier name — often at the top of the BOL or in the footer
  let carrierName: string | null = null;
  const carrierMatch = text.match(/(?:Carrier|Shipping\s+Line|Line)\s*[:\s]*([A-Za-z\s\-\.&]{3,60})/i);
  if (carrierMatch) carrierName = carrierMatch[1].trim();
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
