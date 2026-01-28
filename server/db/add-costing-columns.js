/**
 * Migration: Add new costing columns for Local Charges and Destination Charges
 * This adds all the new columns needed for the AFI rate sheet structure
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
    // Table might not exist yet, that's OK
    if (error.message?.includes('does not exist')) {
      console.log(`  - Table import_cost_estimates does not exist yet`);
      return false;
    }
    throw error;
  }
};

export default async function addCostingColumns() {
  console.log('Running costing columns migration...');

  // Check if table exists first
  const tableCheck = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_name='import_cost_estimates'`
  );

  if (tableCheck.rows.length === 0) {
    console.log('  - import_cost_estimates table does not exist, skipping column migration');
    return;
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
    'customs_vat_zar NUMERIC(12,2) DEFAULT 0',
    'customs_declaration_zar NUMERIC(12,2) DEFAULT 0',
    'agency_fee_zar NUMERIC(12,2) DEFAULT 0',
    'agency_fee_percentage NUMERIC(5,2) DEFAULT 3.5',
    'agency_fee_min NUMERIC(12,2) DEFAULT 1187',
    'customs_subtotal_zar NUMERIC(14,2) DEFAULT 0',
  ];

  for (const col of customsColumns) {
    if (await addColumn(col)) added++;
  }

  if (added > 0) {
    console.log(`✓ Added ${added} new costing columns`);
  } else {
    console.log('✓ All costing columns already exist');
  }
}
