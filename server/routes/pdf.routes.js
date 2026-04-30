import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../db/connection.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================
// PDF Cache Configuration
// ============================
const CACHE_DIR = path.join(__dirname, '../pdf-cache');
const DEFAULT_PDF_NAME = 'Cost-Summary.pdf';

// ============================
// Helpers
// ============================
async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function generatePdfFromHtml(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
}

// ✅ ESTIMATE lookup (correct domain)
async function getEstimateByReference(referenceNumber) {
  const { rows } = await getPool().query(
    `
    SELECT
      reference_number,
      supplier
    FROM cost_estimates
    WHERE TRIM(reference_number) ILIKE TRIM($1)
    `,
    [referenceNumber]
  );

  return rows[0];
}

// ============================
// DEFAULT COST SUMMARY (legacy / optional)
// GET /api/pdf/cost-summary
// ============================
router.get('/cost-summary', async (_req, res) => {
  try {
    await ensureCacheDir();

    const pdfPath = path.join(CACHE_DIR, DEFAULT_PDF_NAME);

    try {
      const cachedPdf = await fs.readFile(pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Cost-Summary.pdf"'
      );
      res.setHeader('Content-Length', cachedPdf.length);
      return res.end(cachedPdf);
    } catch {}

    const htmlPath = path.join(
      __dirname,
      '../../cost-summary/index.html'
    );
    const html = await fs.readFile(htmlPath, 'utf8');

    const pdfBuffer = await generatePdfFromHtml(html);
    await fs.writeFile(pdfPath, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Cost-Summary.pdf"'
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Default PDF generation failed:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
    });
  }
});

// ============================
// ✅ COST ESTIMATE PDF (MAIN ENDPOINT)
// GET /api/pdf/cost-estimate/:estimateRef
// ============================
router.get('/cost-estimate/:estimateRef', async (req, res) => {
  const { estimateRef } = req.params;

  try {
    await ensureCacheDir();

    const pdfFileName = `estimate-${estimateRef}.pdf`;
    const pdfPath = path.join(CACHE_DIR, pdfFileName);

    // ✅ Serve cached PDF if exists
    try {
      const cachedPdf = await fs.readFile(pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${pdfFileName}"`
      );
      res.setHeader('Content-Length', cachedPdf.length);
      return res.end(cachedPdf);
    } catch {}

    // ✅ Load estimate from DB
    const estimate = await getEstimateByReference(estimateRef);

    if (!estimate) {
      return res.status(404).json({
        error: 'Estimate not found',
        estimate_ref: estimateRef,
      });
    }

    // ✅ Load HTML template
    const htmlPath = path.join(
      __dirname,
      '../../cost-summary/index.html'
    );
    let html = await fs.readFile(htmlPath, 'utf8');

    // ✅ Inject estimate data (matches template)
    html = html
      .replace('{{SHIPMENT_REF}}', estimate.reference_number)
      .replace('{{SUPPLIER}}', estimate.supplier);

    const pdfBuffer = await generatePdfFromHtml(html);
    await fs.writeFile(pdfPath, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdfFileName}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Estimate PDF generation failed:', error);
    res.status(500).json({
      error: 'Estimate PDF generation failed',
      message: error.message,
    });
  }
});

export default router;
