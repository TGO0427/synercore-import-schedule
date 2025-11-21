/**
 * Admin Routes
 * One-time data import endpoint for bulk data operations
 */

import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { Supplier, Shipment } from '../types/index.js';

const router = Router();

/**
 * POST /api/admin/import-data - One-time data import
 * Requires: shipments and/or suppliers array in request body
 */
router.post('/import-data', asyncHandler(async (req: Request, res: Response) => {
  const client = await db.getPool().connect();

  try {
    const { shipments, suppliers } = req.body as {
      shipments?: Partial<Shipment>[];
      suppliers?: Partial<Supplier>[];
    };

    if (!shipments && !suppliers) {
      throw AppError.badRequest('Provide shipments and/or suppliers data');
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
            (supplier as any).contactPerson || null,
            supplier.email || null,
            (supplier as any).phone || null,
            (supplier as any).address || null,
            (supplier as any).country || null,
            (supplier as any).notes || null,
            (supplier as any).createdAt || new Date().toISOString(),
            (supplier as any).updatedAt || new Date().toISOString()
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
            (shipment as any).orderRef || null,
            (shipment as any).finalPod || null,
            shipment.latest_status || null,
            shipment.week_number || null,
            (shipment as any).productName || null,
            shipment.quantity || null,
            (shipment as any).cbm || null,
            (shipment as any).receivingWarehouse || null,
            shipment.notes || null,
            (shipment as any).updatedAt || new Date().toISOString(),
            (shipment as any).forwardingAgent || null,
            (shipment as any).incoterm || null,
            (shipment as any).vesselName || null,
            (shipment as any).selectedWeekDate || null
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
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
