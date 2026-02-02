/**
 * Migration: Create costing tables and add all columns
 * This creates the import_cost_estimates and exchange_rate_cache tables
 * and adds all columns needed for the AFI rate sheet structure
 */

import { query } from './connection.js';

const addColumn = async (columnDef) => {
  const colName = columnDef.split(' ')[0];
  try {
    // Check if column exists
    const checkResult = await query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='import_cost_estimates' AND column_name=$1`,
      [colName]
    );

    if (checkResult.rows.length === 0) {
      await query(`ALTER TABLE import_cost_estimates ADD COLUMN ${columnDef}`);
      console.log(`  ✓ Added column: ${colName}`);
      return true;
    }
    return false;
  } catch (error) {
    throw error;
  }
};

export default async function addCostingColumns() {
  console.log('Running costing tables migration...');

  // Create import_cost_estimates table if it doesn't exist
  const tableCheck = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_name='import_cost_estimates'`
  );

  if (tableCheck.rows.length === 0) {
    console.log('  Creating import_cost_estimates table...');
    await query(`
      CREATE TABLE import_cost_estimates (
        id VARCHAR(255) PRIMARY KEY,
        shipment_id VARCHAR(255),
        supplier_id VARCHAR(255),
        reference_number VARCHAR(100),
        country_of_destination VARCHAR(100) DEFAULT 'South Africa',
        port_of_discharge VARCHAR(50),
        shipping_line VARCHAR(100),
        routing VARCHAR(255),
        frequency VARCHAR(50),
        transit_time_days INTEGER,
        inco_terms VARCHAR(20),
        inco_term_place VARCHAR(100),
        container_type VARCHAR(50),
        quantity INTEGER DEFAULT 1,
        hs_code VARCHAR(50),
        gross_weight_kg NUMERIC(12,2),
        total_gross_weight_kg NUMERIC(12,2),
        origin_rate_usd NUMERIC(12,2),
        ocean_freight_rate_usd NUMERIC(12,2),
        commodity VARCHAR(255),
        invoice_value_usd NUMERIC(14,2) DEFAULT 0,
        invoice_value_eur NUMERIC(14,2) DEFAULT 0,
        customs_value_zar NUMERIC(14,2) DEFAULT 0,
        supplier_name VARCHAR(255),
        validity_date DATE,
        costing_date DATE DEFAULT CURRENT_DATE,
        payment_terms VARCHAR(100),
        roe_origin NUMERIC(12,6),
        roe_eur NUMERIC(12,6),
        origin_charge_usd NUMERIC(12,2) DEFAULT 0,
        origin_charge_eur NUMERIC(12,2) DEFAULT 0,
        origin_charge_zar NUMERIC(14,2) DEFAULT 0,
        total_origin_charges_zar NUMERIC(14,2) DEFAULT 0,
        customs_duty_not_applicable BOOLEAN DEFAULT false,
        total_shipping_cost_zar NUMERIC(14,2) DEFAULT 0,
        total_in_warehouse_cost_zar NUMERIC(14,2) DEFAULT 0,
        all_in_warehouse_cost_per_kg_zar NUMERIC(12,4) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        notes TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ Created import_cost_estimates table');

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_cost_estimates_shipment ON import_cost_estimates(shipment_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cost_estimates_supplier ON import_cost_estimates(supplier_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cost_estimates_date ON import_cost_estimates(costing_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cost_estimates_status ON import_cost_estimates(status)`);
    console.log('  ✓ Created indexes');
  }

  // Create exchange_rate_cache table if it doesn't exist
  const rateTableCheck = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_name='exchange_rate_cache'`
  );

  if (rateTableCheck.rows.length === 0) {
    console.log('  Creating exchange_rate_cache table...');
    await query(`
      CREATE TABLE exchange_rate_cache (
        id SERIAL PRIMARY KEY,
        currency_pair VARCHAR(10) NOT NULL UNIQUE,
        rate NUMERIC(12,6) NOT NULL,
        source VARCHAR(100),
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ Created exchange_rate_cache table');
  }

  let added = 0;

  // Local Charges columns
  const localChargeColumns = [
    'local_cartage_cpt_klapmuts_20ton_zar NUMERIC(12,2) DEFAULT 0',
    'local_cartage_cpt_klapmuts_28ton_zar NUMERIC(12,2) DEFAULT 0',
    'transport_dbn_to_pretoria_20ft_zar NUMERIC(12,2) DEFAULT 0',
    'transport_dbn_to_pretoria_40ft_zar NUMERIC(12,2) DEFAULT 0',
    'transport_dbn_to_whs_zar NUMERIC(12,2) DEFAULT 0',
    'unpack_reload_zar NUMERIC(12,2) DEFAULT 0',
    'storage_zar NUMERIC(12,2) DEFAULT 0',
    'storage_days INTEGER DEFAULT 0',
    'outlying_depot_surcharge_zar NUMERIC(12,2) DEFAULT 0',
    'local_cartage_dbn_whs_pretoria_opt_a_zar NUMERIC(12,2) DEFAULT 0',
    'local_cartage_dbn_whs_pretoria_opt_b_zar NUMERIC(12,2) DEFAULT 0',
    'local_cartage_dbn_whs_pretoria_6m_zar NUMERIC(12,2) DEFAULT 0',
    'local_cartage_dbn_whs_pretoria_12m_zar NUMERIC(12,2) DEFAULT 0',
    'transport_pe_coega_to_pretoria_zar NUMERIC(12,2) DEFAULT 0',
    'local_charges_subtotal_zar NUMERIC(14,2) DEFAULT 0',
  ];

  for (const col of localChargeColumns) {
    if (await addColumn(col)) added++;
  }

  // Destination Charges columns
  const destChargeColumns = [
    'shipping_line_charges_zar NUMERIC(12,2) DEFAULT 0',
    'cargo_dues_20ft_zar NUMERIC(12,2) DEFAULT 0',
    'cargo_dues_40ft_zar NUMERIC(12,2) DEFAULT 0',
    'cto_fee_zar NUMERIC(12,2) DEFAULT 0',
    'port_health_inspection_zar NUMERIC(12,2) DEFAULT 0',
    'daff_inspection_zar NUMERIC(12,2) DEFAULT 0',
    'state_vet_cancellation_fee_zar NUMERIC(12,2) DEFAULT 0',
    'jnb_turn_in_zar NUMERIC(12,2) DEFAULT 0',
    'destination_charges_subtotal_zar NUMERIC(14,2) DEFAULT 0',
  ];

  for (const col of destChargeColumns) {
    if (await addColumn(col)) added++;
  }

  // Customs & Duties columns
  const customsColumns = [
    'duties_zar NUMERIC(12,2) DEFAULT 0',
    'total_duties_zar NUMERIC(12,2) DEFAULT 0',
    'customs_vat_zar NUMERIC(12,2) DEFAULT 0',
    'import_vat_zar NUMERIC(12,2) DEFAULT 0',
    'customs_declaration_zar NUMERIC(12,2) DEFAULT 0',
    'agency_fee_zar NUMERIC(12,2) DEFAULT 0',
    'agency_fee_percentage NUMERIC(5,2) DEFAULT 3.5',
    'agency_fee_min NUMERIC(12,2) DEFAULT 1187',
    'customs_subtotal_zar NUMERIC(14,2) DEFAULT 0',
  ];

  for (const col of customsColumns) {
    if (await addColumn(col)) added++;
  }

  // Origin details columns
  const originColumns = [
    'country_of_origin VARCHAR(100)',
    'port_of_loading VARCHAR(100)',
    'roe_customs NUMERIC(12,6)',
  ];

  for (const col of originColumns) {
    if (await addColumn(col)) added++;
  }

  // Ocean freight columns (USD and EUR)
  const oceanFreightColumns = [
    'ocean_freight_usd NUMERIC(12,2) DEFAULT 0',
    'ocean_freight_eur NUMERIC(12,2) DEFAULT 0',
    'ocean_freight_zar NUMERIC(14,2) DEFAULT 0',
    'total_ocean_freight_zar NUMERIC(14,2) DEFAULT 0',
  ];

  for (const col of oceanFreightColumns) {
    if (await addColumn(col)) added++;
  }

  // Products array (JSON) - for multi-product costing
  const productsColumn = "products JSONB DEFAULT '[]'::jsonb";
  if (await addColumn(productsColumn)) added++;

  if (added > 0) {
    console.log(`✓ Added ${added} new costing columns`);
  } else {
    console.log('✓ All costing columns already exist');
  }
}
