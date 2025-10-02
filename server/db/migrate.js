import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

// Disable SSL certificate validation for Railway Postgres
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log('🔄 Starting database migration...');

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not set, skipping migration');
      process.exit(0);
      return;
    }

    // Test database connection
    try {
      await db.query('SELECT 1');
      console.log('✓ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }

    // Read and execute schema
    const schemaSQL = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(schemaSQL);
    console.log('✓ Schema created successfully');

    // Load data from JSON files
    const shipmentsFile = path.join(__dirname, '../data/shipments.json');
    const suppliersFile = path.join(__dirname, '../data/suppliers.json');

    // Migrate shipments
    try {
      const shipmentsData = await fs.readFile(shipmentsFile, 'utf8');
      const shipments = JSON.parse(shipmentsData);

      if (shipments.length > 0) {
        console.log(`📦 Migrating ${shipments.length} shipments...`);

        for (const shipment of shipments) {
          await db.query(
            `INSERT INTO shipments (
              id, supplier, order_ref, final_pod, latest_status, week_number,
              product_name, quantity, cbm, pallet_qty, receiving_warehouse, notes, updated_at,
              forwarding_agent, incoterm, vessel_name, selected_week_date
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
              updated_at = EXCLUDED.updated_at,
              forwarding_agent = EXCLUDED.forwarding_agent,
              incoterm = EXCLUDED.incoterm,
              vessel_name = EXCLUDED.vessel_name,
              selected_week_date = EXCLUDED.selected_week_date`,
            [
              shipment.id,
              shipment.supplier,
              shipment.orderRef || null,
              shipment.finalPod || null,
              shipment.latestStatus || null,
              shipment.weekNumber || null,
              shipment.productName || null,
              shipment.quantity || null,
              shipment.cbm || null,
              shipment.palletQty || null,
              shipment.receivingWarehouse || null,
              shipment.notes || null,
              shipment.updatedAt || new Date().toISOString(),
              shipment.forwardingAgent || null,
              shipment.incoterm || null,
              shipment.vesselName || null,
              shipment.selectedWeekDate || null
            ]
          );
        }
        console.log(`✓ Migrated ${shipments.length} shipments`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('ℹ️  No shipments file found, skipping shipments migration');
      } else {
        throw error;
      }
    }

    // Migrate suppliers
    try {
      const suppliersData = await fs.readFile(suppliersFile, 'utf8');
      const suppliers = JSON.parse(suppliersData);

      if (suppliers.length > 0) {
        console.log(`🏢 Migrating ${suppliers.length} suppliers...`);

        for (const supplier of suppliers) {
          await db.query(
            `INSERT INTO suppliers (
              id, name, contact_person, email, phone, address, country, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              contact_person = EXCLUDED.contact_person,
              email = EXCLUDED.email,
              phone = EXCLUDED.phone,
              address = EXCLUDED.address,
              country = EXCLUDED.country,
              notes = EXCLUDED.notes,
              updated_at = EXCLUDED.updated_at`,
            [
              supplier.id,
              supplier.name,
              supplier.contactPerson || null,
              supplier.email || null,
              supplier.phone || null,
              supplier.address || null,
              supplier.country || null,
              supplier.notes || null,
              supplier.createdAt || new Date().toISOString(),
              supplier.updatedAt || new Date().toISOString()
            ]
          );
        }
        console.log(`✓ Migrated ${suppliers.length} suppliers`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('ℹ️  No suppliers file found, skipping suppliers migration');
      } else {
        throw error;
      }
    }

    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
