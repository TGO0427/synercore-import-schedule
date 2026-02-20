/**
 * PDF generation utilities for Import Costing
 * Extracted from ImportCosting.jsx for maintainability
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAllTotals, formatCurrency, formatNumber } from './costingCalculations';

// Shared helper: filter rows where the last column is zero
const filterZeroRows = (rows) => rows.filter(row => {
  const value = row[row.length - 1];
  if (typeof value === 'string') {
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return !isNaN(numericValue) && numericValue !== 0;
  }
  return value !== 0 && value !== '-';
});

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

// Shared helper: render header, ROE info, shipment details, and products table
const buildEstimateHeader = (doc, estimate, productTotals) => {
  const products = estimate.products || [];

  // Header
  doc.setFontSize(18);
  doc.setTextColor(11, 31, 58);
  doc.text('FCL Import Cost Estimate', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Reference: ${estimate.reference_number || 'N/A'}`, 14, 28);
  doc.text(`Date: ${estimate.costing_date || 'N/A'}`, 14, 34);
  doc.text(`Supplier: ${estimate.supplier_name || 'N/A'}`, 14, 40);

  // ROE Information
  doc.setFontSize(9);
  doc.setTextColor(0, 102, 204);
  doc.setFont(undefined, 'bold');
  const roeDate = estimate.costing_date || new Date().toISOString().split('T')[0];
  doc.text(`ROE Date: ${roeDate}`, 130, 28);
  doc.text(`USD/ZAR: ${formatNumber(estimate.roe_origin || 0, 4)}`, 130, 34);
  doc.text(`EUR/ZAR: ${formatNumber(estimate.roe_eur || 0, 4)}`, 130, 40);
  doc.setFont(undefined, 'normal');

  // Shipment Details
  const shipmentRows = filterZeroRows([
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
    startY: 48,
    head: [['Shipment Details', '']],
    body: shipmentRows,
    theme: 'grid',
    headStyles: { fillColor: [11, 31, 58] },
  });

  // Products in Container
  if (products.length > 0) {
    const roeCustoms = parseFloat(estimate.roe_customs) || parseFloat(estimate.roe_origin) || 0;
    const roeEur = parseFloat(estimate.roe_eur) || roeCustoms;

    const productRows = products.map(p => {
      const weight = parseFloat(p.weight_kg) || 0;
      const ratePerKg = parseFloat(p.rate_per_kg) || 0;
      const invoiceValue = parseFloat(p.invoice_value) || 0;
      const dutyPercent = parseFloat(p.duty_percent) || 0;
      const dutySchedule1Percent = parseFloat(p.duty_schedule1_percent) || 0;
      const currency = p.currency || 'USD';

      let roe = roeCustoms;
      if (currency === 'EUR') roe = roeEur;
      if (currency === 'ZAR') roe = 1;

      const customsValue = invoiceValue * roe;
      const duties = customsValue * ((dutyPercent + dutySchedule1Percent) / 100);
      const weightPercent = productTotals.totalWeight > 0 ? (weight / productTotals.totalWeight * 100) : 0;

      return [
        p.name || '-',
        p.hs_code || '-',
        p.pack_size || '-',
        p.pack_type || '-',
        `${formatNumber(weight)} kg`,
        `${formatNumber(ratePerKg, 2)}`,
        currency,
        formatNumber(invoiceValue, 2),
        `${formatNumber(weightPercent, 1)}%`,
        formatCurrency(duties),
      ];
    });

    productRows.push([
      'TOTAL', '', '', '', `${formatNumber(productTotals.totalWeight)} kg`, '', '', '', '100%', formatCurrency(productTotals.totalDuties),
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Product', 'HS Code', 'Pack Size', 'Pack Type', 'Weight', 'Rate/kg', 'Curr', 'Invoice Val', 'Share', 'Duties']],
      body: productRows,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 8 },
    });
  }
};

/**
 * Generate and save a full PDF for a cost estimate
 */
export function generateEstimatePDF(estimate) {
  const doc = new jsPDF();
  const totals = calculateAllTotals(estimate);
  const productTotals = getProductTotals(estimate);

  buildEstimateHeader(doc, estimate, productTotals);

  // Ocean Freight
  const oceanFreightRows = filterZeroRows([
    ['Ocean Freight (USD)', formatCurrency(estimate.ocean_freight_usd, 'USD'), formatCurrency(totals._ocean_freight_usd_zar)],
    ['Ocean Freight (EUR)', formatCurrency(estimate.ocean_freight_eur, 'EUR'), formatCurrency(totals._ocean_freight_eur_zar)],
  ]);
  if (totals.total_ocean_freight_zar > 0) {
    oceanFreightRows.push(['Total Ocean Freight', '', formatCurrency(totals.total_ocean_freight_zar)]);
  }
  if (oceanFreightRows.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Ocean Freight', 'Amount', 'ZAR']],
      body: oceanFreightRows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
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
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Origin Charges', 'Amount', 'ZAR']],
      body: originRows,
      theme: 'grid',
      headStyles: { fillColor: [46, 139, 87] },
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
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Local Charges (Transport/Cartage)', 'ZAR']],
      body: localChargeRows,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
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
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Destination Charges', 'ZAR']],
      body: destChargeRows,
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 167] },
    });
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
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Customs & Duties', 'ZAR']],
      body: customsRows,
      theme: 'grid',
      headStyles: { fillColor: [146, 64, 14] },
    });
  }

  // Summary Totals
  const summaryRows = filterZeroRows([
    ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
    ['Total in Warehouse Cost', formatCurrency(totals.total_in_warehouse_cost_zar)],
    ['Cost per KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
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

  doc.save(`cost-estimate-${estimate.reference_number || estimate.id}.pdf`);
}

/**
 * Generate PDF as base64 string for email attachment
 */
export function generateEstimatePDFBase64(estimate) {
  const doc = new jsPDF();
  const totals = calculateAllTotals(estimate);
  const productTotals = getProductTotals(estimate);

  buildEstimateHeader(doc, estimate, productTotals);

  // Summary (simplified for email)
  const summaryRows = filterZeroRows([
    ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
    ['Total in Warehouse Cost', formatCurrency(totals.total_in_warehouse_cost_zar)],
    ['Cost per KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
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
export async function generateReportPDF({ chartData, selectedProduct, selectedSupplier, chartRef, filteredEstimates }) {
  const doc = new jsPDF();
  const productLabel = selectedProduct === 'all' ? 'All Products' : selectedProduct;
  const supplierLabel = selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier;

  // Header
  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, 220, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Cost Analysis Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Supplier: ${supplierLabel}`, 14, 25);
  doc.text(`Product: ${productLabel}`, 14, 33);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 140, 33);

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
    doc.text(`ROE Date: ${est.costing_date || '-'}`, 14, currentY + 19);
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
