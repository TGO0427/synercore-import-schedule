// Supplier portal routes - self-service access for suppliers
import express from 'express';
import multer from 'multer';
import SupplierController from '../controllers/supplierController.js';

const router = express.Router();

// Configure multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, images, Word, Excel'));
    }
  }
});

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
 */
router.post('/documents', upload.single('file'), async (req, res) => {
  await SupplierController.uploadDocument(req, res);
});

/**
 * GET /api/supplier/reports - Get supplier's reports and analytics
 */
router.get('/reports', async (req, res) => {
  await SupplierController.getSupplierReports(req, res);
});

// Error handling for file upload
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({ error: 'File too large (max 50MB)' });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

export default router;
