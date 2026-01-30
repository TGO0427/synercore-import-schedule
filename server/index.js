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
  console.error(error.message);
  // Note: Not calling process.exit(1) immediately - let server start with health endpoint
}

// SSL certificate validation (only disable for local development)
// Railway Postgres connections are handled securely in db/connection.js
if (process.env.NODE_ENV === 'development' && process.env.DISABLE_SSL_VERIFY === 'true') {
  console.warn('⚠️  WARNING: SSL certificate validation is disabled for development');
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
import suppliersRouter from './routes/suppliers.js';
import quotesRouter from './routes/quotes.js';
import reportsRouter from './routes/reports.js';
import emailImportRouter from './routes/emailImport.ts';
import adminRouter from './routes/admin.ts';
import warehouseCapacityRouter from './routes/warehouseCapacity.js';
import authRouter from './routes/auth.js';
import notificationsRouter from './routes/notifications.ts';
import schedulerAdminRouter from './routes/schedulerAdmin.ts';
import supplierPortalRouter from './routes/supplierPortal.ts';
import costingRouter from './routes/costing.ts';

import { helmetConfig, apiRateLimiter, authRateLimiter, authenticateToken } from './middleware/security.js';
import { createSingleFileUpload, createMultipleFileUpload, handleUploadError, validateFilesPresent, verifyUploadPermission, generateSafeFilename } from './middleware/fileUpload.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { logInfo, logServerStart } from './utils/logger.js';
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

console.log('Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS request from unlisted origin: ${origin} - allowing anyway`);
      // Allow anyway to prevent blocking legitimate requests - log for debugging
      callback(null, true);
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
  console.log('=====================================');
  console.log('🚀 SERVER STARTING - NEW VERSION');
  console.log('=====================================');
  try {
    // Start listening IMMEDIATELY for Railway health checks
    // Bind to 0.0.0.0 to accept external connections on Railway
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('✓ Server listening on port', PORT);
      console.log('✓ Environment:', process.env.NODE_ENV || 'production');
      console.log('✓ Initializing database and services in background...');
    });

    // Handle server errors
    httpServer.on('error', (err) => {
      console.error('❌ Server error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
    });

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

    try {
      const addCostingColumns = await import('./db/add-costing-columns.js');
      await addCostingColumns.default();
    } catch (error) {
      console.warn('⚠️  Costing migration warning:', error.message);
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
    console.log('✓ Full initialization complete');
    logInfo('WebSocket support enabled');

    // Optional warm-up so first user hit isn't the initializer:
    // try { await fetch(`http://127.0.0.1:${PORT}/api/shipments`); } catch {}
  } catch (e) {
    console.error('FATAL: failed to initialize:', e);
    console.error('Stack trace:', e.stack);
    // Server is already listening from above, just mark as ready with degraded functionality
    isReady = true;
    console.log('⚠️  Server running with degraded functionality');
  }
}
start().catch(e => {
  console.error('FATAL: start() promise rejected:', e);
  console.error('Stack trace:', e.stack);
  // Server should already be listening, just ensure isReady is set
  isReady = true;
  console.log('⚠️  Server in emergency mode');
});

export default app;
