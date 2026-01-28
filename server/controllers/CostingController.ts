/**
 * Costing Controller
 * Business logic for import cost estimates
 */

import { costingRepository, ImportCostEstimate } from '../db/repositories/CostingRepository.js';
import ExchangeRateService from '../services/ExchangeRateService.js';

export interface CostingFilterParams {
  status?: string;
  supplierId?: string;
  shipmentId?: string;
  page?: number;
  limit?: number;
}

export interface CalculatedTotals {
  customs_value_zar: number;
  origin_charge_zar: number;
  total_origin_charges_zar: number;
  local_charges_subtotal_zar: number;
  destination_charges_subtotal_zar: number;
  agency_fee_zar: number;
  customs_subtotal_zar: number;
  total_shipping_cost_zar: number;
  total_in_warehouse_cost_zar: number;
  all_in_warehouse_cost_per_kg_zar: number;
}

export class CostingController {
  /**
   * Get all cost estimates with pagination
   */
  static async getCostEstimates(params: CostingFilterParams) {
    const { data, total } = await costingRepository.findAll({
      status: params.status,
      supplierId: params.supplierId,
      shipmentId: params.shipmentId,
      page: params.page,
      limit: params.limit,
    });

    return {
      data,
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        total,
        pages: Math.ceil(total / (params.limit || 20)),
      },
    };
  }

  /**
   * Get a single cost estimate
   */
  static async getCostEstimate(id: string): Promise<ImportCostEstimate | null> {
    return costingRepository.findById(id);
  }

  /**
   * Get cost estimates for a shipment
   */
  static async getByShipment(shipmentId: string): Promise<ImportCostEstimate[]> {
    return costingRepository.findByShipmentId(shipmentId);
  }

  /**
   * Create a new cost estimate with auto-calculations
   */
  static async createCostEstimate(data: Partial<ImportCostEstimate>): Promise<ImportCostEstimate> {
    // Calculate all derived values
    const calculatedData = this.calculateAllTotals(data);
    const mergedData = { ...data, ...calculatedData };

    return costingRepository.create(mergedData);
  }

  /**
   * Update a cost estimate with auto-calculations
   */
  static async updateCostEstimate(id: string, data: Partial<ImportCostEstimate>): Promise<ImportCostEstimate> {
    // Get existing data
    const existing = await costingRepository.findById(id);
    if (!existing) {
      throw new Error('Cost estimate not found');
    }

    // Merge and recalculate
    const merged = { ...existing, ...data };
    const calculatedData = this.calculateAllTotals(merged);
    const finalData = { ...data, ...calculatedData };

    return costingRepository.update(id, finalData);
  }

  /**
   * Delete a cost estimate
   */
  static async deleteCostEstimate(id: string): Promise<boolean> {
    return costingRepository.delete(id);
  }

  /**
   * Duplicate a cost estimate
   */
  static async duplicateCostEstimate(id: string): Promise<ImportCostEstimate> {
    return costingRepository.duplicate(id);
  }

  /**
   * Link cost estimate to a shipment
   */
  static async linkToShipment(id: string, shipmentId: string): Promise<ImportCostEstimate> {
    return costingRepository.linkToShipment(id, shipmentId);
  }

  /**
   * Unlink cost estimate from shipment
   */
  static async unlinkFromShipment(id: string): Promise<ImportCostEstimate> {
    return costingRepository.unlinkFromShipment(id);
  }

  /**
   * Get current exchange rate
   */
  static async getExchangeRate() {
    return ExchangeRateService.getCurrentRate();
  }

  /**
   * Set manual exchange rate
   */
  static async setManualExchangeRate(rate: number) {
    return ExchangeRateService.setManualRate(rate);
  }

  /**
   * Refresh exchange rate from API
   */
  static async refreshExchangeRate() {
    return ExchangeRateService.refreshRate();
  }

  /**
   * Calculate Agency Fee: 3.5% of customs value, minimum R1187
   */
  static calculateAgencyFee(customsValue: number): number {
    if (!customsValue || customsValue <= 0) return 0;
    const percentage = customsValue * 0.035;
    return Math.max(percentage, 1187);
  }

  /**
   * Calculate Customs Value from invoice values
   */
  static calculateCustomsValue(data: Partial<ImportCostEstimate>): number {
    const roeOrigin = Number(data.roe_origin) || 0;
    const roeEur = Number(data.roe_eur) || 0;
    const invoiceValueUsd = Number(data.invoice_value_usd) || 0;
    const invoiceValueEur = Number(data.invoice_value_eur) || 0;
    return (invoiceValueUsd * roeOrigin) + (invoiceValueEur * roeEur);
  }

  /**
   * Calculate all totals based on input values
   */
  static calculateAllTotals(data: Partial<ImportCostEstimate>): CalculatedTotals {
    const roeOrigin = Number(data.roe_origin) || 0;
    const roeEur = Number(data.roe_eur) || 0;
    const originChargeUsd = Number(data.origin_charge_usd) || 0;
    const originChargeEur = Number(data.origin_charge_eur) || 0;
    const totalGrossWeightKg = Number(data.total_gross_weight_kg) || 0;

    // Calculate customs value from invoice values
    const customsValueZar = this.calculateCustomsValue(data);

    // Origin charges conversion (USD and EUR)
    const originChargeUsdZar = originChargeUsd * roeOrigin;
    const originChargeEurZar = originChargeEur * roeEur;
    const originChargeZar = originChargeUsdZar + originChargeEurZar;
    const totalOriginChargesZar = originChargeZar;

    // Local charges subtotal (Transport/Cartage)
    const localChargesSubtotalZar =
      (Number(data.local_cartage_cpt_klapmuts_zar) || 0) +
      (Number(data.transport_dbn_to_pretoria_zar) || 0) +
      (Number(data.transport_to_warehouse_zar) || 0) +
      (Number(data.unpack_reload_zar) || 0) +
      (Number(data.storage_zar) || 0) +
      (Number(data.outlying_depot_surcharge_zar) || 0);

    // Destination charges subtotal (Port/Shipping)
    const destinationChargesSubtotalZar =
      (Number(data.shipping_line_charges_zar) || 0) +
      (Number(data.cargo_dues_zar) || 0) +
      (Number(data.cto_fee_zar) || 0) +
      (Number(data.port_health_inspection_zar) || 0) +
      (Number(data.sars_inspection_zar) || 0) +
      (Number(data.state_vet_fee_zar) || 0) +
      (Number(data.inb_turn_in_zar) || 0);

    // Agency fee: 3.5% of customs value, min R1187
    const agencyFeeZar = this.calculateAgencyFee(customsValueZar);

    // Customs subtotal (duties + VAT + declaration + agency)
    const customsDutyNotApplicable = data.customs_duty_not_applicable || false;
    const dutiesZar = customsDutyNotApplicable ? 0 : (Number(data.duties_zar) || 0);
    const customsSubtotalZar =
      dutiesZar +
      (Number(data.customs_vat_zar) || 0) +
      (Number(data.customs_declaration_zar) || 0) +
      agencyFeeZar;

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
      origin_charge_zar: Math.round(originChargeZar * 100) / 100,
      total_origin_charges_zar: Math.round(totalOriginChargesZar * 100) / 100,
      local_charges_subtotal_zar: Math.round(localChargesSubtotalZar * 100) / 100,
      destination_charges_subtotal_zar: Math.round(destinationChargesSubtotalZar * 100) / 100,
      agency_fee_zar: Math.round(agencyFeeZar * 100) / 100,
      customs_subtotal_zar: Math.round(customsSubtotalZar * 100) / 100,
      total_shipping_cost_zar: Math.round(totalShippingCostZar * 100) / 100,
      total_in_warehouse_cost_zar: Math.round(totalInWarehouseCostZar * 100) / 100,
      all_in_warehouse_cost_per_kg_zar: Math.round(allInWarehouseCostPerKgZar * 100) / 100,
    };
  }
}

export default CostingController;
