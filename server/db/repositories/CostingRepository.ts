/**
 * Repository for Import Cost Estimates
 * Handles CRUD operations for cost estimates and exchange rates
 */

import { query, queryOne, queryAll } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface ImportCostEstimate {
  id: string;
  shipment_id?: string;
  supplier_id?: string;
  reference_number?: string;
  country_of_destination: string;
  port_of_discharge?: string;
  shipping_line?: string;
  routing?: string;
  frequency?: string;
  transit_time_days?: number;
  inco_terms?: string;
  inco_term_place?: string;
  container_type?: string;
  quantity: number;
  hs_code?: string;
  gross_weight_kg?: number;
  total_gross_weight_kg?: number;
  origin_rate_usd?: number;
  ocean_freight_rate_usd?: number;
  commodity?: string;
  customs_value_zar?: number;
  supplier_name?: string;
  validity_date?: string;
  costing_date: string;
  payment_terms?: string;
  roe_origin?: number;   // USD/ZAR
  roe_eur?: number;      // EUR/ZAR
  // Origin Charges
  origin_charge_usd: number;
  origin_charge_eur: number;
  origin_charge_zar: number;
  total_origin_charges_zar: number;
  // Destination Charges
  thc_zar: number;
  gate_door_zar: number;
  insurance_zar: number;
  shipping_line_fee_zar: number;
  port_inland_release_fee_zar: number;
  cto_zar: number;
  transport_port_to_warehouse_zar: number;
  delivery_only_trans_zar: number;
  unpack_reload_zar: number;
  destination_charges_subtotal_zar: number;
  // Customs
  customs_duty_zar: number;
  customs_duty_not_applicable: boolean;
  customs_disbursements_subtotal_zar: number;
  // Clearing Charges
  documentation_fee_zar: number;
  communication_fee_zar: number;
  edif_fee_zar: number;
  plant_inspection_zar: number;
  portbuild_zar: number;
  davif_zar: number;
  agency_zar: number;
  clearing_charges_subtotal_zar: number;
  // Totals
  total_shipping_cost_zar: number;
  total_in_warehouse_cost_zar: number;
  all_in_warehouse_cost_per_kg_zar: number;
  // Metadata
  status: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: number;
  currency_pair: string;
  rate: number;
  source?: string;
  fetched_at: string;
}

const COST_ESTIMATE_COLUMNS = [
  'id', 'shipment_id', 'supplier_id', 'reference_number', 'country_of_destination',
  'port_of_discharge', 'shipping_line', 'routing', 'frequency', 'transit_time_days',
  'inco_terms', 'inco_term_place', 'container_type', 'quantity', 'hs_code',
  'gross_weight_kg', 'total_gross_weight_kg', 'origin_rate_usd', 'ocean_freight_rate_usd',
  'commodity', 'customs_value_zar', 'supplier_name', 'validity_date', 'costing_date',
  'payment_terms', 'roe_origin', 'roe_eur', 'origin_charge_usd', 'origin_charge_eur', 'origin_charge_zar',
  'total_origin_charges_zar', 'thc_zar', 'gate_door_zar', 'insurance_zar',
  'shipping_line_fee_zar', 'port_inland_release_fee_zar', 'cto_zar',
  'transport_port_to_warehouse_zar', 'delivery_only_trans_zar', 'unpack_reload_zar',
  'destination_charges_subtotal_zar', 'customs_duty_zar', 'customs_duty_not_applicable',
  'customs_disbursements_subtotal_zar', 'documentation_fee_zar', 'communication_fee_zar',
  'edif_fee_zar', 'plant_inspection_zar', 'portbuild_zar', 'davif_zar', 'agency_zar',
  'clearing_charges_subtotal_zar', 'total_shipping_cost_zar', 'total_in_warehouse_cost_zar',
  'all_in_warehouse_cost_per_kg_zar', 'status', 'notes', 'created_by', 'created_at', 'updated_at'
];

export class CostingRepository {
  /**
   * Find all cost estimates with optional filtering and pagination
   */
  async findAll(options?: {
    status?: string;
    supplierId?: string;
    shipmentId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ImportCostEstimate[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options?.supplierId) {
      conditions.push(`supplier_id = $${paramIndex++}`);
      params.push(options.supplierId);
    }

    if (options?.shipmentId) {
      conditions.push(`shipment_id = $${paramIndex++}`);
      params.push(options.shipmentId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(*) as count FROM import_cost_estimates ${whereClause}`;
    const countResult = await queryOne<{ count: string }>(countSql, params);
    const total = countResult ? parseInt(countResult.count, 10) : 0;

    // Get paginated data
    const limit = options?.limit || 20;
    const offset = ((options?.page || 1) - 1) * limit;

    const dataSql = `
      SELECT ${COST_ESTIMATE_COLUMNS.join(', ')}
      FROM import_cost_estimates
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = await queryAll<ImportCostEstimate>(dataSql, params.length > 0 ? params : undefined);

    return { data, total };
  }

  /**
   * Find cost estimate by ID
   */
  async findById(id: string): Promise<ImportCostEstimate | null> {
    const sql = `SELECT ${COST_ESTIMATE_COLUMNS.join(', ')} FROM import_cost_estimates WHERE id = $1`;
    return queryOne<ImportCostEstimate>(sql, [id]);
  }

  /**
   * Find cost estimates by shipment ID
   */
  async findByShipmentId(shipmentId: string): Promise<ImportCostEstimate[]> {
    const sql = `
      SELECT ${COST_ESTIMATE_COLUMNS.join(', ')}
      FROM import_cost_estimates
      WHERE shipment_id = $1
      ORDER BY created_at DESC
    `;
    return queryAll<ImportCostEstimate>(sql, [shipmentId]);
  }

  /**
   * Create a new cost estimate
   */
  async create(data: Partial<ImportCostEstimate>): Promise<ImportCostEstimate> {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    const insertData = {
      ...data,
      id,
      country_of_destination: data.country_of_destination || 'South Africa',
      quantity: data.quantity || 1,
      costing_date: data.costing_date || now.split('T')[0],
      status: data.status || 'draft',
      created_at: now,
      updated_at: now,
      // Default numeric values to 0
      origin_charge_usd: data.origin_charge_usd || 0,
      origin_charge_eur: data.origin_charge_eur || 0,
      origin_charge_zar: data.origin_charge_zar || 0,
      total_origin_charges_zar: data.total_origin_charges_zar || 0,
      thc_zar: data.thc_zar || 0,
      gate_door_zar: data.gate_door_zar || 0,
      insurance_zar: data.insurance_zar || 0,
      shipping_line_fee_zar: data.shipping_line_fee_zar || 0,
      port_inland_release_fee_zar: data.port_inland_release_fee_zar || 0,
      cto_zar: data.cto_zar || 0,
      transport_port_to_warehouse_zar: data.transport_port_to_warehouse_zar || 0,
      delivery_only_trans_zar: data.delivery_only_trans_zar || 0,
      unpack_reload_zar: data.unpack_reload_zar || 0,
      destination_charges_subtotal_zar: data.destination_charges_subtotal_zar || 0,
      customs_duty_zar: data.customs_duty_zar || 0,
      customs_duty_not_applicable: data.customs_duty_not_applicable || false,
      customs_disbursements_subtotal_zar: data.customs_disbursements_subtotal_zar || 0,
      documentation_fee_zar: data.documentation_fee_zar || 0,
      communication_fee_zar: data.communication_fee_zar || 0,
      edif_fee_zar: data.edif_fee_zar || 0,
      plant_inspection_zar: data.plant_inspection_zar || 0,
      portbuild_zar: data.portbuild_zar || 0,
      davif_zar: data.davif_zar || 0,
      agency_zar: data.agency_zar || 0,
      clearing_charges_subtotal_zar: data.clearing_charges_subtotal_zar || 0,
      total_shipping_cost_zar: data.total_shipping_cost_zar || 0,
      total_in_warehouse_cost_zar: data.total_in_warehouse_cost_zar || 0,
      all_in_warehouse_cost_per_kg_zar: data.all_in_warehouse_cost_per_kg_zar || 0,
    };

    const keys = Object.keys(insertData);
    const values = Object.values(insertData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO import_cost_estimates (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING ${COST_ESTIMATE_COLUMNS.join(', ')}
    `;

    const result = await queryOne<ImportCostEstimate>(sql, values);
    if (!result) {
      throw new Error('Failed to create cost estimate');
    }
    return result;
  }

  /**
   * Update a cost estimate
   */
  async update(id: string, data: Partial<ImportCostEstimate>): Promise<ImportCostEstimate> {
    const updateData = { ...data, updated_at: new Date().toISOString() };
    delete updateData.id;
    delete updateData.created_at;

    const keys = Object.keys(updateData);
    const values = [...Object.values(updateData), id];
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const sql = `
      UPDATE import_cost_estimates
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING ${COST_ESTIMATE_COLUMNS.join(', ')}
    `;

    const result = await queryOne<ImportCostEstimate>(sql, values);
    if (!result) {
      throw new Error('Cost estimate not found');
    }
    return result;
  }

  /**
   * Delete a cost estimate
   */
  async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM import_cost_estimates WHERE id = $1';
    await query(sql, [id]);
    return true;
  }

  /**
   * Link cost estimate to shipment
   */
  async linkToShipment(id: string, shipmentId: string): Promise<ImportCostEstimate> {
    return this.update(id, { shipment_id: shipmentId });
  }

  /**
   * Unlink cost estimate from shipment
   */
  async unlinkFromShipment(id: string): Promise<ImportCostEstimate> {
    const sql = `
      UPDATE import_cost_estimates
      SET shipment_id = NULL, updated_at = $2
      WHERE id = $1
      RETURNING ${COST_ESTIMATE_COLUMNS.join(', ')}
    `;
    const result = await queryOne<ImportCostEstimate>(sql, [id, new Date().toISOString()]);
    if (!result) {
      throw new Error('Cost estimate not found');
    }
    return result;
  }

  /**
   * Duplicate a cost estimate
   */
  async duplicate(id: string): Promise<ImportCostEstimate> {
    const original = await this.findById(id);
    if (!original) {
      throw new Error('Cost estimate not found');
    }

    const { id: _, created_at, updated_at, reference_number, ...copyData } = original;

    return this.create({
      ...copyData,
      reference_number: reference_number ? `${reference_number}-COPY` : undefined,
      status: 'draft',
    });
  }

  // Exchange Rate Methods

  /**
   * Get cached exchange rate
   */
  async getCachedRate(currencyPair: string): Promise<ExchangeRate | null> {
    const sql = 'SELECT * FROM exchange_rate_cache WHERE currency_pair = $1';
    return queryOne<ExchangeRate>(sql, [currencyPair]);
  }

  /**
   * Save exchange rate to cache
   */
  async cacheRate(currencyPair: string, rate: number, source?: string): Promise<ExchangeRate> {
    const sql = `
      INSERT INTO exchange_rate_cache (currency_pair, rate, source, fetched_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (currency_pair) DO UPDATE SET
        rate = EXCLUDED.rate,
        source = EXCLUDED.source,
        fetched_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await queryOne<ExchangeRate>(sql, [currencyPair, rate, source || 'api']);
    if (!result) {
      throw new Error('Failed to cache exchange rate');
    }
    return result;
  }

  /**
   * Check if cached rate is stale (older than 1 hour)
   */
  async isRateStale(currencyPair: string): Promise<boolean> {
    const cached = await this.getCachedRate(currencyPair);
    if (!cached) return true;

    const fetchedAt = new Date(cached.fetched_at);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return fetchedAt < oneHourAgo;
  }
}

export const costingRepository = new CostingRepository();
export default costingRepository;
