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
 * Calculate agency fee: 3.5% of customs value, minimum R1187
 */
export const calculateAgencyFee = (customsValue) => {
  if (!customsValue || customsValue <= 0) return 0;
  const percentage = customsValue * 0.035;
  return Math.max(percentage, 1187);
};

/**
 * Calculate customs subtotal (duties + VAT + declaration + agency fee)
 */
export const calculateCustomsSubtotal = (data, agencyFee, customsDutyNotApplicable) => {
  const duties = customsDutyNotApplicable ? 0 : (parseFloat(data.duties_zar) || 0);
  return (
    duties +
    (parseFloat(data.customs_vat_zar) || 0) +
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
  const totalGrossWeightKg = parseFloat(data.total_gross_weight_kg) || 0;

  // Calculate Customs Value from invoice values (auto-calculated)
  const customsValueZar = calculateCustomsValue(data);

  // Origin charges conversion (both USD and EUR)
  const originChargeUsdZar = calculateOriginChargeZAR(originChargeUsd, roeOrigin);
  const originChargeEurZar = calculateEurChargeZAR(originChargeEur, roeEur);
  const totalOriginChargesZar = originChargeUsdZar + originChargeEurZar;

  // Local charges subtotal (transport/cartage)
  const localChargesSubtotalZar = calculateLocalChargesSubtotal(data);

  // Destination charges subtotal (port/shipping)
  const destinationChargesSubtotalZar = calculateDestinationSubtotal(data);

  // Agency fee: 3.5% of customs value, min R1187
  const agencyFeeZar = calculateAgencyFee(customsValueZar);

  // Customs subtotal (duties + VAT + declaration + agency)
  const customsDutyNotApplicable = data.customs_duty_not_applicable || false;
  const customsSubtotalZar = calculateCustomsSubtotal(data, agencyFeeZar, customsDutyNotApplicable);

  // Total shipping cost (origin + local + destination charges)
  const totalShippingCostZar = totalOriginChargesZar + localChargesSubtotalZar + destinationChargesSubtotalZar;

  // Total in warehouse cost (shipping + customs)
  const totalInWarehouseCostZar = totalShippingCostZar + customsSubtotalZar;

  // Cost per KG
  const allInWarehouseCostPerKgZar = totalGrossWeightKg > 0
    ? totalInWarehouseCostZar / totalGrossWeightKg
    : 0;

  return {
    customs_value_zar: Math.round(customsValueZar * 100) / 100,
    origin_charge_usd_zar: Math.round(originChargeUsdZar * 100) / 100,
    origin_charge_eur_zar: Math.round(originChargeEurZar * 100) / 100,
    origin_charge_zar: Math.round((originChargeUsdZar + originChargeEurZar) * 100) / 100,
    total_origin_charges_zar: Math.round(totalOriginChargesZar * 100) / 100,
    local_charges_subtotal_zar: Math.round(localChargesSubtotalZar * 100) / 100,
    destination_charges_subtotal_zar: Math.round(destinationChargesSubtotalZar * 100) / 100,
    agency_fee_zar: Math.round(agencyFeeZar * 100) / 100,
    customs_subtotal_zar: Math.round(customsSubtotalZar * 100) / 100,
    total_shipping_cost_zar: Math.round(totalShippingCostZar * 100) / 100,
    total_in_warehouse_cost_zar: Math.round(totalInWarehouseCostZar * 100) / 100,
    all_in_warehouse_cost_per_kg_zar: Math.round(allInWarehouseCostPerKgZar * 100) / 100,
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
 * Port options (South Africa)
 */
export const SA_PORTS = [
  { value: 'CPT', label: 'Cape Town (CPT)' },
  { value: 'DBN', label: 'Durban (DBN)' },
  { value: 'PLZ', label: 'Port Elizabeth (PLZ)' },
  { value: 'ELS', label: 'East London (ELS)' },
  { value: 'RCB', label: 'Richards Bay (RCB)' },
  { value: 'JNB', label: 'Johannesburg (JNB) - Inland' },
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
};
