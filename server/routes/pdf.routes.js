import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/cost-summary', async (_req, res) => {
  try {
    const htmlPath = path.resolve(
      __dirname,
      '../../cost-summary/index.html'
    );

    const html = await fs.readFile(htmlPath, 'utf-8');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename=Cost-Summary.pdf'
    );

    res.send(pdf);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
    });
  }
});

export default router;