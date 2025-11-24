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
 * GET /api/supplier/reports - Get supplier's reports and analytics
 */
router.get('/reports', async (req: Request, res: Response) => {
  await SupplierController.getSupplierReports(req, res);
});

export default router;
