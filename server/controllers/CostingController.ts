/**
 * Costing Controller
 * Business logic for import cost estimates
 */

import { costingRepository, ImportCostEstimate } from '../db/repositories/CostingRepository.js';
import ExchangeRateService from '../services/ExchangeRateService.js';
import { logInfo, logError } from '../utils/logger.js';

export interface CostingFilterParams {
  status?: string;
  supplierId?: string;
  shipmentId?: string;
  page?: number;
  limit?: number;
}

export interface CalculatedTotals {
  origin_charge_zar: number;
  total_origin_charges_zar: number;
  destination_charges_subtotal_zar: number;
  customs_disbursements_subtotal_zar: number;
  clearing_charges_subtotal_zar: number;
  total_shipping_cost_zar: number;
  total_in_warehouse_cost_zar: number;
  all_in_warehouse_cost_per_kg_zar: number;
  davif_zar: number;
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
   * Calculate DAVIF: 3.25% of customs value, minimum R125
   */
  static calculateDAVIF(customsValue: number): number {
    if (!customsValue || customsValue <= 0) return 0;
    const percentage = customsValue * 0.0325;
    return Math.max(percentage, 125);
  }

  /**
   * Calculate all totals based on input values
   */
  static calculateAllTotals(data: Partial<ImportCostEstimate>): CalculatedTotals {
    const roeOrigin = Number(data.roe_origin) || 0;
    const originChargeUsd = Number(data.origin_charge_usd) || 0;
    const customsValueZar = Number(data.customs_value_zar) || 0;
    const totalGrossWeightKg = Number(data.total_gross_weight_kg) || 0;

    // Origin charges conversion
    const originChargeZar = originChargeUsd * roeOrigin;
    const totalOriginChargesZar = originChargeZar;

    // Destination charges subtotal
    const destinationChargesSubtotalZar =
      (Number(data.thc_zar) || 0) +
      (Number(data.gate_door_zar) || 0) +
      (Number(data.insurance_zar) || 0) +
      (Number(data.shipping_line_fee_zar) || 0) +
      (Number(data.port_inland_release_fee_zar) || 0) +
      (Number(data.cto_zar) || 0) +
      (Number(data.transport_port_to_warehouse_zar) || 0) +
      (Number(data.delivery_only_trans_zar) || 0) +
      (Number(data.unpack_reload_zar) || 0);

    // Customs disbursements subtotal
    const customsDutyNotApplicable = data.customs_duty_not_applicable || false;
    const customsDisbursementsSubtotalZar = customsDutyNotApplicable
      ? 0
      : (Number(data.customs_duty_zar) || 0);

    // Calculate DAVIF
    const davifZar = this.calculateDAVIF(customsValueZar);

    // Clearing charges subtotal
    const clearingChargesSubtotalZar =
      (Number(data.documentation_fee_zar) || 0) +
      (Number(data.communication_fee_zar) || 0) +
      (Number(data.edif_fee_zar) || 0) +
      (Number(data.plant_inspection_zar) || 0) +
      (Number(data.portbuild_zar) || 0) +
      davifZar +
      (Number(data.agency_zar) || 0);

    // Total shipping cost (origin + destination charges)
    const totalShippingCostZar = totalOriginChargesZar + destinationChargesSubtotalZar;

    // Total in warehouse cost (shipping + customs + clearing)
    const totalInWarehouseCostZar =
      totalShippingCostZar +
      customsDisbursementsSubtotalZar +
      clearingChargesSubtotalZar;

    // Cost per KG
    const allInWarehouseCostPerKgZar = totalGrossWeightKg > 0
      ? totalInWarehouseCostZar / totalGrossWeightKg
      : 0;

    return {
      origin_charge_zar: Math.round(originChargeZar * 100) / 100,
      total_origin_charges_zar: Math.round(totalOriginChargesZar * 100) / 100,
      destination_charges_subtotal_zar: Math.round(destinationChargesSubtotalZar * 100) / 100,
      customs_disbursements_subtotal_zar: Math.round(customsDisbursementsSubtotalZar * 100) / 100,
      clearing_charges_subtotal_zar: Math.round(clearingChargesSubtotalZar * 100) / 100,
      total_shipping_cost_zar: Math.round(totalShippingCostZar * 100) / 100,
      total_in_warehouse_cost_zar: Math.round(totalInWarehouseCostZar * 100) / 100,
      all_in_warehouse_cost_per_kg_zar: Math.round(allInWarehouseCostPerKgZar * 100) / 100,
      davif_zar: Math.round(davifZar * 100) / 100,
    };
  }
}

export default CostingController;
