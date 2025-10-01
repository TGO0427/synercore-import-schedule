// server/index.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

import shipmentsRouter from './routes/shipments.js';
import suppliersRouter from './routes/suppliers.js';
import quotesRouter from './routes/quotes.js';
import reportsRouter from './routes/reports.js';
import emailImportRouter from './routes/emailImport.js';
import adminRouter from './routes/admin.js';

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

/* ---------------- CORS ---------------- */
const allowedOrigins = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://172.20.18.135:3002',
  'https://f5797077a9ef.ngrok-free.app',
  'https://synercore-import-schedule.vercel.app',
  'https://synercore-import-schedule-*.vercel.app', // Preview deployments
];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);

    // Check exact matches
    if (allowedOrigins.includes(origin)) return cb(null, true);

    // Check Vercel preview deployments
    if (origin.match(/^https:\/\/synercore-import-schedule.*\.vercel\.app$/)) {
      return cb(null, true);
    }

    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

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
app.use('/api/shipments', shipmentsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/email-import', emailImportRouter);
app.use('/api/admin', adminRouter);

/* ---------------- Endpoints ---------------- */
app.post('/api/documents/upload', upload.array('documents', 10), async (req, res, next) => {
  try {
    const { supplierId } = req.body;
    if (!supplierId) return res.status(400).json({ error: 'Supplier ID is required' });
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

    const documentsDir = path.join(__dirname, 'uploads', 'documents', supplierId);
    await fs.mkdir(documentsDir, { recursive: true });

    const uploadedFiles = [];
    for (const file of req.files) {
      const filename = `${Date.now()}_${file.originalname}`;
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
});

app.post('/api/upload-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ message: 'File uploaded successfully', filename: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', ready: isReady, timestamp: new Date().toISOString() });
});

/* ---------------- Static (prod) ---------------- */
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));
}

/* ---------------- 404 & Error handler ---------------- */
app.use((req, res, _next) => res.status(404).json({ error: 'Not Found', path: req.originalUrl }));

app.use((err, req, res, _next) => {
  console.error('API ERROR:', {
    method: req.method,
    url: req.originalUrl,
    message: err?.message,
    stack: err?.stack,
  });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal Server Error', detail: err?.message });
});

/* ---------------- Async boot ---------------- */
async function start() {
  try {
    // Do all async init here (DB connections, loading files, migrations, etc.)
    // await db.connect();
    // await loadInitialData();

    isReady = true; // mark ready once init is done

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
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
