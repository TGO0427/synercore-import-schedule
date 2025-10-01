import express from 'express';
import db from '../db/connection.js';

const router = express.Router();

// POST /api/admin/import-data - One-time data import
router.post('/import-data', async (req, res) => {
  const client = await db.getPool().connect();

  try {
    const { shipments, suppliers } = req.body;

    if (!shipments && !suppliers) {
      return res.status(400).json({ error: 'Provide shipments and/or suppliers data' });
    }

    await client.query('BEGIN');

    let shipmentsImported = 0;
    let suppliersImported = 0;

    // Import suppliers first
    if (suppliers && Array.isArray(suppliers)) {
      for (const supplier of suppliers) {
        await client.query(
          `INSERT INTO suppliers (id, name, contact_person, email, phone, address, country, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        suppliersImported++;
      }
    }

    // Import shipments
    if (shipments && Array.isArray(shipments)) {
      for (const shipment of shipments) {
        await client.query(
          `INSERT INTO shipments (
            id, supplier, order_ref, final_pod, latest_status, week_number,
            product_name, quantity, cbm, receiving_warehouse, notes, updated_at,
            forwarding_agent, incoterm, vessel_name, selected_week_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            supplier = EXCLUDED.supplier,
            order_ref = EXCLUDED.order_ref,
            final_pod = EXCLUDED.final_pod,
            latest_status = EXCLUDED.latest_status,
            week_number = EXCLUDED.week_number,
            product_name = EXCLUDED.product_name,
            quantity = EXCLUDED.quantity,
            cbm = EXCLUDED.cbm,
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
            shipment.receivingWarehouse || null,
            shipment.notes || null,
            shipment.updatedAt || new Date().toISOString(),
            shipment.forwardingAgent || null,
            shipment.incoterm || null,
            shipment.vesselName || null,
            shipment.selectedWeekDate || null
          ]
        );
        shipmentsImported++;
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Data imported successfully',
      shipmentsImported,
      suppliersImported
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
