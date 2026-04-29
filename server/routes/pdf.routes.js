import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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

// ============================
// DEFAULT COST SUMMARY
// GET /api/pdf/cost-summary
// ============================
router.get('/cost-summary', async (_req, res) => {
  try {
    await ensureCacheDir();

    const pdfPath = path.join(CACHE_DIR, DEFAULT_PDF_NAME);

    // ✅ Serve cached PDF if exists
    try {
      const cachedPdf = await fs.readFile(pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Cost-Summary.pdf"'
      );
      res.setHeader('Content-Length', cachedPdf.length);
      return res.end(cachedPdf);
    } catch {
      // Not cached yet → generate
    }

    // ✅ Load HTML template
    const htmlPath = path.join(
      __dirname,
      '../../cost-summary/index.html'
    );
    const html = await fs.readFile(htmlPath, 'utf8');

    const pdfBuffer = await generatePdfFromHtml(html);

    // ✅ Cache PDF
    await fs.writeFile(pdfPath, pdfBuffer);

    // ✅ Serve PDF
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
// PER‑SHIPMENT COST SUMMARY
// GET /api/pdf/cost-summary/:shipmentId
// ============================
router.get('/cost-summary/:shipmentId', async (req, res) => {
  const { shipmentId } = req.params;

  try {
    await ensureCacheDir();

    const pdfFileName = `${shipmentId}.pdf`;
    const pdfPath = path.join(CACHE_DIR, pdfFileName);

    // ✅ Serve cached shipment PDF if exists
    try {
      const cachedPdf = await fs.readFile(pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${pdfFileName}"`
      );
      res.setHeader('Content-Length', cachedPdf.length);
      return res.end(cachedPdf);
    } catch {
      // Not cached yet → generate
    }

    // ✅ Load HTML template
    const htmlPath = path.join(
      __dirname,
      '../../cost-summary/index.html'
    );
    let html = await fs.readFile(htmlPath, 'utf8');

    // ✅ Inject shipment reference (simple placeholder for now)
    html = html.replace('{{SHIPMENT_ID}}', shipmentId);

    const pdfBuffer = await generatePdfFromHtml(html);

    // ✅ Cache PDF
    await fs.writeFile(pdfPath, pdfBuffer);

    // ✅ Serve PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdfFileName}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Per‑shipment PDF generation failed:', error);
    res.status(500).json({
      error: 'Per‑shipment PDF generation failed',
      shipmentId,
      message: error.message,
    });
  }
});

export default router;