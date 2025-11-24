#!/usr/bin/env node

/**
 * Fix supplier name mismatches
 *
 * This script updates supplier names in the database to match the names
 * in the shipments data, ensuring metrics calculations work correctly.
 *
 * Mapping:
 * - "AB Mauri " → "AB Mauri" (remove trailing space)
 * - "Aromsa" → "AROMSA" (uppercase)
 * - "Shakti Chemicals" → "SHAKTI CHEMICALS" (uppercase)
 * - " Sacco" → "SACCO" (remove leading space, uppercase)
 * - "Deltaris" → "QUERCYL" (rename to match shipment data)
 * - "HALAVET" → remove or keep as is (no shipments)
 */

import db from './connection.js';

async function fixSupplierNames() {
  try {
    console.log('🔧 Starting supplier name fixes...\n');

    const updates = [
      {
        oldName: 'AB Mauri ',
        newName: 'AB Mauri',
        reason: 'Remove trailing space'
      },
      {
        oldName: 'Aromsa',
        newName: 'AROMSA',
        reason: 'Standardize to uppercase'
      },
      {
        oldName: 'Shakti Chemicals',
        newName: 'SHAKTI CHEMICALS',
        reason: 'Standardize to uppercase'
      },
      {
        oldName: ' Sacco',
        newName: 'SACCO',
        reason: 'Remove leading space and standardize to uppercase'
      },
      {
        oldName: 'Deltaris',
        newName: 'QUERCYL',
        reason: 'Rename to match shipment supplier data'
      }
      // Note: HALAVET has no matching shipments, keeping as is
    ];

    for (const update of updates) {
      console.log(`📝 ${update.reason}`);
      console.log(`   "${update.oldName}" → "${update.newName}"`);

      const result = await db.query(
        `UPDATE suppliers SET name = $1, updated_at = CURRENT_TIMESTAMP
         WHERE name = $2 RETURNING id, name`,
        [update.newName, update.oldName]
      );

      if (result.rows.length > 0) {
        console.log(`   ✅ Updated successfully (ID: ${result.rows[0].id})\n`);
      } else {
        console.log(`   ⚠️  No supplier found with name "${update.oldName}"\n`);
      }
    }

    // Show final supplier list
    console.log('\n📋 Final Supplier List:');
    const finalResult = await db.query(
      `SELECT id, name FROM suppliers ORDER BY name`,
    );

    finalResult.rows.forEach((supplier, index) => {
      console.log(`   ${index + 1}. ${supplier.name}`);
    });

    console.log('\n✅ Supplier name fixes completed!');
    console.log('   Metrics should now match shipment data correctly.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing supplier names:', error);
    process.exit(1);
  }
}

fixSupplierNames();
