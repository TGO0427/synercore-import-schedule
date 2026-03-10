// server/index.js
import dotenv from 'dotenv';

// Load environment variables from .env file (only if DATABASE_URL not already provided)
// Railway automatically sets DATABASE_URL, so we skip .env in production
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

// Initialize Sentry early for error tracking
import { initializeSentry, getSentryRequestHandler, getSentryErrorHandler } from './config/sentry.js';
initializeSentry();

// Validate environment variables early
import { validateEnvironment, logEnvironmentInfo } from './utils/envValidator.ts';
try {
  validateEnvironment();
} catch (error) {
  logError('Environment validation failed', error);
  // Note: Not calling process.exit(1) immediately - let server start with health endpoint
}

// SSL certificate validation (only disable for local development)
// Railway Postgres connections are handled securely in db/connection.js
if (process.env.NODE_ENV === 'development' && process.env.DISABLE_SSL_VERIFY === 'true') {
  logWarn('SSL certificate validation is disabled for development');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

import shipmentsRouter from './routes/shipments.ts';
import suppliersRouter from './routes/suppliers.ts';
import quotesRouter from './routes/quotes.ts';
import reportsRouter from './routes/reports.ts';
import emailImportRouter from './routes/emailImport.ts';
import adminRouter from './routes/admin.ts';
import warehouseCapacityRouter from './routes/warehouseCapacity.ts';
import authRouter from './routes/auth.ts';
import notificationsRouter from './routes/notifications.ts';
import schedulerAdminRouter from './routes/schedulerAdmin.ts';
import supplierPortalRouter from './routes/supplierPortal.ts';
import costingRouter from './routes/costing.ts';
import costingRequestsRouter from './routes/costingRequests.ts';
import auditRouter from './routes/audit.ts';
import newsRouter from './routes/news.ts';
import bolAuditRouter from './routes/bolAudit.ts';

import { helmetConfig, apiRateLimiter, authRateLimiter, createRateLimiter, authenticateToken } from './middleware/security.js';
import { csrfProtection } from './middleware/csrf.js';
import { createSingleFileUpload, createMultipleFileUpload, handleUploadError, validateFilesPresent, verifyUploadPermission, generateSafeFilename } from './middleware/fileUpload.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { logger, logInfo, logWarn, logError, logServerStart } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.ts';
import socketManager from './websocket/socketManager.ts';

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
  'https://synercore-import-schedule.vercel.app',
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
].filter(Boolean); // Remove any undefined/null values

logger.info('CORS origins configured', { origins: allowedOrigins });

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logWarn('CORS request blocked from unlisted origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Explicitly handle OPTIONS for browsers that need it
app.options('*', cors(corsOptions));

// Swagger UI - Available for documentation at /api-docs
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    url: '/api-docs/swagger.json'
  }
}));

// Swagger JSON endpoint
app.get('/api-docs/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/* ---------------- Security Middleware & Health Check ---------------- */
// Health check endpoint (before security middleware for Railway)
// Always returns 200 for Railway health checks (even if not fully ready)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', ready: isReady, timestamp: new Date().toISOString() });
});

// Add request ID middleware early (for all requests)
app.use(requestIdMiddleware);

// Add Sentry request handler for error tracking (after requestIdMiddleware, before other middleware)
app.use(getSentryRequestHandler());

// Apply helmet security headers
app.use(helmetConfig);

// Apply rate limiting to all API routes
app.use('/api', apiRateLimiter);

// CSRF protection — require Authorization or X-Requested-With on state-changing requests
app.use('/api', csrfProtection);

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
app.use('/api/costing', costingRouter); // Import costing routes (auth within router)
app.use('/api/costing-requests', costingRequestsRouter); // Costing request routes (auth within router)
app.use('/api/audit', authenticateToken, auditRouter);
app.use('/api/bol-audit', authenticateToken, bolAuditRouter);
app.use('/api/news', newsRouter); // Public - freight news feed proxy

/* ---------------- Endpoints ---------------- */
// Create upload instances
const multipleFileUpload = createMultipleFileUpload(10);
const singleFileUpload = createSingleFileUpload();
const uploadRateLimiter = createRateLimiter(60 * 60 * 1000, 50); // 50 uploads per hour per IP

/**
 * POST /api/documents/upload - Upload multiple documents for a supplier
 * Requires: Authenticated user (admin or supplier), supplierId in body
 * Validates: File type, MIME type, file size, permissions
 */
app.post('/api/documents/upload',
  uploadRateLimiter,
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
  uploadRateLimiter,
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

// 404 handler (before error handler)
app.use((req, res, _next) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// Sentry error handler (must be before custom error handler)
app.use(getSentryErrorHandler());

// Centralized error handler (must be last)
app.use(errorHandler);

/* ---------------- Async boot ---------------- */
async function start() {
  logger.info('Server starting', { version: 'latest' });
  try {
    // Start listening IMMEDIATELY for Railway health checks
    // Bind to 0.0.0.0 to accept external connections on Railway
    httpServer.listen(PORT, '0.0.0.0', () => {
      logServerStart(PORT, process.env.NODE_ENV || 'production');
      logger.info('Initializing database and services in background...');
    });

    // Handle server errors
    httpServer.on('error', (err) => {
      logError('Server error', err, { code: err.code });
      if (err.code === 'EADDRINUSE') {
        logError('Port already in use', null, { port: PORT });
      }
    });

    // Initialize database connection pool
    const { getPool } = await import('./db/connection.js');
    getPool(); // Force pool creation on startup
    logger.info('Database pool initialized');

    // Run database migrations on startup
    try {
      const addAvailableBinsColumn = await import('./db/add-available-bins.js');
      await addAvailableBinsColumn.default();
    } catch (error) {
      logWarn('Migration warning', { error: error.message });
    }

    try {
      const addTotalCapacityColumn = await import('./db/add-total-capacity.js');
      await addTotalCapacityColumn.default();
    } catch (error) {
      logWarn('Migration warning', { error: error.message });
    }

    try {
      const addRefreshTokensTable = await import('./db/add-refresh-tokens-table.js');
      await addRefreshTokensTable.default();
    } catch (error) {
      logWarn('Migration warning', { error: error.message });
    }

    try {
      const addNotificationsTables = await import('./db/add-notifications-tables.js');
      await addNotificationsTables.default();
    } catch (error) {
      logWarn('Migration warning', { error: error.message });
    }

    try {
      const addSupplierAccountsTables = await import('./db/add-supplier-accounts.js');
      await addSupplierAccountsTables.default();
    } catch (error) {
      logWarn('Migration warning', { error: error.message });
    }

    try {
      const addCostingColumns = await import('./db/add-costing-columns.js');
      await addCostingColumns.default();
    } catch (error) {
      logWarn('Costing migration warning', { error: error.message });
    }

    try {
      const addCostingRequestsTable = await import('./db/add-costing-requests-table.js');
      await addCostingRequestsTable.default();
    } catch (error) {
      logWarn('Costing requests migration warning', { error: error.message });
    }

    try {
      const { addPerformanceIndexes } = await import('./db/add-performance-indexes.js');
      await addPerformanceIndexes();
    } catch (error) {
      logWarn('Performance indexes warning', { error: error.message });
    }

    // Add reminder columns to shipments
    try {
      await getPool().query(`
        ALTER TABLE shipments ADD COLUMN IF NOT EXISTS reminder_date DATE;
        ALTER TABLE shipments ADD COLUMN IF NOT EXISTS reminder_note TEXT;
        CREATE INDEX IF NOT EXISTS idx_shipments_reminder_date ON shipments(reminder_date) WHERE reminder_date IS NOT NULL;
      `);
      logger.info('Reminder columns ready');
    } catch (error) {
      logWarn('Reminder columns migration warning', { error: error.message });
    }

    // Create announcements table if it doesn't exist
    try {
      const { getPool } = await import('./db/connection.js');
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          link TEXT,
          active BOOLEAN DEFAULT true,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active) WHERE active = true;
        CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);
        ALTER TABLE announcements ADD COLUMN IF NOT EXISTS description TEXT;
      `);
      logger.info('Announcements table ready');
    } catch (error) {
      logWarn('Announcements table warning', { error: error.message });
    }

    // Create audit_log table if it doesn't exist
    try {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          username VARCHAR(255) NOT NULL,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id TEXT NOT NULL,
          entity_label TEXT,
          changes JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
        CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id ON audit_log(entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
        ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
      `);
      logger.info('Audit log table ready');
    } catch (error) {
      logWarn('Audit log table warning', { error: error.message });
    }

    // Create costing_requests table if it doesn't exist
    try {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS costing_requests (
          id SERIAL PRIMARY KEY,
          requested_by TEXT NOT NULL,
          requested_by_username VARCHAR(255) NOT NULL,
          supplier_name VARCHAR(255),
          product_description TEXT,
          priority VARCHAR(20) DEFAULT 'normal',
          notes TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          admin_notes TEXT,
          handled_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_costing_requests_status ON costing_requests(status);
        CREATE INDEX IF NOT EXISTS idx_costing_requests_user ON costing_requests(requested_by);
        CREATE INDEX IF NOT EXISTS idx_costing_requests_created ON costing_requests(created_at);
      `);
      logger.info('Costing requests table ready');
    } catch (error) {
      logWarn('Costing requests table warning', { error: error.message });
    }

    // Create bol_audits table for Bill of Lading auditing
    try {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS bol_audits (
          id SERIAL PRIMARY KEY,
          bol_number VARCHAR(100) NOT NULL,
          shipment_id TEXT REFERENCES shipments(id) ON DELETE SET NULL,
          supplier_name VARCHAR(255),
          carrier_name VARCHAR(255),
          vessel_name VARCHAR(255),
          voyage_number VARCHAR(100),
          port_of_loading VARCHAR(255),
          port_of_discharge VARCHAR(255),
          consignee TEXT,
          shipper TEXT,
          notify_party TEXT,
          description_of_goods TEXT,
          container_numbers JSONB,
          gross_weight_kg NUMERIC(12,3),
          volume_cbm NUMERIC(10,3),
          number_of_packages INTEGER,
          freight_charges_usd NUMERIC(14,2),
          declared_value_usd NUMERIC(14,2),
          issue_date DATE,
          ship_on_board_date DATE,
          payment_terms VARCHAR(20),
          incoterm VARCHAR(10),
          notes TEXT,
          audit_status VARCHAR(20) DEFAULT 'pending',
          audit_notes TEXT,
          discrepancies JSONB,
          weight_verified BOOLEAN DEFAULT false,
          charges_verified BOOLEAN DEFAULT false,
          documents_verified BOOLEAN DEFAULT false,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          audited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          audited_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_bol_audits_status ON bol_audits(audit_status);
        CREATE INDEX IF NOT EXISTS idx_bol_audits_bol_number ON bol_audits(bol_number);
        CREATE INDEX IF NOT EXISTS idx_bol_audits_supplier ON bol_audits(supplier_name);
        CREATE INDEX IF NOT EXISTS idx_bol_audits_shipment ON bol_audits(shipment_id);
        CREATE INDEX IF NOT EXISTS idx_bol_audits_created ON bol_audits(created_at);

        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS raw_pdf_text TEXT;
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS extraction_confidence JSONB;
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255);
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS benchmark_rate_per_kg NUMERIC(10,4);
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS expected_freight_usd NUMERIC(14,2);
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS freight_variance_usd NUMERIC(14,2);
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS weight_variance_kg NUMERIC(12,3);
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS weight_variance_pct NUMERIC(8,2);
        ALTER TABLE bol_audits ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
      `);
      logger.info('BOL audits table ready');
    } catch (error) {
      logWarn('BOL audits table warning', { error: error.message });
    }

    // Create freight_benchmarks table for contracted rate comparison
    try {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS freight_benchmarks (
          id SERIAL PRIMARY KEY,
          carrier_name VARCHAR(255),
          port_of_loading VARCHAR(255) NOT NULL,
          port_of_discharge VARCHAR(255) NOT NULL,
          rate_per_kg_usd NUMERIC(10,4),
          rate_per_cbm_usd NUMERIC(10,2),
          min_charge_usd NUMERIC(12,2),
          full_rate_usd NUMERIC(12,2),
          rate_20fcl_usd NUMERIC(12,2),
          rate_40fcl_usd NUMERIC(12,2),
          currency VARCHAR(10) DEFAULT 'USD',
          transport_mode VARCHAR(20) DEFAULT 'sea',
          valid_from DATE,
          valid_until DATE,
          notes TEXT,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_freight_benchmarks_route ON freight_benchmarks(port_of_loading, port_of_discharge);
        CREATE INDEX IF NOT EXISTS idx_freight_benchmarks_carrier ON freight_benchmarks(carrier_name);
        ALTER TABLE freight_benchmarks ADD COLUMN IF NOT EXISTS full_rate_usd NUMERIC(12,2);
        ALTER TABLE freight_benchmarks ADD COLUMN IF NOT EXISTS rate_20fcl_usd NUMERIC(12,2);
        ALTER TABLE freight_benchmarks ADD COLUMN IF NOT EXISTS rate_40fcl_usd NUMERIC(12,2);
        ALTER TABLE freight_benchmarks ADD COLUMN IF NOT EXISTS rate_20gp_usd NUMERIC(12,2);
        ALTER TABLE freight_benchmarks ADD COLUMN IF NOT EXISTS rate_40gp_usd NUMERIC(12,2);
        ALTER TABLE freight_benchmarks ADD COLUMN IF NOT EXISTS rate_40hc_usd NUMERIC(12,2);
      `);
      logger.info('Freight benchmarks table ready');
    } catch (error) {
      logWarn('Freight benchmarks table warning', { error: error.message });
    }

    // Initialize notification scheduler
    try {
      const { default: NotificationScheduler } = await import('./jobs/notificationScheduler.js');
      NotificationScheduler.initializeJobs();
      logger.info('Notification scheduler initialized');
    } catch (error) {
      logWarn('Notification scheduler warning', { error: error.message });
    }

    // Initialize Socket.io for real-time updates
    try {
      socketManager.initialize(httpServer);
      logger.info('WebSocket (Socket.io) initialized');
    } catch (error) {
      logWarn('Socket.io initialization warning', { error: error.message });
    }

    isReady = true; // mark ready once init is done
    logger.info('Full initialization complete');

    // Optional warm-up so first user hit isn't the initializer:
    // try { await fetch(`http://127.0.0.1:${PORT}/api/shipments`); } catch {}
  } catch (e) {
    logError('FATAL: failed to initialize', e);
    // Server is already listening from above, just mark as ready with degraded functionality
    isReady = true;
    logWarn('Server running with degraded functionality');
  }
}
start().catch(e => {
  logError('FATAL: start() promise rejected', e);
  // Server should already be listening, just ensure isReady is set
  isReady = true;
  logWarn('Server in emergency mode');
});

export default app;
