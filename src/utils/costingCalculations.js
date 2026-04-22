/**
 * Costing Calculations Utility
 * Frontend calculations for import cost estimates
 */

/**
 * Default constants for costing calculations.
 * Exported so they can be referenced or overridden elsewhere.
 */
export const COSTING_DEFAULTS = {
  DAVIF_PERCENT: 0.0325,       // 3.25% of customs value
  DAVIF_MINIMUM_ZAR: 125,      // Minimum DAVIF charge in ZAR
  AGENCY_FEE_PERCENT: 3.5,     // Agency fee as % of (duties + import VAT)
  AGENCY_FEE_MINIMUM_ZAR: 1187,// Minimum agency fee in ZAR
  VAT_RATE: 0.15,              // South African import VAT (15%)
};

/**
 * Calculate DAVIF: 3.25% of customs value, minimum R125
 */
export const calculateDAVIF = (customsValue) => {
  if (!customsValue || customsValue <= 0) return 0;
  const percentage = customsValue * COSTING_DEFAULTS.DAVIF_PERCENT;
  return Math.max(percentage, COSTING_DEFAULTS.DAVIF_MINIMUM_ZAR);
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
    (parseFloat(data.jnb_turn_in_zar) || 0) +
    (parseFloat(data.bill_of_lading_fee_zar) || 0) +
    (parseFloat(data.manifest_filing_zar) || 0) +
    (parseFloat(data.currency_adjustment_factor_zar) || 0) +
    (parseFloat(data.degrouping_zar) || 0) +
    (parseFloat(data.edi_fee_zar) || 0) +
    (parseFloat(data.communication_dest_zar) || 0) +
    (parseFloat(data.documentation_fee_dest_zar) || 0) +
    (parseFloat(data.cfs_lcl_handling_out_zar) || 0) +
    (parseFloat(data.delivery_release_order_zar) || 0) +
    (parseFloat(data.cartage_dest_zar) || 0) +
    (parseFloat(data.fuel_surcharge_dest_zar) || 0) +
    (parseFloat(data.agency_fee_dest_zar) || 0) +
    (parseFloat(data.facility_fee_zar) || 0)
  );
};

/**
 * Calculate agency fee: 3.5% of (duties + import VAT), minimum R1187
 */
export const calculateAgencyFee = (dutiesAndVat, percentage = COSTING_DEFAULTS.AGENCY_FEE_PERCENT, min = COSTING_DEFAULTS.AGENCY_FEE_MINIMUM_ZAR) => {
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
    const vat = (customsValue + duties + schedule1Duty) * COSTING_DEFAULTS.VAT_RATE;

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
 * Calculate airfreight charges subtotal
 */
export const calculateAirfreightChargesSubtotal = (data) => {
  return (
    (parseFloat(data.screening_fee_zar) || 0) +
    (parseFloat(data.awb_fee_zar) || 0) +
    (parseFloat(data.airline_handling_fee_zar) || 0) +
    (parseFloat(data.airport_transfer_fee_zar) || 0) +
    (parseFloat(data.cartage_airport_to_whs_zar) || 0)
  );
};

/**
 * Calculate volumetric weight from dimensions
 */
export const calculateVolumetricWeight = (data) => {
  const l = parseFloat(data.dimensions_length_cm) || 0;
  const w = parseFloat(data.dimensions_width_cm) || 0;
  const h = parseFloat(data.dimensions_height_cm) || 0;
  const pieces = parseInt(data.number_of_pieces) || 1;
  const divisor = parseInt(data.volumetric_divisor) || 6000;
  if (l <= 0 || w <= 0 || h <= 0) return 0;
  return (l * w * h * pieces) / divisor;
};

/**
 * Calculate chargeable weight (higher of actual vs volumetric)
 */
export const calculateChargeableWeight = (data) => {
  const actual = parseFloat(data.actual_weight_kg) || 0;
  const volumetric = calculateVolumetricWeight(data);
  return Math.max(actual, volumetric);
};

/**
 * Calculate all totals from form data
 */
export const calculateAllTotals = (data) => {
  const roeOrigin = parseFloat(data.roe_origin) || 0;  // USD/ZAR
  const roeEur = parseFloat(data.roe_eur) || 0;        // EUR/ZAR
  const oceanFreightUsd = parseFloat(data.ocean_freight_usd) || 0;
  const oceanFreightEur = parseFloat(data.ocean_freight_eur) || 0;

  const originChargeUsd = parseFloat(data.origin_charge_usd) || 0;
  const originChargeEur = parseFloat(data.origin_charge_eur) || 0;

  // Under FOB / FCA / EXW, "Origin Charges" represents the FOB value of goods at origin
  // (the customs basis) — NOT a shipping fee. The same value is already captured as
  // Customs Value per product, so it must be excluded from shipping cost totals to
  // avoid double-counting in Total Landed / Cost per kg.
  const incoTermsUpper = (data.inco_terms || '').toUpperCase();
  const originChargesAreFobValue = ['FOB', 'FCA', 'EXW'].includes(incoTermsUpper);

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
  const agencyFeePercent = parseFloat(data.agency_fee_percentage) || COSTING_DEFAULTS.AGENCY_FEE_PERCENT;
  const agencyFeeMin = parseFloat(data.agency_fee_min) || COSTING_DEFAULTS.AGENCY_FEE_MINIMUM_ZAR;
  const agencyFeeZar = calculateAgencyFee(totalDutiesAndVat, agencyFeePercent, agencyFeeMin);

  // Customs subtotal from items + declaration + agency (EXCLUDING Import VAT - not charged to clients)
  const customsSubtotalZar = customsItemsTotals.totalCustomsValue > 0
    ? (customsItemsTotals.totalDuties + customsItemsTotals.totalSchedule1Duty +
       (parseFloat(data.customs_declaration_zar) || 0) + agencyFeeZar)
    : calculateCustomsSubtotal(data, agencyFeeZar);

  const isAirfreight = (data.transport_mode || 'sea') === 'air';

  // === Airfreight-specific calculations ===
  const volumetricWeightKg = calculateVolumetricWeight(data);
  const chargeableWeightKg = calculateChargeableWeight(data);

  // Airfreight total (direct USD + EUR amounts)
  const airfreightUsd = parseFloat(data.airfreight_usd) || 0;
  const airfreightEur = parseFloat(data.airfreight_eur) || 0;
  const airfreightTotalUsd = airfreightUsd;
  const airfreightTotalEur = airfreightEur;
  const airfreightTotalZar = (airfreightUsd * roeOrigin) + (airfreightEur * roeEur);

  // Airfreight surcharges (direct USD + EUR amounts)
  const fuelSurchargeUsd = parseFloat(data.fuel_surcharge_usd) || 0;
  const fuelSurchargeEur = parseFloat(data.fuel_surcharge_eur) || 0;
  const fuelSurchargeTotalZar = (fuelSurchargeUsd * roeOrigin) + (fuelSurchargeEur * roeEur);
  const securitySurchargeUsd = parseFloat(data.security_surcharge_usd) || 0;
  const securitySurchargeEur = parseFloat(data.security_surcharge_eur) || 0;
  const securitySurchargeTotalZar = (securitySurchargeUsd * roeOrigin) + (securitySurchargeEur * roeEur);

  // Airfreight origin charges (USD + EUR)
  const airfreightOriginUsd = parseFloat(data.airfreight_origin_charges_usd) || 0;
  const airfreightOriginEur = parseFloat(data.airfreight_origin_charges_eur) || 0;
  const airfreightOriginZar = (airfreightOriginUsd * roeOrigin) + (airfreightOriginEur * roeEur);

  // Airfreight local charges (all ZAR)
  const airLocalChargesSubtotalZar = calculateAirfreightChargesSubtotal(data);

  // Insurance (% of customs value)
  const insurancePercent = parseFloat(data.airfreight_insurance_percent) || 0;
  const airfreightInsuranceZar = customsValueZar * (insurancePercent / 100);

  // Total airfreight cost
  const totalAirfreightCostZar = airfreightTotalZar + fuelSurchargeTotalZar + securitySurchargeTotalZar
    + airfreightOriginZar + airLocalChargesSubtotalZar + airfreightInsuranceZar;

  // === Unified shipping cost (sea or air) ===
  // Sea freight total. Origin Charges is omitted under FOB/FCA/EXW (it's goods value,
  // not a shipping fee); included under other terms where it represents real origin
  // port handling fees.
  const totalShippingCostSeaZar = totalOceanFreightZar
    + (originChargesAreFobValue ? 0 : totalOriginChargesZar)
    + localChargesSubtotalZar
    + destinationChargesSubtotalZar;

  // Use the right total based on transport mode
  const totalShippingCostZar = isAirfreight ? totalAirfreightCostZar : totalShippingCostSeaZar;

  // For CIF/CIP/CFR, ocean freight and origin charges are in the product price —
  // only local + destination charges are additional shipping costs
  const incoTerms = (data.inco_terms || '').toUpperCase();
  const freightIncluded = ['CIF', 'CIP', 'CFR'].includes(incoTerms);
  let shippingToAllocateZar;
  if (isAirfreight) {
    // For airfreight: if freight included in price, only allocate local charges + insurance
    shippingToAllocateZar = freightIncluded
      ? airLocalChargesSubtotalZar + airfreightInsuranceZar
      : totalAirfreightCostZar;
  } else {
    shippingToAllocateZar = freightIncluded
      ? localChargesSubtotalZar + destinationChargesSubtotalZar
      : totalShippingCostSeaZar;
  }

  // Total in warehouse cost (shipping + customs overhead) - VAT excluded
  const totalInWarehouseCostZar = shippingToAllocateZar + customsSubtotalZar;

  // Total landed cost (product value + duties + allocated shipping) - true all-in cost
  const totalLandedCostZar = customsItemsTotals.totalCustomsValue + customsItemsTotals.totalDuties + customsItemsTotals.totalSchedule1Duty + shippingToAllocateZar;

  // Cost per KG (based on total landed cost including product value)
  const allInWarehouseCostPerKgZar = totalGrossWeightKg > 0
    ? totalLandedCostZar / totalGrossWeightKg
    : 0;

  // Overhead cost per KG (shipping + customs overhead only, excluding product value)
  const overheadCostPerKgZar = totalGrossWeightKg > 0
    ? totalInWarehouseCostZar / totalGrossWeightKg
    : 0;

  const r = (v) => Math.round(v * 100) / 100;

  return {
    // Database columns (will be saved)
    customs_value_zar: r(customsValueZar),
    ocean_freight_zar: r(totalOceanFreightZar),
    total_ocean_freight_zar: r(totalOceanFreightZar),
    origin_charge_zar: r(originChargeUsdZar + originChargeEurZar),
    total_origin_charges_zar: r(totalOriginChargesZar),
    local_charges_subtotal_zar: r(localChargesSubtotalZar),
    destination_charges_subtotal_zar: r(destinationChargesSubtotalZar),
    import_vat_zar: r(importVatZar),
    total_duties_zar: r(customsItemsTotals.totalDuties + customsItemsTotals.totalSchedule1Duty),
    agency_fee_zar: r(agencyFeeZar),
    customs_subtotal_zar: r(customsSubtotalZar),
    total_shipping_cost_zar: r(totalShippingCostZar),
    total_in_warehouse_cost_zar: r(totalInWarehouseCostZar),
    total_landed_cost_zar: r(totalLandedCostZar),
    all_in_warehouse_cost_per_kg_zar: r(allInWarehouseCostPerKgZar),
    overhead_cost_per_kg_zar: r(overheadCostPerKgZar),
    // Airfreight calculated fields
    volumetric_weight_kg: r(volumetricWeightKg),
    chargeable_weight_kg: r(chargeableWeightKg),
    airfreight_total_usd: r(airfreightTotalUsd),
    _airfreight_total_eur: r(airfreightTotalEur),
    _airfreight_usd_zar: r(airfreightTotalUsd * roeOrigin),
    _airfreight_eur_zar: r(airfreightTotalEur * roeEur),
    airfreight_total_zar: r(airfreightTotalZar),
    fuel_surcharge_total_zar: r(fuelSurchargeTotalZar),
    security_surcharge_total_zar: r(securitySurchargeTotalZar),
    airfreight_origin_charges_zar: r(airfreightOriginZar),
    air_local_charges_subtotal_zar: r(airLocalChargesSubtotalZar),
    airfreight_insurance_zar: r(airfreightInsuranceZar),
    total_airfreight_cost_zar: r(totalAirfreightCostZar),
    // Display-only fields (not saved to database, used for form display)
    _ocean_freight_usd_zar: r(oceanFreightUsdZar),
    _ocean_freight_eur_zar: r(oceanFreightEurZar),
    _origin_charge_usd_zar: r(originChargeUsdZar),
    _origin_charge_eur_zar: r(originChargeEurZar),
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
 * Ports of Loading options
 */
export const PORTS_OF_LOADING = [
  { value: 'Port Kelang', label: 'Port Kelang - Malaysia' },
  { value: 'Qingdao', label: 'Qingdao - China' },
  { value: 'Shanghai', label: 'Shanghai - China' },
  { value: 'Tianjin / Xingang', label: 'Tianjin / Xingang - China' },
  { value: 'Dalian', label: 'Dalian - China' },
  { value: 'Jakarta', label: 'Jakarta - Indonesia' },
  { value: 'Gebze', label: 'Gebze - Turkey' },
  { value: 'Istanbul', label: 'Istanbul - Turkey' },
];

/**
 * Shipping line options
 */
export const SHIPPING_LINES = [
  { value: 'CMA-CGM', label: 'CMA-CGM' },
  { value: 'EVERGREEN', label: 'EVERGREEN' },
  { value: 'MSC', label: 'MSC' },
  { value: 'MSC Special', label: 'MSC Special' },
  { value: 'MSC Standard', label: 'MSC Standard' },
  { value: 'ONE', label: 'ONE' },
];

/**
 * Container type mapping for rate lookup
 */
const CONTAINER_RATE_KEY = {
  "20' Dry Container": '20GP',
  "40' Dry Container": '40GP',
  "40' High Cube": '40HC',
};

/**
 * Ocean freight rates (USD) by Port of Loading → Shipping Line → Container Size
 * Source: Synercore January 2026 Rates
 */
export const OCEAN_FREIGHT_RATES = {
  'Port Kelang': {
    'MSC Special':  { '20GP': 2150, '40GP': 2550, '40HC': 2550 },
    'ONE':          { '20GP': 2350, '40GP': 2550, '40HC': 2550 },
    'MSC Standard': { '20GP': 3100, '40GP': 4250, '40HC': 4250 },
  },
  'Qingdao': {
    'ONE':          { '20GP': 2350, '40GP': 2550, '40HC': 2550 },
    'CMA-CGM':      { '20GP': 2400, '40GP': 2750, '40HC': 2750 },
    'EVERGREEN':    { '20GP': 2009, '40GP': 2568, '40HC': 2568 },
    'MSC Special':  { '20GP': 2300, '40GP': 2650, '40HC': 2650 },
    'MSC Standard': { '20GP': 3050, '40GP': 4150, '40HC': 4150 },
  },
  'Tianjin / Xingang': {
    'CMA-CGM':      { '20GP': 2625, '40GP': 3200, '40HC': 3200 },
    'MSC Special':  { '20GP': 2300, '40GP': 2650, '40HC': 2650 },
    'ONE':          { '20GP': 2450, '40GP': 2750, '40HC': 2750 },
    'MSC Standard': { '20GP': 3100, '40GP': 4250, '40HC': 4250 },
  },
  'Dalian': {
    'MSC Special':  { '20GP': 2300, '40GP': 2650, '40HC': 2650 },
    'MSC Standard': { '20GP': 3100, '40GP': 4250, '40HC': 4250 },
    'ONE':          { '20GP': 2450, '40GP': 2750, '40HC': 2750 },
    'EVERGREEN':    { '20GP': 2100, '40GP': 2900, '40HC': 2900 },
  },
  'Jakarta': {
    'ONE':          { '20GP': 2350, '40GP': 2550, '40HC': 2550 },
    'MSC Standard': { '20GP': 3100, '40GP': 4250, '40HC': 4250 },
    'CMA-CGM':      { '20GP': 2500, '40GP': 3250, '40HC': 3250 },
    'MSC Special':  { '20GP': 2150, '40GP': 2550, '40HC': 2550 },
  },
  'Shanghai': {
    'ONE':          { '20GP': 2350, '40GP': 2550, '40HC': 2550 },
    'CMA-CGM':      { '20GP': 2400, '40GP': 2750, '40HC': 2750 },
    'EVERGREEN':    { '20GP': 2009, '40GP': 2550, '40HC': 2450 },
    'MSC Special':  { '20GP': 2200, '40GP': 2450, '40HC': 2450 },
    'MSC Standard': { '20GP': 3050, '40GP': 4150, '40HC': 4150 },
  },
  'Gebze': {
    'MSC':          { '20GP': 1050, '40GP': 0, '40HC': 1000 },
  },
  'Istanbul': {
    'MSC':          { '20GP': 1050, '40GP': 0, '40HC': 1000 },
  },
};

/**
 * Look up ocean freight rate based on port, shipping line, and container type.
 * Returns the rate in USD, or null if no matching rate found.
 */
export function lookupOceanFreightRate(portOfLoading, shippingLine, containerType) {
  const sizeKey = CONTAINER_RATE_KEY[containerType];
  if (!sizeKey) return null;
  const rate = OCEAN_FREIGHT_RATES[portOfLoading]?.[shippingLine]?.[sizeKey];
  return rate !== undefined ? rate : null;
}

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

/**
 * Airport options (common origins for air freight into SA)
 */
export const AIRPORTS_OF_DEPARTURE = [
  { value: 'HKG', label: 'Hong Kong (HKG)' },
  { value: 'PVG', label: 'Shanghai Pudong (PVG)' },
  { value: 'CAN', label: 'Guangzhou (CAN)' },
  { value: 'SZX', label: 'Shenzhen (SZX)' },
  { value: 'PEK', label: 'Beijing (PEK)' },
  { value: 'NRT', label: 'Tokyo Narita (NRT)' },
  { value: 'ICN', label: 'Seoul Incheon (ICN)' },
  { value: 'SIN', label: 'Singapore (SIN)' },
  { value: 'BKK', label: 'Bangkok (BKK)' },
  { value: 'KUL', label: 'Kuala Lumpur (KUL)' },
  { value: 'CGK', label: 'Jakarta (CGK)' },
  { value: 'DEL', label: 'Delhi (DEL)' },
  { value: 'BOM', label: 'Mumbai (BOM)' },
  { value: 'DXB', label: 'Dubai (DXB)' },
  { value: 'IST', label: 'Istanbul (IST)' },
  { value: 'FRA', label: 'Frankfurt (FRA)' },
  { value: 'AMS', label: 'Amsterdam (AMS)' },
  { value: 'LHR', label: 'London Heathrow (LHR)' },
  { value: 'CDG', label: 'Paris CDG (CDG)' },
  { value: 'ADD', label: 'Addis Ababa (ADD)' },
  { value: 'NBO', label: 'Nairobi (NBO)' },
  { value: 'LOS', label: 'Lagos (LOS)' },
];

export const AIRPORTS_OF_ARRIVAL = [
  { value: 'JNB', label: 'OR Tambo, Johannesburg (JNB)' },
  { value: 'CPT', label: 'Cape Town International (CPT)' },
  { value: 'DUR', label: 'King Shaka, Durban (DUR)' },
  { value: 'PLZ', label: 'Port Elizabeth (PLZ)' },
  { value: 'BFN', label: 'Bloemfontein (BFN)' },
];

export const AIRLINES = [
  { value: 'Ethiopian Airlines', label: 'Ethiopian Airlines' },
  { value: 'Emirates SkyCargo', label: 'Emirates SkyCargo' },
  { value: 'Turkish Cargo', label: 'Turkish Cargo' },
  { value: 'Qatar Airways Cargo', label: 'Qatar Airways Cargo' },
  { value: 'SAA Cargo', label: 'SAA Cargo' },
  { value: 'Lufthansa Cargo', label: 'Lufthansa Cargo' },
  { value: 'KLM Cargo', label: 'KLM Cargo' },
  { value: 'Singapore Airlines Cargo', label: 'Singapore Airlines Cargo' },
  { value: 'Cathay Cargo', label: 'Cathay Cargo' },
  { value: 'British Airways Cargo', label: 'British Airways Cargo' },
  { value: 'Kenya Airways Cargo', label: 'Kenya Airways Cargo' },
  { value: 'Other', label: 'Other' },
];

export default {
  COSTING_DEFAULTS,
  calculateDAVIF,
  calculateOriginChargeZAR,
  calculateLocalChargesSubtotal,
  calculateDestinationSubtotal,
  calculateAirfreightChargesSubtotal,
  calculateVolumetricWeight,
  calculateChargeableWeight,
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
  PORTS_OF_LOADING,
  SHIPPING_LINES,
  OCEAN_FREIGHT_RATES,
  lookupOceanFreightRate,
  AIRPORTS_OF_DEPARTURE,
  AIRPORTS_OF_ARRIVAL,
  AIRLINES,
};
