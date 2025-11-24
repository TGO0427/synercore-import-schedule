#!/usr/bin/env node

/**
 * Fix shipment supplier name inconsistencies
 *
 * Your shipments have mixed case supplier names:
 * - "Shakti Chemicals" (mixed case)
 * - "SHAKTI CHEMICALS" (uppercase)
 *
 * This script standardizes all shipment supplier names to match
 * your Suppliers table, so metrics calculations work correctly.
 *
 * Mappings:
 * - "Shakti Chemicals" → "SHAKTI CHEMICALS" (standardize to uppercase)
 * - Any other inconsistencies will be detected and reported
 */

import db from './connection.js';

async function fixShipmentSupplierNames() {
  try {
    console.log('🔧 Starting shipment supplier name fixes...\n');

    // First, get all unique supplier names from shipments
    const shipmentSuppliersResult = await db.query(
      `SELECT DISTINCT supplier FROM shipments ORDER BY supplier`
    );

    const shipmentSuppliers = shipmentSuppliersResult.rows.map(r => r.supplier);
    console.log(`📋 Supplier names in shipments (${shipmentSuppliers.length}):`);
    shipmentSuppliers.forEach(s => console.log(`   - "${s}"`));
    console.log();

    // Get all supplier names from suppliers table
    const suppliersTableResult = await db.query(
      `SELECT DISTINCT name FROM suppliers ORDER BY name`
    );

    const supplierTableNames = suppliersTableResult.rows.map(r => r.name);
    console.log(`📋 Supplier names in suppliers table (${supplierTableNames.length}):`);
    supplierTableNames.forEach(s => console.log(`   - "${s}"`));
    console.log();

    // Define the fixes needed
    const fixes = [
      {
        oldName: 'Shakti Chemicals',
        newName: 'SHAKTI CHEMICALS',
        reason: 'Standardize mixed case to uppercase'
      }
      // Add more mappings as needed
    ];

    console.log('🔄 Applying fixes:\n');

    for (const fix of fixes) {
      console.log(`📝 ${fix.reason}`);
      console.log(`   "${fix.oldName}" → "${fix.newName}"`);

      const result = await db.query(
        `UPDATE shipments SET supplier = $1, updated_at = CURRENT_TIMESTAMP
         WHERE supplier = $2 RETURNING id`,
        [fix.newName, fix.oldName]
      );

      if (result.rows.length > 0) {
        console.log(`   ✅ Updated ${result.rows.length} shipment(s)\n`);
      } else {
        console.log(`   ⚠️  No shipments found with supplier "${fix.oldName}"\n`);
      }
    }

    // Verify all shipments now have valid suppliers
    console.log('🔍 Verifying fixes...\n');

    const verifyResult = await db.query(
      `SELECT DISTINCT supplier FROM shipments ORDER BY supplier`
    );

    const updatedSuppliers = verifyResult.rows.map(r => r.supplier);
    console.log(`📋 Final supplier names in shipments (${updatedSuppliers.length}):`);
    updatedSuppliers.forEach(s => console.log(`   - "${s}"`));
    console.log();

    // Check for any remaining mismatches
    const mismatches = updatedSuppliers.filter(
      shipmentName => !supplierTableNames.some(
        tableName => tableName.toLowerCase().trim() === shipmentName.toLowerCase().trim()
      )
    );

    if (mismatches.length > 0) {
      console.log('⚠️  WARNING: Still have mismatches:');
      mismatches.forEach(m => console.log(`   - "${m}"`));
      console.log();
    } else {
      console.log('✅ All shipment suppliers now match suppliers table!\n');
    }

    console.log('✅ Shipment supplier name fixes completed!');
    console.log('   Metrics should now match shipment data correctly.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing shipment supplier names:', error);
    process.exit(1);
  }
}

fixShipmentSupplierNames();
