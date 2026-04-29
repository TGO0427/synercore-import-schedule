import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where cached PDFs live
const CACHE_DIR = path.join(__dirname, '../pdf-cache');
const PDF_NAME = 'Cost-Summary.pdf';
const PDF_PATH = path.join(CACHE_DIR, PDF_NAME);

router.get('/cost-summary', async (_req, res) => {
  try {
    // ✅ Ensure cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    // ✅ If PDF already exists, serve it immediately
    try {
      const cachedPdf = await fs.readFile(PDF_PATH);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Cost-Summary.pdf"'
      );
      res.setHeader('Content-Length', cachedPdf.length);
      return res.end(cachedPdf);
    } catch {
      // File doesn’t exist yet → generate it
    }

    // ✅ Load HTML template
    const htmlPath = path.join(
      __dirname,
      '../../cost-summary/index.html'
    );
    const html = await fs.readFile(htmlPath, 'utf8');

    // ✅ Generate PDF
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

    // ✅ Cache the PDF
    await fs.writeFile(PDF_PATH, pdfBuffer);

    // ✅ Serve it
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Cost-Summary.pdf"'
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
    });
  }
});

export default router;
``