// Script to restore shipments from archive file
// Usage: node server/scripts/restoreFromArchive.js <archive-file-path>

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restoreFromArchive(archiveFilePath) {
  try {
    console.log('🔄 Starting data restoration...');
    console.log(`📁 Reading archive: ${archiveFilePath}`);

    // Read archive file
    const archiveData = await fs.readFile(archiveFilePath, 'utf-8');
    const archive = JSON.parse(archiveData);

    console.log(`📊 Found ${archive.totalShipments} shipments in archive from ${archive.archivedAt}`);

    if (!archive.data || archive.data.length === 0) {
      console.log('⚠️  No shipment data found in archive');
      return;
    }

    // Confirm restoration
    console.log('\n⚠️  WARNING: This will REPLACE existing shipment data!');
    console.log(`   Shipments to restore: ${archive.data.length}`);

    // Start transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Clear existing shipments (optional - comment out if you want to merge)
      console.log('🗑️  Clearing existing shipments...');
      await client.query('DELETE FROM shipments');

      // Insert archived shipments
      console.log('💾 Restoring shipments...');
      let restored = 0;

      for (const shipment of archive.data) {
        const query = `
          INSERT INTO shipments (
            id, supplier, order_ref, final_pod, latest_status, week_number,
            product_name, quantity, cbm, pallet_qty, receiving_warehouse,
            notes, forwarding_agent, vessel_name, incoterm, updated_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            supplier = EXCLUDED.supplier,
            order_ref = EXCLUDED.order_ref,
            final_pod = EXCLUDED.final_pod,
            latest_status = EXCLUDED.latest_status,
            week_number = EXCLUDED.week_number,
            product_name = EXCLUDED.product_name,
            quantity = EXCLUDED.quantity,
            cbm = EXCLUDED.cbm,
            pallet_qty = EXCLUDED.pallet_qty,
            receiving_warehouse = EXCLUDED.receiving_warehouse,
            notes = EXCLUDED.notes,
            updated_at = EXCLUDED.updated_at
        `;

        const values = [
          shipment.id,
          shipment.supplier,
          shipment.orderRef || shipment.order_ref,
          shipment.finalPod || shipment.final_pod,
          shipment.latestStatus || shipment.latest_status,
          shipment.weekNumber || shipment.week_number,
          shipment.productName || shipment.product_name,
          shipment.quantity,
          shipment.cbm,
          shipment.palletQty || shipment.pallet_qty,
          shipment.receivingWarehouse || shipment.receiving_warehouse,
          shipment.notes || '',
          shipment.forwardingAgent || shipment.forwarding_agent || '',
          shipment.vesselName || shipment.vessel_name || '',
          shipment.incoterm || '',
          shipment.updatedAt || shipment.updated_at || new Date().toISOString(),
          shipment.createdAt || shipment.created_at || new Date().toISOString()
        ];

        await client.query(query, values);
        restored++;

        if (restored % 10 === 0) {
          console.log(`   Restored ${restored}/${archive.data.length} shipments...`);
        }
      }

      await client.query('COMMIT');
      console.log(`\n✅ Successfully restored ${restored} shipments!`);
      console.log(`📅 Archive date: ${archive.archivedAt}`);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error restoring from archive:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Get archive file path from command line
const archiveFile = process.argv[2];

if (!archiveFile) {
  console.error('❌ Usage: node restoreFromArchive.js <archive-file-path>');
  console.error('   Example: node server/scripts/restoreFromArchive.js server/archive/shipments_2025-09-10T08-49-57-914Z.json');
  process.exit(1);
}

// Run restoration
restoreFromArchive(archiveFile)
  .then(() => {
    console.log('✨ Restoration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Restoration failed:', error);
    process.exit(1);
  });
