// server/index.js
import dotenv from 'dotenv';

// Load environment variables from .env file (only if DATABASE_URL not already provided)
// Railway automatically sets DATABASE_URL, so we skip .env in production
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

// SSL certificate validation (only disable for local development)
// Railway Postgres connections are handled securely in db/connection.js
if (process.env.NODE_ENV === 'development' && process.env.DISABLE_SSL_VERIFY === 'true') {
  console.warn('⚠️  WARNING: SSL certificate validation is disabled for development');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import http from 'http';

import shipmentsRouter from './routes/shipments.js';
import suppliersRouter from './routes/suppliers.js';
import quotesRouter from './routes/quotes.js';
import reportsRouter from './routes/reports.js';
import emailImportRouter from './routes/emailImport.js';
import adminRouter from './routes/admin.js';
import warehouseCapacityRouter from './routes/warehouseCapacity.js';
import authRouter from './routes/auth.js';
import notificationsRouter from './routes/notifications.js';
import schedulerAdminRouter from './routes/schedulerAdmin.js';
import supplierPortalRouter from './routes/supplierPortal.js';
import { helmetConfig, apiRateLimiter, authRateLimiter, authenticateToken } from './middleware/security.js';
import { createSingleFileUpload, createMultipleFileUpload, handleUploadError, validateFilesPresent, verifyUploadPermission, generateSafeFilename } from './middleware/fileUpload.js';
import socketManager from './websocket/socketManager.js';

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP server for Socket.io compatibility
const httpServer = http.createServer(app);

/* ============ CORS - Whitelist allowed origins ============ */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:5173',
  process.env.FRONTEND_URL || 'https://synercore-frontend.vercel.app',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

// Explicitly handle OPTIONS for browsers that need it
app.options('*', cors());

/* ---------------- Security Middleware ---------------- */
// Health check endpoint (before security middleware for Railway)
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', ready: isReady, timestamp: new Date().toISOString() });
});

// Apply helmet security headers
app.use(helmetConfig);

// Apply rate limiting to all API routes
app.use('/api', apiRateLimiter);

/* ---------------- Parsers ---------------- */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* ---------------- Uploads ---------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ---------------- Readiness gate ---------------- */
let isReady = false;
// Only gate /api/* (allow /health, static, etc.)
app.use('/api', (req, res, next) => {
  if (!isReady) return res.status(503).json({ ready: false });
  next();
});

/* ---------------- Routers ---------------- */
// Public routes (no auth required) - with stricter rate limiting for auth endpoints
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/warehouse-capacity', warehouseCapacityRouter); // Has mixed auth requirements

// Protected routes (auth required)
app.use('/api/shipments', authenticateToken, shipmentsRouter);
app.use('/api/suppliers', authenticateToken, suppliersRouter);
app.use('/api/quotes', authenticateToken, quotesRouter);
app.use('/api/reports', authenticateToken, reportsRouter);
app.use('/api/email-import', authenticateToken, emailImportRouter);
app.use('/api/admin', authenticateToken, adminRouter);
app.use('/api/admin/scheduler', schedulerAdminRouter); // Auth required within router
app.use('/api/notifications', notificationsRouter); // Auth required within router
app.use('/api/supplier', supplierPortalRouter); // Supplier portal routes (auth within router)

/* ---------------- Endpoints ---------------- */
// Create upload instances
const multipleFileUpload = createMultipleFileUpload(10);
const singleFileUpload = createSingleFileUpload();

/**
 * POST /api/documents/upload - Upload multiple documents for a supplier
 * Requires: Authenticated user (admin or supplier), supplierId in body
 * Validates: File type, MIME type, file size, permissions
 */
app.post('/api/documents/upload',
  authenticateToken,
  verifyUploadPermission,
  multipleFileUpload.array('documents', 10),
  validateFilesPresent,
  async (req, res, next) => {
    try {
      const { supplierId } = req.body;

      const documentsDir = path.join(__dirname, 'uploads', 'documents', supplierId);
      await fs.mkdir(documentsDir, { recursive: true });

      const uploadedFiles = [];
      for (const file of req.files) {
        const filename = generateSafeFilename(file.originalname);
        await fs.writeFile(path.join(documentsDir, filename), file.buffer);
        uploadedFiles.push({
          filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString(),
          supplierId,
          downloadUrl: `/api/suppliers/${supplierId}/documents/${filename}`,
        });
      }
      res.json(uploadedFiles);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/upload-excel - Upload single Excel file for bulk import
 * Requires: Authenticated user (admin)
 * Validates: File type (Excel only), MIME type, file size
 */
app.post('/api/upload-excel',
  authenticateToken,
  singleFileUpload.single('file'),
  validateFilesPresent,
  (req, res) => {
    try {
      res.json({
        message: 'File uploaded successfully',
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ---------------- Static (prod) ---------------- */
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));
}

/* ---------------- 404 & Error handler ---------------- */
// Upload error handler (must come before generic error handler)
app.use(handleUploadError);

app.use((req, res, _next) => res.status(404).json({ error: 'Not Found', path: req.originalUrl }));

app.use((err, req, res, _next) => {
  console.error('API ERROR:', {
    method: req.method,
    url: req.originalUrl,
    message: err?.message,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });

  if (res.headersSent) return;

  // In production, don't expose error details
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    // In development, include error details for debugging
    res.status(500).json({
      error: 'Internal Server Error',
      detail: err?.message,
      stack: err?.stack
    });
  }
});

/* ---------------- Async boot ---------------- */
async function start() {
  console.log('=====================================');
  console.log('🚀 SERVER STARTING - NEW VERSION');
  console.log('=====================================');
  try {
    // Initialize database connection pool
    const { getPool } = await import('./db/connection.js');
    getPool(); // Force pool creation on startup
    console.log('✓ Database pool initialized');

    // Run database migrations on startup
    try {
      const addAvailableBinsColumn = await import('./db/add-available-bins.js');
      await addAvailableBinsColumn.default();
    } catch (error) {
      console.warn('⚠️  Migration warning:', error.message);
      // Don't fail startup if migration has issues, but log them
    }

    try {
      const addTotalCapacityColumn = await import('./db/add-total-capacity.js');
      await addTotalCapacityColumn.default();
    } catch (error) {
      console.warn('⚠️  Migration warning:', error.message);
      // Don't fail startup if migration has issues, but log them
    }

    try {
      const addRefreshTokensTable = await import('./db/add-refresh-tokens-table.js');
      await addRefreshTokensTable.default();
    } catch (error) {
      console.warn('⚠️  Migration warning:', error.message);
      // Don't fail startup if migration has issues, but log them
    }

    try {
      const addNotificationsTables = await import('./db/add-notifications-tables.js');
      await addNotificationsTables.default();
    } catch (error) {
      console.warn('⚠️  Migration warning:', error.message);
      // Don't fail startup if migration has issues, but log them
    }

    try {
      const addSupplierAccountsTables = await import('./db/add-supplier-accounts.js');
      await addSupplierAccountsTables.default();
    } catch (error) {
      console.warn('⚠️  Migration warning:', error.message);
      // Don't fail startup if migration has issues, but log them
    }

    // Initialize notification scheduler
    try {
      const { default: NotificationScheduler } = await import('./jobs/notificationScheduler.js');
      NotificationScheduler.initializeJobs();
      console.log('✓ Notification scheduler initialized');
    } catch (error) {
      console.warn('⚠️  Notification scheduler warning:', error.message);
      // Don't fail startup if scheduler has issues
    }

    // Initialize Socket.io for real-time updates
    try {
      socketManager.initialize(httpServer);
      console.log('✓ WebSocket (Socket.io) initialized');
    } catch (error) {
      console.warn('⚠️  Socket.io initialization warning:', error.message);
      // Don't fail startup if Socket.io has issues, but log them
    }

    isReady = true; // mark ready once init is done

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (with WebSocket support)`);
    });

    // Optional warm-up so first user hit isn't the initializer:
    // try { await fetch(`http://127.0.0.1:${PORT}/api/shipments`); } catch {}
  } catch (e) {
    console.error('FATAL: failed to start server:', e);
    process.exit(1);
  }
}
start();

export default app;
