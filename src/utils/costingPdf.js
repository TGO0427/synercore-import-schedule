/**
 * PDF generation utilities for Import Costing
 * Extracted from ImportCosting.jsx for maintainability
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAllTotals, formatCurrency, formatNumber } from './costingCalculations';

// Shared helper: filter rows where the last column is zero or empty/dash
const filterZeroRows = (rows) => rows.filter(row => {
  const value = row[row.length - 1];
  if (value === '-' || value === '' || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    if (value.trim() === '-') return false;
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return !isNaN(numericValue) && numericValue !== 0;
  }
  return value !== 0;
});

// Format date nicely (e.g. "03 Mar 2026")
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Shared helper: calculate product weight/customs/duties totals
const getProductTotals = (estimate) => {
  const products = estimate.products || [];
  const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
  const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;
  let totalWeight = 0;
  let totalCustomsValue = 0;
  let totalDuties = 0;

  products.forEach(p => {
    const weight = parseFloat(p.weight_kg) || 0;
    const invoiceValue = parseFloat(p.invoice_value) || 0;
    const dutyPercent = parseFloat(p.duty_percent) || 0;
    const dutySchedule1Percent = parseFloat(p.duty_schedule1_percent) || 0;
    const currency = p.currency || 'USD';

    let roe = roeCustoms;
    if (currency === 'EUR') roe = roeEur;
    if (currency === 'ZAR') roe = 1;

    const customsValue = invoiceValue * roe;
    const duties = customsValue * ((dutyPercent + dutySchedule1Percent) / 100);

    totalWeight += weight;
    totalCustomsValue += customsValue;
    totalDuties += duties;
  });

  return { totalWeight, totalCustomsValue, totalDuties };
};

// Calculate per-product full cost breakdown (matches ImportCosting calculateProductAllocation)
const getProductCostBreakdown = (product, estimate, totals, productTotals) => {
  const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
  const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;
  const weight = parseFloat(product.weight_kg) || 0;
  const invoiceValue = parseFloat(product.invoice_value) || 0;
  const dutyPercent = parseFloat(product.duty_percent) || 0;
  const dutySchedule1Percent = parseFloat(product.duty_schedule1_percent) || 0;
  const currency = product.currency || 'USD';

  let roe = roeCustoms;
  if (currency === 'EUR') roe = roeEur;
  if (currency === 'ZAR') roe = 1;

  const customsValue = invoiceValue * roe;
  const importDuty = customsValue * (dutyPercent / 100);
  const schedule1Duty = customsValue * (dutySchedule1Percent / 100);
  const totalDuties = importDuty + schedule1Duty;
  const weightRatio = productTotals.totalWeight > 0 ? weight / productTotals.totalWeight : 0;

  // For CIF/CIP/CFR, only allocate local + destination charges
  const incoTerms = (estimate.inco_terms || '').toUpperCase();
  const freightIncluded = ['CIF', 'CIP', 'CFR'].includes(incoTerms);
  let shippingToAllocate;
  if (freightIncluded) {
    shippingToAllocate = (totals.local_charges_subtotal_zar || 0) + (totals.destination_charges_subtotal_zar || 0);
  } else {
    shippingToAllocate = totals.total_shipping_cost_zar || 0;
  }
  const allocatedShipping = shippingToAllocate * weightRatio;
  const totalLanded = customsValue + totalDuties + allocatedShipping;
  const costPerKg = weight > 0 ? totalLanded / weight : 0;

  return { weight, weightRatio, invoiceValue, currency, customsValue, importDuty, schedule1Duty, totalDuties, allocatedShipping, totalLanded, costPerKg };
};

// Backward-compatible wrapper
const getProductCostPerKg = (product, estimate, totals, productTotals) => {
  const bd = getProductCostBreakdown(product, estimate, totals, productTotals);
  return { costPerKg: bd.costPerKg, totalLanded: bd.totalLanded, allocatedShipping: bd.allocatedShipping };
};

// Draw a section divider with accent bar and label
const drawSectionDivider = (doc, y, label, color) => {
  // Accent bar (3px wide, 12px tall)
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(14, y - 3, 1.2, 5, 'F');
  // Section title
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(label, 17, y + 1);
  doc.setFont(undefined, 'normal');
  return y + 5;
};

// Check page break — if content would exceed page, add new page and return new Y
const checkPageBreak = (doc, y, neededHeight) => {
  const pageHeight = doc.internal.pageSize.height;
  if (y + neededHeight > pageHeight - 20) {
    doc.addPage();
    return 15;
  }
  return y;
};

// Shared helper: render header, ROE info, shipment details, and products table
const buildEstimateHeader = (doc, estimate, productTotals, totals) => {
  const products = estimate.products || [];
  const isAir = (estimate.transport_mode || 'sea') === 'air';
  const pageWidth = doc.internal.pageSize.width;

  // === FULL-WIDTH COLOR BAR ===
  const barColor = isAir ? [91, 33, 182] : [11, 31, 58];
  doc.setFillColor(barColor[0], barColor[1], barColor[2]);
  doc.rect(0, 0, pageWidth, 16, 'F');

  // "SYNERCORE" left side
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('SYNERCORE', 10, 11);

  // Estimate type right side
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  const titleText = isAir ? 'Air Freight Cost Estimate' : 'Import Cost Estimate';
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, pageWidth - titleWidth - 10, 11);

  // === LIGHT GRAY INFO STRIP ===
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 16, pageWidth, 9, 'F');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont(undefined, 'normal');
  const infoText = `Reference: ${estimate.reference_number || 'N/A'}     Date: ${formatDate(estimate.costing_date)}     Supplier: ${estimate.supplier_name || 'N/A'}`;
  doc.text(infoText, 10, 22);

  // === ROE INFO BOX (right-aligned, below info strip) ===
  const roeBoxW = 62;
  const roeBoxH = 16;
  const roeBoxX = pageWidth - roeBoxW - 10;
  const roeBoxY = 27;

  // Light blue background
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  doc.roundedRect(roeBoxX, roeBoxY, roeBoxW, roeBoxH, 1.5, 1.5, 'FD');

  // ROE text
  doc.setFontSize(7);
  doc.setTextColor(30, 64, 175);
  doc.setFont(undefined, 'bold');
  doc.text('ROE', roeBoxX + 2, roeBoxY + 4.5);
  doc.setFont(undefined, 'normal');
  doc.text(`Date: ${formatDate(estimate.costing_date)}`, roeBoxX + 2, roeBoxY + 8.5);
  doc.text(`USD/ZAR: ${formatNumber(estimate.roe_origin || 0, 4)}`, roeBoxX + 2, roeBoxY + 12.5);
  doc.text(`EUR/ZAR: ${formatNumber(estimate.roe_eur || 0, 4)}`, roeBoxX + 32, roeBoxY + 12.5);

  // === SHIPMENT DETAILS TABLE ===
  let startY = 46;
  startY = drawSectionDivider(doc, startY, 'Shipment Details', barColor);

  const shipmentRows = isAir
    ? filterZeroRows([
        ['Country of Origin', estimate.country_of_origin || '-'],
        ['Airport of Departure', estimate.airport_of_departure || '-'],
        ['Airport of Arrival', estimate.airport_of_arrival || '-'],
        ['Airline', estimate.airline_name || '-'],
        ['Flight Number', estimate.flight_number || '-'],
        ['INCO Terms', estimate.inco_terms || '-'],
        ['Transit Time', estimate.transit_time_days ? `${estimate.transit_time_days} days` : '-'],
        ['Actual Weight', `${formatNumber(estimate.actual_weight_kg || 0)} kg`],
        ['Chargeable Weight', `${formatNumber(totals.chargeable_weight_kg || 0)} kg`],
        ['Total Product Weight', `${formatNumber(productTotals.totalWeight || 0)} kg`],
      ])
    : filterZeroRows([
        ['Country of Origin', estimate.country_of_origin || '-'],
        ['Port of Loading', estimate.port_of_loading || '-'],
        ['Port of Discharge', estimate.port_of_discharge || '-'],
        ['Load Type', estimate.load_type || '-'],
        ['Container Type', estimate.container_type || '-'],
        ['Shipping Line', estimate.shipping_line || '-'],
        ['INCO Terms', estimate.inco_terms || '-'],
        ['Transit Time', estimate.transit_time_days ? `${estimate.transit_time_days} days` : '-'],
        ['Total Weight', `${formatNumber(productTotals.totalWeight || estimate.total_gross_weight_kg)} kg`],
      ]);

  autoTable(doc, {
    startY: startY + 1,
    body: shipmentRows,
    showHead: false,
    theme: 'striped',
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
    },
  });

  // === PRODUCTS TABLE ===
  if (products.length > 0) {
    const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
    const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;

    const productRows = products.map(p => {
      const weight = parseFloat(p.weight_kg) || 0;
      const ratePerKg = parseFloat(p.rate_per_kg) || 0;
      const invoiceValue = parseFloat(p.invoice_value) || 0;
      const currency = p.currency || 'USD';

      let roe = roeCustoms;
      if (currency === 'EUR') roe = roeEur;
      if (currency === 'ZAR') roe = 1;

      const customsValue = invoiceValue * roe;
      const pCost = totals ? getProductCostPerKg(p, estimate, totals, productTotals) : { costPerKg: 0 };

      return [
        p.name || '-',
        p.hs_code || '-',
        `${formatNumber(weight)} kg`,
        `${formatNumber(ratePerKg, 2)}`,
        currency,
        formatNumber(invoiceValue, 2),
        formatCurrency(customsValue),
        formatCurrency(pCost.costPerKg),
      ];
    });

    // Calculate overall cost/kg
    const overallCostPerKg = totals ? (totals.all_in_warehouse_cost_per_kg_zar || 0) : 0;
    productRows.push([
      'TOTAL', '', `${formatNumber(productTotals.totalWeight)} kg`, '', '', '', formatCurrency(productTotals.totalCustomsValue), formatCurrency(overallCostPerKg),
    ]);

    let prodY = doc.lastAutoTable.finalY + 4;
    prodY = drawSectionDivider(doc, prodY, 'Products', [245, 158, 11]);

    autoTable(doc, {
      startY: prodY + 1,
      head: [['Product', 'HS Code', 'Weight', 'Rate/kg', 'Curr', 'Invoice Val', 'Customs Val (ZAR)', 'Cost/kg']],
      body: productRows,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      styles: { fontSize: 8 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === productRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });

    // === PRODUCT COST ALLOCATION TABLE ===
    if (totals) {
      const incoTerms = (estimate.inco_terms || '').toUpperCase();
      const freightIncluded = ['CIF', 'CIP', 'CFR'].includes(incoTerms);
      const shippingLabel = freightIncluded ? 'Alloc. Local Charges' : 'Alloc. Shipping';

      let sumWeight = 0, sumCustomsValue = 0, sumImportDuty = 0, sumSchedule1Duty = 0;
      let sumAllocatedShipping = 0, sumTotalLanded = 0;

      const allocationRows = products.map(p => {
        const bd = getProductCostBreakdown(p, estimate, totals, productTotals);
        sumWeight += bd.weight;
        sumCustomsValue += bd.customsValue;
        sumImportDuty += bd.importDuty;
        sumSchedule1Duty += bd.schedule1Duty;
        sumAllocatedShipping += bd.allocatedShipping;
        sumTotalLanded += bd.totalLanded;

        return [
          p.name || '-',
          formatNumber(bd.weight, 0),
          `${(bd.weightRatio * 100).toFixed(1)}%`,
          `${formatNumber(bd.invoiceValue, 2)} ${bd.currency}`,
          formatCurrency(bd.customsValue),
          formatCurrency(bd.importDuty),
          formatCurrency(bd.schedule1Duty),
          formatCurrency(bd.allocatedShipping),
          formatCurrency(bd.totalLanded),
          formatCurrency(bd.costPerKg),
        ];
      });

      const sumCostPerKg = sumWeight > 0 ? sumTotalLanded / sumWeight : 0;
      allocationRows.push([
        'TOTAL',
        formatNumber(sumWeight, 0),
        '100.0%',
        '',
        formatCurrency(sumCustomsValue),
        formatCurrency(sumImportDuty),
        formatCurrency(sumSchedule1Duty),
        formatCurrency(sumAllocatedShipping),
        formatCurrency(sumTotalLanded),
        formatCurrency(sumCostPerKg),
      ]);

      let allocY = doc.lastAutoTable.finalY + 4;
      allocY = drawSectionDivider(doc, allocY, 'Product Cost Allocation', [22, 101, 52]);

      autoTable(doc, {
        startY: allocY + 1,
        head: [['Product', 'Weight (kg)', 'Wt %', 'Invoice Value', 'Customs Val (ZAR)', 'Import Duty', 'Sch1 Duty', shippingLabel, 'Total Landed', 'Cost/kg']],
        body: allocationRows,
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52], fontSize: 7, textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right', cellWidth: 24 },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right', fontStyle: 'bold' },
          9: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === allocationRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [229, 231, 235];
          }
        },
      });
    }
  }
};

/**
 * Generate and save a full PDF for a cost estimate
 */
export function generateEstimatePDF(estimate) {
  const doc = new jsPDF();
  const totals = calculateAllTotals(estimate);
  const productTotals = getProductTotals(estimate);

  buildEstimateHeader(doc, estimate, productTotals, totals);

  const isAir = (estimate.transport_mode || 'sea') === 'air';
  const themeColor = isAir ? [91, 33, 182] : [11, 31, 58];
  const pageWidth = doc.internal.pageSize.width;

  // Helper to style sub-total rows in charge tables
  const chargeTableSubTotalHook = (rows) => (data) => {
    if (data.section === 'body' && data.row.index === rows.length - 1) {
      const lastLabel = rows[rows.length - 1]?.[0] || '';
      if (lastLabel.startsWith('Sub-Total') || lastLabel.startsWith('Total')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
    }
  };

  if (isAir) {
    // === AIR FREIGHT PDF SECTIONS ===

    // Airfreight Charges
    const airRows = filterZeroRows([
      ['Airfreight (USD)', formatCurrency(estimate.airfreight_usd, 'USD'), formatCurrency(totals._airfreight_usd_zar)],
      ['Airfreight (EUR)', formatCurrency(estimate.airfreight_eur, 'EUR'), formatCurrency(totals._airfreight_eur_zar)],
    ]);
    if (totals.airfreight_total_zar > 0) {
      airRows.push(['Total Airfreight', '', formatCurrency(totals.airfreight_total_zar)]);
    }
    if (airRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Airfreight Charges', [124, 58, 237]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Airfreight', 'Amount', 'ZAR']],
        body: airRows,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(airRows),
      });
    }

    // Surcharges
    const surchargeRows = filterZeroRows([
      ['Fuel Surcharge (USD)', formatCurrency(estimate.fuel_surcharge_usd, 'USD'), formatCurrency((parseFloat(estimate.fuel_surcharge_usd) || 0) * (parseFloat(estimate.roe_origin) || 0))],
      ['Fuel Surcharge (EUR)', formatCurrency(estimate.fuel_surcharge_eur, 'EUR'), formatCurrency((parseFloat(estimate.fuel_surcharge_eur) || 0) * (parseFloat(estimate.roe_eur) || 0))],
      ['Security Surcharge (USD)', formatCurrency(estimate.security_surcharge_usd, 'USD'), formatCurrency((parseFloat(estimate.security_surcharge_usd) || 0) * (parseFloat(estimate.roe_origin) || 0))],
      ['Security Surcharge (EUR)', formatCurrency(estimate.security_surcharge_eur, 'EUR'), formatCurrency((parseFloat(estimate.security_surcharge_eur) || 0) * (parseFloat(estimate.roe_eur) || 0))],
    ]);
    if (totals.fuel_surcharge_total_zar > 0 || totals.security_surcharge_total_zar > 0) {
      surchargeRows.push(['Total Surcharges', '', formatCurrency((totals.fuel_surcharge_total_zar || 0) + (totals.security_surcharge_total_zar || 0))]);
    }
    if (surchargeRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Surcharges', [109, 40, 217]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Surcharges', 'Amount', 'ZAR']],
        body: surchargeRows,
        theme: 'striped',
        headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(surchargeRows),
      });
    }

    // Origin & Local Charges
    const airLocalRows = filterZeroRows([
      ['Origin Charges (USD)', formatCurrency(estimate.airfreight_origin_charges_usd, 'USD')],
      ['Origin Charges (EUR)', formatCurrency(estimate.airfreight_origin_charges_eur, 'EUR')],
      ['Screening Fee', formatCurrency(estimate.screening_fee_zar)],
      ['AWB Fee', formatCurrency(estimate.awb_fee_zar)],
      ['Airline Handling Fee', formatCurrency(estimate.airline_handling_fee_zar)],
      ['Airport Transfer Fee', formatCurrency(estimate.airport_transfer_fee_zar)],
      ['Cartage: Airport to Warehouse', formatCurrency(estimate.cartage_airport_to_whs_zar)],
      ['Insurance', formatCurrency(totals.airfreight_insurance_zar)],
    ]);
    if (totals.airfreight_origin_charges_zar > 0 || totals.air_local_charges_subtotal_zar > 0) {
      airLocalRows.push(['Sub-Total', formatCurrency((totals.airfreight_origin_charges_zar || 0) + (totals.air_local_charges_subtotal_zar || 0) + (totals.airfreight_insurance_zar || 0))]);
    }
    if (airLocalRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Origin & Local Charges', [22, 101, 52]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Origin & Local Charges', 'Amount']],
        body: airLocalRows,
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(airLocalRows),
      });
    }

  } else {
    // === SEA FREIGHT PDF SECTIONS ===

    // Ocean Freight
    const oceanFreightRows = filterZeroRows([
      ['Ocean Freight (USD)', formatCurrency(estimate.ocean_freight_usd, 'USD'), formatCurrency(totals._ocean_freight_usd_zar)],
      ['Ocean Freight (EUR)', formatCurrency(estimate.ocean_freight_eur, 'EUR'), formatCurrency(totals._ocean_freight_eur_zar)],
    ]);
    if (totals.total_ocean_freight_zar > 0) {
      oceanFreightRows.push(['Total Ocean Freight', '', formatCurrency(totals.total_ocean_freight_zar)]);
    }
    if (oceanFreightRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Ocean Freight', [59, 130, 246]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Ocean Freight', 'Amount', 'ZAR']],
        body: oceanFreightRows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(oceanFreightRows),
      });
    }

    // Origin Charges
    const originRows = filterZeroRows([
      ['Origin Charge (USD)', formatCurrency(estimate.origin_charge_usd, 'USD'), formatCurrency(totals._origin_charge_usd_zar)],
      ['Origin Charge (EUR)', formatCurrency(estimate.origin_charge_eur, 'EUR'), formatCurrency(totals._origin_charge_eur_zar)],
    ]);
    if (totals.total_origin_charges_zar > 0) {
      originRows.push(['Total Origin Charges', '', formatCurrency(totals.total_origin_charges_zar)]);
    }
    if (originRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Origin Charges', [46, 139, 87]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Origin Charges', 'Amount', 'ZAR']],
        body: originRows,
        theme: 'striped',
        headStyles: { fillColor: [46, 139, 87], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(originRows),
      });
    }

    // Local Charges
    const localChargeRows = filterZeroRows([
      ['Local Cartage: CPT to Klapmuts (<20 Ton)', formatCurrency(estimate.local_cartage_cpt_klapmuts_20ton_zar)],
      ['Local Cartage: CPT to Klapmuts (21-28 Ton)', formatCurrency(estimate.local_cartage_cpt_klapmuts_28ton_zar)],
      ['Transport: DBN Port to Pretoria (20FT)', formatCurrency(estimate.transport_dbn_to_pretoria_20ft_zar)],
      ['Transport: DBN Port to Pretoria (40FT)', formatCurrency(estimate.transport_dbn_to_pretoria_40ft_zar)],
      ['Transport: DBN Port to WHS', formatCurrency(estimate.transport_dbn_to_whs_zar)],
      ['Unpack / Reload', formatCurrency(estimate.unpack_reload_zar)],
      ['Storage', formatCurrency(estimate.storage_zar)],
      ['Outlying Container Depot Surcharge', formatCurrency(estimate.outlying_depot_surcharge_zar)],
      ['Local Cartage: DBN WHS to PTA (Tautliner A)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_opt_a_zar)],
      ['Local Cartage: DBN WHS to PTA (Tautliner B)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_opt_b_zar)],
      ['Local Cartage: DBN WHS to PTA (6M Deck)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_6m_zar)],
      ['Local Cartage: DBN WHS to PTA (12M Deck)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_12m_zar)],
      ['Transport: PE/Coega Port to Pretoria', formatCurrency(estimate.transport_pe_coega_to_pretoria_zar)],
    ]);
    if (totals.local_charges_subtotal_zar > 0) {
      localChargeRows.push(['Sub-Total', formatCurrency(totals.local_charges_subtotal_zar)]);
    }
    if (localChargeRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Local Charges', [22, 101, 52]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Local Charges (Transport/Cartage)', 'ZAR']],
        body: localChargeRows,
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(localChargeRows),
      });
    }

    // Destination Charges
    const destChargeRows = filterZeroRows([
      ['Shipping Line Charges (At Cost)', formatCurrency(estimate.shipping_line_charges_zar)],
      ['Cargo Dues (20FT)', formatCurrency(estimate.cargo_dues_20ft_zar)],
      ['Cargo Dues (40FT)', formatCurrency(estimate.cargo_dues_40ft_zar)],
      ['CTO Fee', formatCurrency(estimate.cto_fee_zar)],
      ['Port Health Inspection', formatCurrency(estimate.port_health_inspection_zar)],
      ['DAFF Inspection', formatCurrency(estimate.daff_inspection_zar)],
      ['State Vet Cancellation Fee', formatCurrency(estimate.state_vet_cancellation_fee_zar)],
      ['JNB Turn In (At Cost)', formatCurrency(estimate.jnb_turn_in_zar)],
    ]);
    if (totals.destination_charges_subtotal_zar > 0) {
      destChargeRows.push(['Sub-Total', formatCurrency(totals.destination_charges_subtotal_zar)]);
    }
    if (destChargeRows.length > 0) {
      let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
      secY = drawSectionDivider(doc, secY, 'Destination Charges', [0, 123, 167]);
      autoTable(doc, {
        startY: secY + 1,
        head: [['Destination Charges', 'ZAR']],
        body: destChargeRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 123, 167], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: chargeTableSubTotalHook(destChargeRows),
      });
    }
  }

  // Customs & Duties
  const customsRows = filterZeroRows([
    ['Customs Value (for reference)', formatCurrency(totals.customs_value_zar)],
    ['Duties', formatCurrency(productTotals.totalDuties || estimate.duties_zar)],
    ['Customs Declaration', formatCurrency(estimate.customs_declaration_zar)],
    ['Agency Fee (3.5% min R1187)', formatCurrency(totals.agency_fee_zar)],
  ]);
  if (totals.customs_subtotal_zar > 0) {
    customsRows.push(['Sub-Total (excl. Import VAT)', formatCurrency(totals.customs_subtotal_zar)]);
  }
  if (customsRows.length > 0) {
    let secY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 30);
    secY = drawSectionDivider(doc, secY, 'Customs & Duties', [146, 64, 14]);
    autoTable(doc, {
      startY: secY + 1,
      head: [['Customs & Duties', 'ZAR']],
      body: customsRows,
      theme: 'striped',
      headStyles: { fillColor: [146, 64, 14], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: chargeTableSubTotalHook(customsRows),
    });
  }

  // === SUMMARY SECTION (prominent dark box) ===
  const summaryData = [
    ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
    ['Total Landed Cost', formatCurrency(totals.total_landed_cost_zar)],
    ['Landed Cost/KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
  ].filter(r => {
    const v = parseFloat((r[1] || '').replace(/[^0-9.-]/g, ''));
    return !isNaN(v) && v !== 0;
  });

  if (summaryData.length > 0) {
    let sumY = checkPageBreak(doc, doc.lastAutoTable.finalY + 4, 50);
    sumY = drawSectionDivider(doc, sumY, 'Summary', themeColor);

    autoTable(doc, {
      startY: sumY + 1,
      head: [['Summary', 'Amount']],
      body: summaryData,
      theme: 'plain',
      headStyles: { fillColor: themeColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 10 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          data.cell.styles.fillColor = themeColor;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          // Make "Total Landed Cost" row larger
          if (data.row.index === 1) {
            data.cell.styles.fontSize = 13;
          }
          // Right-align amount column
          if (data.column.index === 1) {
            data.cell.styles.halign = 'right';
          }
        }
      },
    });
  }

  // === FOOTER (all pages) ===
  const pageCount = doc.internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.height;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Thin gray separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);

    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.setFont(undefined, 'normal');
    // Left: branding
    doc.text('Generated by Synercore Import Schedule', 10, pageHeight - 9);
    // Right: date
    const dateStr = formatDate(new Date().toISOString());
    const dateWidth = doc.getTextWidth(dateStr);
    doc.text(dateStr, pageWidth - dateWidth - 10, pageHeight - 9);
    // Center: page number (if multi-page)
    if (pageCount > 1) {
      const pageText = `Page ${i} of ${pageCount}`;
      const ptWidth = doc.getTextWidth(pageText);
      doc.text(pageText, (pageWidth - ptWidth) / 2, pageHeight - 9);
    }
  }

  doc.save(`cost-estimate-${estimate.reference_number || estimate.id}.pdf`);
}

/**
 * Generate PDF as base64 string for email attachment
 */
export function generateEstimatePDFBase64(estimate) {
  const doc = new jsPDF();
  const totals = calculateAllTotals(estimate);
  const productTotals = getProductTotals(estimate);

  buildEstimateHeader(doc, estimate, productTotals, totals);

  const isAir = (estimate.transport_mode || 'sea') === 'air';

  if (isAir) {
    // Airfreight Charges
    const airRows = filterZeroRows([
      ['Airfreight (USD)', formatCurrency(estimate.airfreight_usd, 'USD'), formatCurrency(totals._airfreight_usd_zar)],
      ['Airfreight (EUR)', formatCurrency(estimate.airfreight_eur, 'EUR'), formatCurrency(totals._airfreight_eur_zar)],
    ]);
    if (totals.airfreight_total_zar > 0) {
      airRows.push(['Total Airfreight', '', formatCurrency(totals.airfreight_total_zar)]);
    }
    if (airRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Airfreight', 'Amount', 'ZAR']],
        body: airRows,
        theme: 'grid',
        headStyles: { fillColor: [124, 58, 237] },
      });
    }

    // Surcharges
    const surchargeRows = filterZeroRows([
      ['Fuel Surcharge (USD)', formatCurrency(estimate.fuel_surcharge_usd, 'USD'), formatCurrency((parseFloat(estimate.fuel_surcharge_usd) || 0) * (parseFloat(estimate.roe_origin) || 0))],
      ['Fuel Surcharge (EUR)', formatCurrency(estimate.fuel_surcharge_eur, 'EUR'), formatCurrency((parseFloat(estimate.fuel_surcharge_eur) || 0) * (parseFloat(estimate.roe_eur) || 0))],
      ['Security Surcharge (USD)', formatCurrency(estimate.security_surcharge_usd, 'USD'), formatCurrency((parseFloat(estimate.security_surcharge_usd) || 0) * (parseFloat(estimate.roe_origin) || 0))],
      ['Security Surcharge (EUR)', formatCurrency(estimate.security_surcharge_eur, 'EUR'), formatCurrency((parseFloat(estimate.security_surcharge_eur) || 0) * (parseFloat(estimate.roe_eur) || 0))],
    ]);
    if (totals.fuel_surcharge_total_zar > 0 || totals.security_surcharge_total_zar > 0) {
      surchargeRows.push(['Total Surcharges', '', formatCurrency((totals.fuel_surcharge_total_zar || 0) + (totals.security_surcharge_total_zar || 0))]);
    }
    if (surchargeRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Surcharges', 'Amount', 'ZAR']],
        body: surchargeRows,
        theme: 'grid',
        headStyles: { fillColor: [109, 40, 217] },
      });
    }

    // Origin & Local Charges
    const airLocalRows = filterZeroRows([
      ['Origin Charges (USD)', formatCurrency(estimate.airfreight_origin_charges_usd, 'USD')],
      ['Origin Charges (EUR)', formatCurrency(estimate.airfreight_origin_charges_eur, 'EUR')],
      ['Screening Fee', formatCurrency(estimate.screening_fee_zar)],
      ['AWB Fee', formatCurrency(estimate.awb_fee_zar)],
      ['Airline Handling Fee', formatCurrency(estimate.airline_handling_fee_zar)],
      ['Airport Transfer Fee', formatCurrency(estimate.airport_transfer_fee_zar)],
      ['Cartage: Airport to Warehouse', formatCurrency(estimate.cartage_airport_to_whs_zar)],
      ['Insurance', formatCurrency(totals.airfreight_insurance_zar)],
    ]);
    if (totals.airfreight_origin_charges_zar > 0 || totals.air_local_charges_subtotal_zar > 0) {
      airLocalRows.push(['Sub-Total', formatCurrency((totals.airfreight_origin_charges_zar || 0) + (totals.air_local_charges_subtotal_zar || 0) + (totals.airfreight_insurance_zar || 0))]);
    }
    if (airLocalRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Origin & Local Charges', 'Amount']],
        body: airLocalRows,
        theme: 'grid',
        headStyles: { fillColor: [22, 101, 52] },
      });
    }
  } else {
    // Sea freight summary for email
    const seaSummaryRows = filterZeroRows([
      ['Ocean Freight', formatCurrency(totals.total_ocean_freight_zar)],
      ['Origin Charges', formatCurrency(totals.total_origin_charges_zar)],
      ['Local Charges', formatCurrency(totals.local_charges_subtotal_zar)],
      ['Destination Charges', formatCurrency(totals.destination_charges_subtotal_zar)],
    ]);
    if (seaSummaryRows.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Shipping Charges', 'ZAR']],
        body: seaSummaryRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      });
    }
  }

  // Customs & Duties
  const customsRows = filterZeroRows([
    ['Customs Value', formatCurrency(totals.customs_value_zar)],
    ['Duties', formatCurrency(productTotals.totalDuties || estimate.duties_zar)],
    ['Agency Fee', formatCurrency(totals.agency_fee_zar)],
  ]);
  if (customsRows.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Customs & Duties', 'ZAR']],
      body: customsRows,
      theme: 'grid',
      headStyles: { fillColor: [146, 64, 14] },
    });
  }

  // Summary
  const summaryRows = filterZeroRows([
    ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
    ['Total Landed Cost', formatCurrency(totals.total_landed_cost_zar)],
    ['Landed Cost/KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
  ]);
  if (summaryRows.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Summary', 'Amount']],
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: [11, 31, 58] },
      bodyStyles: { fontStyle: 'bold' },
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Generated by Synercore Import Schedule', 14, doc.internal.pageSize.height - 10);

  return doc.output('datauristring').split(',')[1];
}

/**
 * Generate a cost analysis report PDF
 * @param {Object} options
 * @param {Object} options.chartData - getSupplierChartData computed value
 * @param {string} options.selectedProduct - 'all' or specific product name
 * @param {string} options.selectedSupplier - 'all' or specific supplier name
 * @param {Object|null} options.chartRef - React ref to the chart component
 * @param {Array} options.filteredEstimates - filtered estimate list
 */
export async function generateReportPDF({ chartData, selectedProduct, selectedSupplier, transportModeFilter, chartRef, filteredEstimates }) {
  const doc = new jsPDF();
  const productLabel = selectedProduct === 'all' ? 'All Products' : selectedProduct;
  const supplierLabel = selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier;
  const modeLabel = transportModeFilter === 'sea' ? 'Sea Freight' : transportModeFilter === 'air' ? 'Air Freight' : 'All Modes';

  // Header
  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, 220, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Cost Analysis Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Supplier: ${supplierLabel}  |  Mode: ${modeLabel}`, 14, 25);
  doc.text(`Product: ${productLabel}`, 14, 33);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 140, 33);

  // Try to capture chart as image
  if (chartRef?.current) {
    try {
      const chartCanvas = chartRef.current.canvas;
      const chartImage = chartCanvas.toDataURL('image/png', 1.0);
      doc.addImage(chartImage, 'PNG', 14, 47, 180, 80);
    } catch (err) {
      doc.setTextColor(100);
      doc.setFontSize(10);
      doc.text('Chart could not be rendered in PDF', 14, 65);
    }
  }

  // Summary Statistics
  const totalEstimates = chartData.supplierDetails.reduce((sum, s) => sum + s.estimateCount, 0);
  const totalWeight = chartData.supplierDetails.reduce((sum, s) => sum + s.totalWeight, 0);
  const totalCost = chartData.supplierDetails.reduce((sum, s) => sum + s.totalCost, 0);
  const avgCostPerKg = totalWeight > 0 ? totalCost / totalWeight : 0;

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text('Summary Statistics', 14, 132);

  autoTable(doc, {
    startY: 138,
    head: [['Metric', 'Value']],
    body: [
      ['Total Suppliers', chartData.labels.length.toString()],
      ['Total Estimates', totalEstimates.toString()],
      ['Total Weight', `${formatNumber(totalWeight)} kg`],
      ['Total Cost', formatCurrency(totalCost)],
      ['Average Cost/KG', formatCurrency(avgCostPerKg)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [91, 33, 182] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
    },
  });

  // Supplier Details Table
  doc.setFontSize(12);
  doc.text('Supplier Cost Breakdown', 14, doc.lastAutoTable.finalY + 15);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Supplier', 'Estimates', 'Weight (kg)', 'Total Cost (ZAR)', 'Cost/KG (ZAR)']],
    body: chartData.supplierDetails.map(s => [
      s.name,
      s.estimateCount.toString(),
      formatNumber(s.totalWeight),
      formatCurrency(s.totalCost),
      formatCurrency(s.costPerKg),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [91, 33, 182] },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  // Filter estimates by selected supplier and product
  const relevantEstimates = filteredEstimates.filter(est => {
    if (selectedSupplier !== 'all' && est.supplier_name !== selectedSupplier) return false;
    if (selectedProduct !== 'all') {
      const hasProduct = (est.products || []).some(p => p.name === selectedProduct);
      if (!hasProduct) return false;
    }
    return true;
  });

  // Detailed Estimates with Products
  doc.addPage();
  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, 220, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Complete Estimates with Product Details', 14, 16);

  let currentY = 35;

  relevantEstimates.forEach((est, estIndex) => {
    const totals = calculateAllTotals(est);
    const products = (est.products || []).filter(p =>
      selectedProduct === 'all' || p.name === selectedProduct
    );

    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    // Estimate Header
    doc.setFillColor(240, 240, 250);
    doc.rect(10, currentY - 5, 190, 36, 'F');
    doc.setDrawColor(91, 33, 182);
    doc.setLineWidth(0.5);
    doc.rect(10, currentY - 5, 190, 36, 'S');

    doc.setTextColor(91, 33, 182);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`${estIndex + 1}. ${est.reference_number || est.id.slice(0, 8)}`, 14, currentY + 3);

    doc.setTextColor(60);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Supplier: ${est.supplier_name || '-'}`, 14, currentY + 11);
    doc.text(`Port: ${est.port_of_discharge || '-'}`, 80, currentY + 11);
    doc.text(`Container: ${est.container_type || '-'}`, 130, currentY + 11);

    // ROE info per estimate
    doc.setTextColor(0, 102, 204);
    doc.text(`ROE Date: ${formatDate(est.costing_date)}`, 14, currentY + 19);
    doc.text(`USD/ZAR: ${formatNumber(est.roe_origin || 0, 4)}`, 80, currentY + 19);
    doc.text(`EUR/ZAR: ${formatNumber(est.roe_eur || 0, 4)}`, 130, currentY + 19);

    doc.setFont(undefined, 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(`Total Cost: ${formatCurrency(totals.total_in_warehouse_cost_zar)}`, 14, currentY + 27);
    doc.setTextColor(217, 119, 6);
    doc.text(`Cost/KG: ${formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)}`, 80, currentY + 27);

    currentY += 40;

    // Products Table for this estimate
    if (products.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['Product Name', 'HS Code', 'Pack Size', 'Pack Type', 'Weight (kg)', 'Rate/kg', 'Currency', 'Invoice Value', 'Duty %', 'Sch1 %']],
        body: products.map(p => [
          p.name || '-',
          p.hs_code || '-',
          p.pack_size || '-',
          p.pack_type || '-',
          formatNumber(p.weight_kg),
          formatNumber(p.rate_per_kg),
          p.currency || 'USD',
          formatNumber(p.invoice_value),
          `${p.duty_percent || 0}%`,
          `${p.duty_schedule1_percent || 0}%`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], fontSize: 7, textColor: [255, 255, 255] },
        styles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 30 },
          4: { halign: 'right' },
          5: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'center' },
          9: { halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = doc.lastAutoTable.finalY + 15;
    } else {
      doc.setTextColor(150);
      doc.setFontSize(8);
      doc.text('No products in this estimate', 14, currentY + 5);
      currentY += 15;
    }
  });

  // Product Comparison Table (if filtering by specific product)
  if (selectedProduct !== 'all') {
    doc.addPage();
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, 220, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(`Product Comparison: ${selectedProduct}`, 14, 16);

    const productComparison = [];
    relevantEstimates.forEach(est => {
      const totals = calculateAllTotals(est);
      (est.products || [])
        .filter(p => p.name === selectedProduct)
        .forEach(p => {
          productComparison.push([
            est.reference_number || est.id.slice(0, 8),
            est.supplier_name || '-',
            p.hs_code || '-',
            p.pack_size || '-',
            p.pack_type || '-',
            `${formatNumber(p.weight_kg)} kg`,
            `${formatNumber(p.rate_per_kg)} ${p.currency || 'USD'}`,
            `${formatNumber(p.invoice_value)} ${p.currency || 'USD'}`,
            formatCurrency(totals.all_in_warehouse_cost_per_kg_zar),
          ]);
        });
    });

    autoTable(doc, {
      startY: 32,
      head: [['Reference', 'Supplier', 'HS Code', 'Pack Size', 'Pack Type', 'Weight', 'Rate/kg', 'Invoice Value', 'All-in Cost/kg']],
      body: productComparison,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], fontSize: 8 },
      styles: { fontSize: 7 },
      columnStyles: {
        8: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  // Footer on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} | Generated by Synercore Import Schedule`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  const fileSupplier = supplierLabel.replace(/\s+/g, '-').toLowerCase();
  const fileProduct = productLabel.replace(/\s+/g, '-').toLowerCase();
  doc.save(`cost-report-${fileSupplier}-${fileProduct}-${new Date().toISOString().split('T')[0]}.pdf`);
}
