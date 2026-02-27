/**
 * Supplier Portal Routes
 * Self-service access for suppliers to view shipments and upload documents
 */

import { Router, Request, Response } from 'express';
import SupplierController from '../controllers/supplierController.js';
import { createSingleFileUpload, validateFilesPresent } from '../middleware/fileUpload.js';

const router = Router();

// Configure upload for document uploads (single file at a time for supplier portal)
const upload = createSingleFileUpload();

/**
 * POST /api/supplier/register - Register new supplier account
 */
router.post('/register', async (req: Request, res: Response) => {
  await SupplierController.register(req, res);
});

/**
 * POST /api/supplier/login - Login supplier
 */
router.post('/login', async (req: Request, res: Response) => {
  await SupplierController.login(req, res);
});

// All routes below require supplier authentication
router.use((req: Request, res: Response, next) => {
  SupplierController.verifySupplierToken(req, res, next);
});

/**
 * GET /api/supplier/shipments - Get supplier's shipments
 */
router.get('/shipments', async (req: Request, res: Response) => {
  await SupplierController.getSupplierShipments(req, res);
});

/**
 * GET /api/supplier/shipments/:shipmentId - Get shipment detail
 */
router.get('/shipments/:shipmentId', async (req: Request, res: Response) => {
  await SupplierController.getShipmentDetail(req, res);
});

/**
 * POST /api/supplier/documents - Upload document for shipment
 * Validates: File type, MIME type, file size
 * Files are stored with sanitized names to prevent path traversal
 */
router.post(
  '/documents',
  upload.single('file'),
  validateFilesPresent,
  async (req: Request, res: Response) => {
    await SupplierController.uploadDocument(req, res);
  }
);

/**
 * GET /api/supplier/stats - Get supplier's shipment statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const supplierId = (req as any).user?.id;
    const supplierName = (req as any).user?.name;

    if (!supplierId) {
      return res.status(400).json({ error: 'Supplier ID not found' });
    }

    const { default: db } = await import('../db/connection.js');

    // If we have a supplier name from the token, use it; otherwise look it up
    let name = supplierName;
    if (!name) {
      const supplierResult = await db.query('SELECT name FROM suppliers WHERE id = $1', [supplierId]);
      name = supplierResult.rows[0]?.name;
    }

    if (!name) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get shipment stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_shipments,
        COUNT(CASE WHEN latest_status LIKE '%transit%' THEN 1 END) as in_transit,
        COUNT(CASE WHEN latest_status LIKE 'arrived%' THEN 1 END) as arrived,
        COUNT(CASE WHEN latest_status = 'stored' THEN 1 END) as stored,
        COUNT(CASE WHEN latest_status LIKE 'delayed_%' THEN 1 END) as delayed,
        COUNT(CASE WHEN latest_status IN ('arrived_pta', 'arrived_klm', 'arrived_offsite', 'stored', 'received') THEN 1 END) as on_time_count
      FROM shipments
      WHERE LOWER(TRIM(supplier)) = LOWER(TRIM($1))
    `, [name]);

    const stats = statsResult.rows[0];
    const total = parseInt(stats.total_shipments) || 0;
    const onTimeCount = parseInt(stats.on_time_count) || 0;

    res.json({
      totalShipments: total,
      inTransit: parseInt(stats.in_transit) || 0,
      arrived: parseInt(stats.arrived) || 0,
      stored: parseInt(stats.stored) || 0,
      delayed: parseInt(stats.delayed) || 0,
      onTimePercent: total > 0 ? Math.round((onTimeCount / total) * 100) : 0,
    });
  } catch (error) {
    console.error('Error fetching supplier stats:', error);
    res.status(500).json({ error: 'Failed to fetch supplier stats' });
  }
});

/**
 * GET /api/supplier/reports - Get supplier's reports and analytics
 */
router.get('/reports', async (req: Request, res: Response) => {
  await SupplierController.getSupplierReports(req, res);
});

/**
 * PUT /api/supplier/quotes/:id/respond - Respond to a quote request
 */
router.put('/quotes/:id/respond', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { response, price, notes } = req.body;

    if (!response || !['accepted', 'rejected', 'counter'].includes(response)) {
      return res.status(400).json({ error: 'Valid response required: accepted, rejected, or counter' });
    }

    const { default: db } = await import('../db/connection.js');
    const supplierId = (req as any).user?.id;

    const result = await db.query(
      `UPDATE quotes SET
        supplier_response = $1,
        response_price = $2,
        response_notes = $3,
        responded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND supplier_id = $5
       RETURNING *`,
      [response, price || null, notes || null, id, supplierId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found or access denied' });
    }

    res.json({ data: result.rows[0], message: 'Quote response submitted' });
  } catch (error) {
    console.error('Error responding to quote:', error);
    res.status(500).json({ error: 'Failed to respond to quote' });
  }
});

export default router;
