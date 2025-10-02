import { Shipment, ShipmentStatus } from '../../src/types/shipment.js';
import archiveService from '../services/archiveService.js';
import db from '../db/connection.js';

// Helper to convert snake_case DB columns to camelCase
function dbRowToShipment(row) {
  if (!row) return null;
  return {
    id: row.id,
    supplier: row.supplier,
    orderRef: row.order_ref,
    finalPod: row.final_pod,
    latestStatus: row.latest_status,
    weekNumber: row.week_number,
    productName: row.product_name,
    quantity: row.quantity ? parseFloat(row.quantity) : null,
    cbm: row.cbm ? parseFloat(row.cbm) : null,
    palletQty: row.pallet_qty ? parseFloat(row.pallet_qty) : null,
    receivingWarehouse: row.receiving_warehouse,
    notes: row.notes,
    updatedAt: row.updated_at,
    forwardingAgent: row.forwarding_agent,
    incoterm: row.incoterm,
    vesselName: row.vessel_name,
    selectedWeekDate: row.selected_week_date,
    createdAt: row.created_at,
    // Post-arrival workflow fields
    unloadingStartDate: row.unloading_start_date,
    unloadingCompletedDate: row.unloading_completed_date,
    inspectionDate: row.inspection_date,
    inspectionStatus: row.inspection_status,
    inspectionNotes: row.inspection_notes,
    inspectedBy: row.inspected_by,
    receivingDate: row.receiving_date,
    receivingStatus: row.receiving_status,
    receivingNotes: row.receiving_notes,
    receivedBy: row.received_by,
    receivedQuantity: row.received_quantity ? parseFloat(row.received_quantity) : null,
    discrepancies: row.discrepancies ? JSON.parse(row.discrepancies) : []
  };
}

export class ShipmentsController {
  static async getAllShipments(req, res) {
    try {
      const { sortBy = 'updated_at', order = 'asc', status, search } = req.query;

      let query = 'SELECT * FROM shipments WHERE 1=1';
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND latest_status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        query += ` AND (LOWER(order_ref) LIKE $${params.length} OR LOWER(supplier) LIKE $${params.length} OR LOWER(final_pod) LIKE $${params.length})`;
      }

      // Map camelCase to snake_case for sorting
      const sortColumn = sortBy === 'estimatedArrival' ? 'updated_at' : sortBy.replace(/([A-Z])/g, '_$1').toLowerCase();
      query += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;

      const result = await db.query(query, params);
      const shipments = result.rows.map(dbRowToShipment);

      console.log('getAllShipments: Sample values being returned:', shipments.slice(0, 5).map(s => ({ id: s.id, cbm: s.cbm, status: s.latestStatus })));

      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json(shipments);
    } catch (error) {
      console.error('Error in getAllShipments:', error);
      res.status(500).json({
        error: error.message,
        details: 'Failed to retrieve shipments',
        timestamp: new Date().toISOString()
      });
    }
  }

  static async getShipmentById(req, res) {
    console.log('DEBUG: getShipmentById method called with id:', req.params.id);
    try {
      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createShipment(req, res) {
    try {
      const shipmentData = req.body;
      const id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.query(
        `INSERT INTO shipments (
          id, supplier, order_ref, final_pod, latest_status, week_number,
          product_name, quantity, cbm, pallet_qty, receiving_warehouse, notes,
          forwarding_agent, incoterm, vessel_name, selected_week_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          id,
          shipmentData.supplier,
          shipmentData.orderRef || null,
          shipmentData.finalPod || null,
          shipmentData.latestStatus || null,
          shipmentData.weekNumber || null,
          shipmentData.productName || null,
          shipmentData.quantity || null,
          shipmentData.cbm || null,
          shipmentData.palletQty || null,
          shipmentData.receivingWarehouse || null,
          shipmentData.notes || null,
          shipmentData.forwardingAgent || null,
          shipmentData.incoterm || null,
          shipmentData.vesselName || null,
          shipmentData.selectedWeekDate || null
        ]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      res.status(201).json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateShipment(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      await db.query(
        `UPDATE shipments SET
          supplier = COALESCE($1, supplier),
          order_ref = COALESCE($2, order_ref),
          final_pod = COALESCE($3, final_pod),
          latest_status = COALESCE($4, latest_status),
          week_number = COALESCE($5, week_number),
          product_name = COALESCE($6, product_name),
          quantity = COALESCE($7, quantity),
          cbm = COALESCE($8, cbm),
          pallet_qty = COALESCE($9, pallet_qty),
          receiving_warehouse = COALESCE($10, receiving_warehouse),
          notes = COALESCE($11, notes),
          forwarding_agent = COALESCE($12, forwarding_agent),
          incoterm = COALESCE($13, incoterm),
          vessel_name = COALESCE($14, vessel_name),
          selected_week_date = COALESCE($15, selected_week_date),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $16`,
        [
          data.supplier,
          data.orderRef,
          data.finalPod,
          data.latestStatus,
          data.weekNumber,
          data.productName,
          data.quantity,
          data.cbm,
          data.palletQty,
          data.receivingWarehouse,
          data.notes,
          data.forwardingAgent,
          data.incoterm,
          data.vesselName,
          data.selectedWeekDate,
          id
        ]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteShipment(req, res) {
    try {
      const result = await db.query('DELETE FROM shipments WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getShipmentsByStatus(req, res) {
    try {
      const { status } = req.params;
      const result = await db.query('SELECT * FROM shipments WHERE latest_status = $1', [status]);
      res.json(result.rows.map(dbRowToShipment));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDelayedShipments(req, res) {
    try {
      const result = await db.query('SELECT * FROM shipments WHERE latest_status = $1', [ShipmentStatus.DELAYED]);
      res.json(result.rows.map(dbRowToShipment));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkImport(shipmentsData) {
    const client = await db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Archive existing data before importing
      const existingResult = await client.query('SELECT * FROM shipments');
      if (existingResult.rows.length > 0) {
        console.log(`Archiving ${existingResult.rows.length} existing shipments before new import`);
        try {
          const existingShipments = existingResult.rows.map(dbRowToShipment);
          const archiveFileName = archiveService.archiveCurrentData(existingShipments);
          console.log(`Successfully archived to: ${archiveFileName}`);
        } catch (error) {
          console.error('Failed to archive existing data:', error);
        }
      }

      // Delete all existing shipments
      await client.query('DELETE FROM shipments');

      // Insert new shipments
      for (const shipment of shipmentsData) {
        await client.query(
          `INSERT INTO shipments (
            id, supplier, order_ref, final_pod, latest_status, week_number,
            product_name, quantity, cbm, pallet_qty, receiving_warehouse, notes, updated_at,
            forwarding_agent, incoterm, vessel_name, selected_week_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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

      await client.query('COMMIT');
      console.log(`Bulk import completed: ${shipmentsData.length} shipments loaded`);
      return shipmentsData.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async bulkImportEndpoint(req, res) {
    try {
      console.log('Bulk import endpoint called with', req.body.length, 'shipments');
      console.log('Sample shipment CBM values:', req.body.slice(0, 3).map(s => ({ id: s.id, cbm: s.cbm })));
      const count = await ShipmentsController.bulkImport(req.body);
      res.json({
        success: true,
        message: `Successfully imported ${count} shipments`,
        count: count
      });
    } catch (error) {
      console.error('Bulk import endpoint error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getArchives(req, res) {
    try {
      const archives = archiveService.getArchivedFiles().map(fileName => {
        const stats = archiveService.getArchivedData(fileName);
        return {
          fileName,
          archivedAt: stats?.archivedAt,
          totalShipments: stats?.totalShipments || 0
        };
      });
      res.json(archives);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static getArchiveData(req, res) {
    try {
      const { fileName } = req.params;
      const archiveData = archiveService.getArchivedData(fileName);
      if (!archiveData) {
        return res.status(404).json({ error: 'Archive not found' });
      }
      res.json(archiveData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAutoArchiveStats(req, res) {
    try {
      const { daysOld = 30 } = req.query;
      const result = await db.query('SELECT * FROM shipments');
      const shipments = result.rows.map(dbRowToShipment);
      const stats = archiveService.getAutoArchiveStats(shipments, parseInt(daysOld));
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async performAutoArchive(req, res) {
    const client = await db.getPool().connect();

    try {
      await client.query('BEGIN');

      const { daysOld = 30 } = req.body;
      console.log(`Performing auto-archive for ARRIVED shipments older than ${daysOld} days`);

      const result = await client.query('SELECT * FROM shipments');
      const allShipments = result.rows.map(dbRowToShipment);

      const archiveResult = archiveService.archiveOldArrivedShipments(allShipments, parseInt(daysOld));

      // Delete archived shipments
      const archivedIds = archiveResult.remaining.length < allShipments.length
        ? allShipments.filter(s => !archiveResult.remaining.find(r => r.id === s.id)).map(s => s.id)
        : [];

      if (archivedIds.length > 0) {
        await client.query(
          `DELETE FROM shipments WHERE id = ANY($1::text[])`,
          [archivedIds]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        archivedCount: archiveResult.archived,
        remainingCount: archiveResult.remaining.length,
        archiveFileName: archiveResult.archiveFileName
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Auto-archive error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  }

  static async renameArchive(req, res) {
    try {
      const { fileName } = req.params;
      const { newName } = req.body;

      if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New name is required' });
      }

      const result = archiveService.renameArchiveFile(fileName, newName.trim());

      res.json({
        success: true,
        message: 'Archive renamed successfully',
        oldFileName: result.oldFileName,
        newFileName: result.newFileName,
        customName: result.customName
      });
    } catch (error) {
      console.error('Archive rename error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async performManualArchive(req, res) {
    const client = await db.getPool().connect();

    try {
      await client.query('BEGIN');

      const { shipmentIds } = req.body;
      console.log(`Performing manual archive for ${shipmentIds.length} selected shipments`);

      if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({ error: 'No shipment IDs provided' });
      }

      // Find shipments to archive
      const result = await client.query(
        `SELECT * FROM shipments WHERE id = ANY($1::text[]) AND latest_status IN ('arrived_pta', 'arrived_klm', 'stored')`,
        [shipmentIds]
      );
      const shipmentsToArchive = result.rows.map(dbRowToShipment);

      if (shipmentsToArchive.length === 0) {
        return res.status(400).json({ error: 'No valid ARRIVED or STORED shipments found to archive' });
      }

      // Create archive
      const archiveResult = archiveService.archiveSpecificShipments(shipmentsToArchive);

      // Remove archived shipments
      await client.query(
        `DELETE FROM shipments WHERE id = ANY($1::text[])`,
        [shipmentIds]
      );

      const remaining = await client.query('SELECT COUNT(*) FROM shipments');

      await client.query('COMMIT');

      res.json({
        success: true,
        archivedCount: shipmentsToArchive.length,
        remainingCount: parseInt(remaining.rows[0].count),
        archiveFileName: archiveResult.archiveFileName
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Manual archive error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  }

  // Post-arrival workflow endpoints
  static async startUnloading(req, res) {
    try {
      const { id } = req.params;

      await db.query(
        `UPDATE shipments SET
          latest_status = 'unloading',
          unloading_start_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND latest_status IN ('arrived_pta', 'arrived_klm')`,
        [id]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not in ARRIVED status' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error starting unloading:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async completeUnloading(req, res) {
    try {
      const { id } = req.params;

      await db.query(
        `UPDATE shipments SET
          latest_status = 'inspection_pending',
          unloading_completed_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND latest_status = 'unloading'`,
        [id]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not in UNLOADING status' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error completing unloading:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async startInspection(req, res) {
    try {
      const { id } = req.params;
      const { inspectedBy } = req.body;

      await db.query(
        `UPDATE shipments SET
          latest_status = 'inspecting',
          inspection_status = 'in_progress',
          inspected_by = $2,
          inspection_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND latest_status = 'inspection_pending'`,
        [id, inspectedBy || '']
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not in INSPECTION_PENDING status' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error starting inspection:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async completeInspection(req, res) {
    try {
      const { id } = req.params;
      const { passed, notes, inspectedBy } = req.body;

      await db.query(
        `UPDATE shipments SET
          inspection_status = $2,
          latest_status = $3,
          inspection_notes = $4,
          inspected_by = COALESCE($5, inspected_by),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND latest_status = 'inspecting'`,
        [id, passed ? 'passed' : 'failed', passed ? 'inspection_passed' : 'inspection_failed', notes || '', inspectedBy]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not in INSPECTING status' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error completing inspection:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async startReceiving(req, res) {
    try {
      const { id } = req.params;
      const { receivedBy } = req.body;

      await db.query(
        `UPDATE shipments SET
          latest_status = 'receiving',
          receiving_status = 'in_progress',
          received_by = $2,
          receiving_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND latest_status = 'inspection_passed'`,
        [id, receivedBy || '']
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or inspection not passed' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error starting receiving:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async completeReceiving(req, res) {
    try {
      console.log('DEBUG: completeReceiving called for shipment:', req.params.id);
      console.log('DEBUG: completeReceiving body:', req.body);
      const { id } = req.params;
      const { receivedQuantity, notes, receivedBy, discrepancies } = req.body;

      // Get current shipment to compare quantity
      const current = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      const shipment = current.rows[0];
      if (shipment.latest_status !== 'receiving') {
        return res.status(400).json({ error: 'Shipment must be in RECEIVING status' });
      }

      let receivingStatus = 'completed';
      let latestStatus = 'received';

      if (discrepancies && discrepancies.length > 0) {
        receivingStatus = 'discrepancy';
        console.log('DEBUG: Setting status to discrepancy');
      } else if (receivedQuantity < parseFloat(shipment.quantity)) {
        receivingStatus = 'partial';
        console.log('DEBUG: Setting status to partial');
      } else {
        console.log('DEBUG: Setting status to received');
      }

      await db.query(
        `UPDATE shipments SET
          received_quantity = $2,
          receiving_notes = $3,
          discrepancies = $4,
          received_by = COALESCE($5, received_by),
          receiving_status = $6,
          latest_status = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [id, receivedQuantity, notes || '', JSON.stringify(discrepancies || []), receivedBy, receivingStatus, latestStatus]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      console.log('DEBUG: Updated shipment status to:', result.rows[0].latest_status);

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error completing receiving:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async markAsStored(req, res) {
    try {
      const { id } = req.params;

      await db.query(
        `UPDATE shipments SET
          latest_status = 'stored',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND latest_status = 'received'`,
        [id]
      );

      const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not in RECEIVED status' });
      }

      res.json(dbRowToShipment(result.rows[0]));
    } catch (error) {
      console.error('Error marking as stored:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getPostArrivalShipments(req, res) {
    console.log('DEBUG: getPostArrivalShipments method called');
    try {
      const postArrivalStates = [
        'arrived_pta', 'arrived_klm', 'unloading', 'inspection_pending', 'inspecting',
        'inspection_failed', 'inspection_passed', 'receiving', 'received'
      ];

      const result = await db.query(
        `SELECT * FROM shipments WHERE latest_status = ANY($1::text[])`,
        [postArrivalStates]
      );

      res.json(result.rows.map(dbRowToShipment));
    } catch (error) {
      console.error('Error getting post-arrival shipments:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
