/**
 * Costing Calculations Utility
 * Frontend calculations for import cost estimates
 */

/**
 * Calculate DAVIF: 3.25% of customs value, minimum R125
 */
export const calculateDAVIF = (customsValue) => {
  if (!customsValue || customsValue <= 0) return 0;
  const percentage = customsValue * 0.0325;
  return Math.max(percentage, 125);
};

/**
 * Calculate origin charge in ZAR
 */
export const calculateOriginChargeZAR = (originChargeUSD, roeOrigin) => {
  return (originChargeUSD || 0) * (roeOrigin || 0);
};

/**
 * Calculate local charges (transport/cartage) subtotal
 */
export const calculateLocalChargesSubtotal = (data) => {
  return (
    (parseFloat(data.local_cartage_cpt_klapmuts_20ton_zar) || 0) +
    (parseFloat(data.local_cartage_cpt_klapmuts_28ton_zar) || 0) +
    (parseFloat(data.transport_dbn_to_pretoria_20ft_zar) || 0) +
    (parseFloat(data.transport_dbn_to_pretoria_40ft_zar) || 0) +
    (parseFloat(data.transport_dbn_to_whs_zar) || 0) +
    (parseFloat(data.unpack_reload_zar) || 0) +
    (parseFloat(data.storage_zar) || 0) +
    (parseFloat(data.outlying_depot_surcharge_zar) || 0) +
    (parseFloat(data.local_cartage_dbn_whs_pretoria_opt_a_zar) || 0) +
    (parseFloat(data.local_cartage_dbn_whs_pretoria_opt_b_zar) || 0) +
    (parseFloat(data.local_cartage_dbn_whs_pretoria_6m_zar) || 0) +
    (parseFloat(data.local_cartage_dbn_whs_pretoria_12m_zar) || 0) +
    (parseFloat(data.transport_pe_coega_to_pretoria_zar) || 0)
  );
};

/**
 * Calculate destination charges (port/shipping) subtotal
 */
export const calculateDestinationSubtotal = (data) => {
  return (
    (parseFloat(data.shipping_line_charges_zar) || 0) +
    (parseFloat(data.cargo_dues_20ft_zar) || 0) +
    (parseFloat(data.cargo_dues_40ft_zar) || 0) +
    (parseFloat(data.cto_fee_zar) || 0) +
    (parseFloat(data.port_health_inspection_zar) || 0) +
    (parseFloat(data.daff_inspection_zar) || 0) +
    (parseFloat(data.state_vet_cancellation_fee_zar) || 0) +
    (parseFloat(data.jnb_turn_in_zar) || 0)
  );
};

/**
 * Calculate agency fee: 3.5% of (duties + import VAT), minimum R1187
 */
export const calculateAgencyFee = (dutiesAndVat, percentage = 3.5, min = 1187) => {
  if (!dutiesAndVat || dutiesAndVat <= 0) return min; // Always charge minimum
  const calculated = dutiesAndVat * (percentage / 100);
  return Math.max(calculated, min);
};

/**
 * Calculate customs totals from products
 */
export const calculateCustomsItemsTotals = (data) => {
  const items = data.products || data.customs_items || [];
  const roeCustoms = parseFloat(data.roe_customs) || parseFloat(data.roe_origin) || 0;
  const roeEur = parseFloat(data.roe_eur) || roeCustoms;

  let totalCustomsValue = 0;
  let totalDuties = 0;
  let totalSchedule1Duty = 0;
  let totalVat = 0;

  items.forEach(item => {
    const invoiceValue = parseFloat(item.invoice_value) || 0;
    const dutyPercent = parseFloat(item.duty_percent) || 0;
    const dutySchedule1Percent = parseFloat(item.duty_schedule1_percent) || 0;
    const currency = item.currency || 'USD';

    // Convert to ZAR based on currency
    let roe = roeCustoms;
    if (currency === 'EUR') roe = roeEur;
    if (currency === 'ZAR') roe = 1;

    const customsValue = invoiceValue * roe;
    const duties = customsValue * (dutyPercent / 100);
    const schedule1Duty = customsValue * (dutySchedule1Percent / 100);
    const vat = (customsValue + duties + schedule1Duty) * 0.15;

    totalCustomsValue += customsValue;
    totalDuties += duties;
    totalSchedule1Duty += schedule1Duty;
    totalVat += vat;
  });

  return { totalCustomsValue, totalDuties, totalSchedule1Duty, totalVat };
};

/**
 * Calculate customs subtotal (duties + declaration + agency fee)
 * Note: VAT is excluded as it's not charged to clients
 */
export const calculateCustomsSubtotal = (data, agencyFee) => {
  const customsTotals = calculateCustomsItemsTotals(data);
  return (
    customsTotals.totalDuties +
    customsTotals.totalSchedule1Duty +
    (parseFloat(data.customs_declaration_zar) || 0) +
    (agencyFee || 0)
  );
};

/**
 * Calculate EUR to ZAR conversion
 */
export const calculateEurChargeZAR = (originChargeEur, roeEur) => {
  return (originChargeEur || 0) * (roeEur || 0);
};

/**
 * Calculate Customs Value from invoice values
 */
export const calculateCustomsValue = (data) => {
  const roeOrigin = parseFloat(data.roe_origin) || 0;
  const roeEur = parseFloat(data.roe_eur) || 0;
  const invoiceValueUsd = parseFloat(data.invoice_value_usd) || 0;
  const invoiceValueEur = parseFloat(data.invoice_value_eur) || 0;

  return (invoiceValueUsd * roeOrigin) + (invoiceValueEur * roeEur);
};

/**
 * Calculate all totals from form data
 */
export const calculateAllTotals = (data) => {
  const roeOrigin = parseFloat(data.roe_origin) || 0;  // USD/ZAR
  const roeEur = parseFloat(data.roe_eur) || 0;        // EUR/ZAR
  const originChargeUsd = parseFloat(data.origin_charge_usd) || 0;
  const originChargeEur = parseFloat(data.origin_charge_eur) || 0;
  const oceanFreightUsd = parseFloat(data.ocean_freight_usd) || 0;
  const oceanFreightEur = parseFloat(data.ocean_freight_eur) || 0;

  // Calculate total weight from products or use legacy field
  const productsWeight = (data.products || []).reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
  const totalGrossWeightKg = productsWeight > 0 ? productsWeight : (parseFloat(data.total_gross_weight_kg) || 0);

  // Calculate Customs Value from customs items (new structure) or legacy invoice values
  const customsItemsTotals = calculateCustomsItemsTotals(data);
  const customsValueZar = customsItemsTotals.totalCustomsValue > 0
    ? customsItemsTotals.totalCustomsValue
    : calculateCustomsValue(data);

  // Ocean freight conversion (both USD and EUR)
  const oceanFreightUsdZar = oceanFreightUsd * roeOrigin;
  const oceanFreightEurZar = oceanFreightEur * roeEur;
  const totalOceanFreightZar = oceanFreightUsdZar + oceanFreightEurZar;

  // Origin charges conversion (both USD and EUR)
  const originChargeUsdZar = calculateOriginChargeZAR(originChargeUsd, roeOrigin);
  const originChargeEurZar = calculateEurChargeZAR(originChargeEur, roeEur);
  const totalOriginChargesZar = originChargeUsdZar + originChargeEurZar;

  // Local charges subtotal (transport/cartage)
  const localChargesSubtotalZar = calculateLocalChargesSubtotal(data);

  // Destination charges subtotal (port/shipping)
  const destinationChargesSubtotalZar = calculateDestinationSubtotal(data);

  // Import VAT (15% of customs value + duties)
  const importVatZar = customsItemsTotals.totalVat;

  // Total duties and Import VAT (base for agency fee calculation)
  const totalDutiesAndVat = customsItemsTotals.totalDuties + customsItemsTotals.totalSchedule1Duty + importVatZar;

  // Agency fee: 3.5% of (duties + Import VAT), min R1187
  const agencyFeePercent = parseFloat(data.agency_fee_percentage) || 3.5;
  const agencyFeeMin = parseFloat(data.agency_fee_min) || 1187;
  const agencyFeeZar = calculateAgencyFee(totalDutiesAndVat, agencyFeePercent, agencyFeeMin);

  // Customs subtotal from items + declaration + agency (EXCLUDING Import VAT - not charged to clients)
  const customsSubtotalZar = customsItemsTotals.totalCustomsValue > 0
    ? (customsItemsTotals.totalDuties + customsItemsTotals.totalSchedule1Duty +
       (parseFloat(data.customs_declaration_zar) || 0) + agencyFeeZar)
    : calculateCustomsSubtotal(data, agencyFeeZar);

  // Total shipping cost (ocean freight + origin + local + destination charges)
  const totalShippingCostZar = totalOceanFreightZar + totalOriginChargesZar + localChargesSubtotalZar + destinationChargesSubtotalZar;

  // Total in warehouse cost (shipping + customs) - VAT excluded
  const totalInWarehouseCostZar = totalShippingCostZar + customsSubtotalZar;

  // Cost per KG
  const allInWarehouseCostPerKgZar = totalGrossWeightKg > 0
    ? totalInWarehouseCostZar / totalGrossWeightKg
    : 0;

  return {
    // Database columns (will be saved)
    customs_value_zar: Math.round(customsValueZar * 100) / 100,
    ocean_freight_zar: Math.round(totalOceanFreightZar * 100) / 100,
    total_ocean_freight_zar: Math.round(totalOceanFreightZar * 100) / 100,
    origin_charge_zar: Math.round((originChargeUsdZar + originChargeEurZar) * 100) / 100,
    total_origin_charges_zar: Math.round(totalOriginChargesZar * 100) / 100,
    local_charges_subtotal_zar: Math.round(localChargesSubtotalZar * 100) / 100,
    destination_charges_subtotal_zar: Math.round(destinationChargesSubtotalZar * 100) / 100,
    import_vat_zar: Math.round(importVatZar * 100) / 100,
    total_duties_zar: Math.round((customsItemsTotals.totalDuties + customsItemsTotals.totalSchedule1Duty) * 100) / 100,
    agency_fee_zar: Math.round(agencyFeeZar * 100) / 100,
    customs_subtotal_zar: Math.round(customsSubtotalZar * 100) / 100,
    total_shipping_cost_zar: Math.round(totalShippingCostZar * 100) / 100,
    total_in_warehouse_cost_zar: Math.round(totalInWarehouseCostZar * 100) / 100,
    all_in_warehouse_cost_per_kg_zar: Math.round(allInWarehouseCostPerKgZar * 100) / 100,
    // Display-only fields (not saved to database, used for form display)
    _ocean_freight_usd_zar: Math.round(oceanFreightUsdZar * 100) / 100,
    _ocean_freight_eur_zar: Math.round(oceanFreightEurZar * 100) / 100,
    _origin_charge_usd_zar: Math.round(originChargeUsdZar * 100) / 100,
    _origin_charge_eur_zar: Math.round(originChargeEurZar * 100) / 100,
  };
};

/**
 * Format currency for display
 */
export const formatCurrency = (value, currency = 'ZAR') => {
  if (value === null || value === undefined || isNaN(value)) return '-';

  const formatter = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(value);
};

/**
 * Format number for display
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return Number(value).toLocaleString('en-ZA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Container type options
 */
export const CONTAINER_TYPES = [
  { value: "20' Dry Container", label: "20' Dry Container" },
  { value: "40' Dry Container", label: "40' Dry Container" },
  { value: "40' High Cube", label: "40' High Cube" },
  { value: "20' Reefer", label: "20' Reefer" },
  { value: "40' Reefer", label: "40' Reefer" },
];

/**
 * INCO terms options
 */
export const INCO_TERMS = [
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'CPT', label: 'CPT - Carriage Paid To' },
  { value: 'CIP', label: 'CIP - Carriage and Insurance Paid' },
  { value: 'DAP', label: 'DAP - Delivered at Place' },
  { value: 'DPU', label: 'DPU - Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
  { value: 'FAS', label: 'FAS - Free Alongside Ship' },
  { value: 'FOB', label: 'FOB - Free on Board' },
  { value: 'CFR', label: 'CFR - Cost and Freight' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
];

/**
 * Port options (Africa)
 */
export const AFRICAN_PORTS = [
  // South Africa
  { value: 'CPT', label: 'Cape Town (CPT) - South Africa' },
  { value: 'DBN', label: 'Durban (DBN) - South Africa' },
  { value: 'PLZ', label: 'Port Elizabeth (PLZ) - South Africa' },
  { value: 'ELS', label: 'East London (ELS) - South Africa' },
  { value: 'RCB', label: 'Richards Bay (RCB) - South Africa' },
  { value: 'JNB', label: 'Johannesburg (JNB) - South Africa (Inland)' },
  { value: 'NGQ', label: 'Ngqura/Coega (NGQ) - South Africa' },
  { value: 'SDB', label: 'Saldanha Bay (SDB) - South Africa' },
  // East Africa
  { value: 'MBA', label: 'Mombasa (MBA) - Kenya' },
  { value: 'DAR', label: 'Dar es Salaam (DAR) - Tanzania' },
  { value: 'MPS', label: 'Maputo (MPS) - Mozambique' },
  { value: 'BEW', label: 'Beira (BEW) - Mozambique' },
  { value: 'NCL', label: 'Nacala (NCL) - Mozambique' },
  { value: 'DIJ', label: 'Djibouti (DIJ) - Djibouti' },
  { value: 'PTL', label: 'Port Louis (PTL) - Mauritius' },
  { value: 'MGN', label: 'Mogadishu (MGN) - Somalia' },
  { value: 'BRB', label: 'Berbera (BRB) - Somalia' },
  { value: 'MSW', label: 'Massawa (MSW) - Eritrea' },
  { value: 'TNR', label: 'Toamasina (TNR) - Madagascar' },
  // Southern Africa
  { value: 'WDH', label: 'Walvis Bay (WDH) - Namibia' },
  { value: 'LLW', label: 'Lilongwe (LLW) - Malawi (Inland)' },
  { value: 'LUN', label: 'Lusaka (LUN) - Zambia (Inland)' },
  { value: 'HRE', label: 'Harare (HRE) - Zimbabwe (Inland)' },
  { value: 'GBE', label: 'Gaborone (GBE) - Botswana (Inland)' },
  { value: 'MTS', label: 'Matsapha (MTS) - Eswatini (Inland)' },
  { value: 'MSU', label: 'Maseru (MSU) - Lesotho (Inland)' },
  // West Africa
  { value: 'LOS', label: 'Lagos/Apapa (LOS) - Nigeria' },
  { value: 'TIN', label: 'Tin Can Island (TIN) - Nigeria' },
  { value: 'ONN', label: 'Onne (ONN) - Nigeria' },
  { value: 'ACC', label: 'Tema (ACC) - Ghana' },
  { value: 'TKD', label: 'Takoradi (TKD) - Ghana' },
  { value: 'ABJ', label: 'Abidjan (ABJ) - Ivory Coast' },
  { value: 'DKR', label: 'Dakar (DKR) - Senegal' },
  { value: 'COO', label: 'Cotonou (COO) - Benin' },
  { value: 'LME', label: 'Lomé (LME) - Togo' },
  { value: 'CNK', label: 'Conakry (CNK) - Guinea' },
  { value: 'FNA', label: 'Freetown (FNA) - Sierra Leone' },
  { value: 'MLW', label: 'Monrovia (MLW) - Liberia' },
  { value: 'BJL', label: 'Banjul (BJL) - Gambia' },
  { value: 'NKC', label: 'Nouakchott (NKC) - Mauritania' },
  { value: 'BSU', label: 'Bissau (BSU) - Guinea-Bissau' },
  { value: 'PRY', label: 'Praia (PRY) - Cape Verde' },
  // Central Africa
  { value: 'DLA', label: 'Douala (DLA) - Cameroon' },
  { value: 'LBV', label: 'Libreville (LBV) - Gabon' },
  { value: 'POG', label: 'Port-Gentil (POG) - Gabon' },
  { value: 'PNR', label: 'Pointe-Noire (PNR) - Congo' },
  { value: 'LUA', label: 'Luanda (LUA) - Angola' },
  { value: 'LOB', label: 'Lobito (LOB) - Angola' },
  { value: 'MAT', label: 'Matadi (MAT) - DRC' },
  { value: 'MLA', label: 'Malabo (MLA) - Equatorial Guinea' },
  { value: 'STP', label: 'São Tomé (STP) - São Tomé and Príncipe' },
  // North Africa
  { value: 'TNG', label: 'Tanger Med (TNG) - Morocco' },
  { value: 'CAS', label: 'Casablanca (CAS) - Morocco' },
  { value: 'ALG', label: 'Algiers (ALG) - Algeria' },
  { value: 'TUN', label: 'Tunis (TUN) - Tunisia' },
  { value: 'TIP', label: 'Tripoli (TIP) - Libya' },
  { value: 'ALY', label: 'Alexandria (ALY) - Egypt' },
  { value: 'PSD', label: 'Port Said (PSD) - Egypt' },
  { value: 'DAM', label: 'Damietta (DAM) - Egypt' },
  { value: 'SKH', label: 'Sokhna (SKH) - Egypt' },
  { value: 'SUZ', label: 'Suez (SUZ) - Egypt' },
  { value: 'PTS', label: 'Port Sudan (PTS) - Sudan' },
];

// Keep backward-compatible alias
export const SA_PORTS = AFRICAN_PORTS;

/**
 * Load type options (LCL / FCL)
 */
export const LOAD_TYPES = [
  { value: 'FCL', label: 'FCL - Full Container Load' },
  { value: 'LCL', label: 'LCL - Less than Container Load' },
];

export default {
  calculateDAVIF,
  calculateOriginChargeZAR,
  calculateLocalChargesSubtotal,
  calculateDestinationSubtotal,
  calculateAgencyFee,
  calculateCustomsSubtotal,
  calculateAllTotals,
  formatCurrency,
  formatNumber,
  CONTAINER_TYPES,
  INCO_TERMS,
  SA_PORTS,
  AFRICAN_PORTS,
  LOAD_TYPES,
};
