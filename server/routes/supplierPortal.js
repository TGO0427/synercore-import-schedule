// Supplier portal routes - self-service access for suppliers
import express from 'express';
import SupplierController from '../controllers/supplierController.js';
import { createSingleFileUpload, validateFilesPresent, generateSafeFilename } from '../middleware/fileUpload.js';

const router = express.Router();

// Configure upload for document uploads (single file at a time for supplier portal)
const upload = createSingleFileUpload();

/**
 * POST /api/supplier/register - Register new supplier account
 */
router.post('/register', async (req, res) => {
  await SupplierController.register(req, res);
});

/**
 * POST /api/supplier/login - Login supplier
 */
router.post('/login', async (req, res) => {
  await SupplierController.login(req, res);
});

// All routes below require supplier authentication
router.use((req, res, next) => {
  SupplierController.verifySupplierToken(req, res, next);
});

/**
 * GET /api/supplier/shipments - Get supplier's shipments
 */
router.get('/shipments', async (req, res) => {
  await SupplierController.getSupplierShipments(req, res);
});

/**
 * GET /api/supplier/shipments/:shipmentId - Get shipment detail
 */
router.get('/shipments/:shipmentId', async (req, res) => {
  await SupplierController.getShipmentDetail(req, res);
});

/**
 * POST /api/supplier/documents - Upload document for shipment
 * Validates: File type, MIME type, file size
 * Files are stored with sanitized names to prevent path traversal
 */
router.post('/documents',
  upload.single('file'),
  validateFilesPresent,
  async (req, res) => {
    await SupplierController.uploadDocument(req, res);
  }
);

/**
 * GET /api/supplier/reports - Get supplier's reports and analytics
 */
router.get('/reports', async (req, res) => {
  await SupplierController.getSupplierReports(req, res);
});

export default router;
