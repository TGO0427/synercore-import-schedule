import path from "path";
import fs from "fs";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";

// Needed to replicate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateCostSummaryPDF() {
  const htmlPath = path.resolve(
    __dirname,
    "../cost-summary/index.html"
  );

  const outputDir = path.resolve(__dirname, "dist");

  const outputFile = path.join(
    outputDir,
    `Cost-Summary-${new Date().toISOString().slice(0, 10)}.pdf`
  );

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  await page.goto(`file://${htmlPath}`, {
    waitUntil: "networkidle0"
  });

  await page.pdf({
    path: outputFile,
    format: "A4",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });

  await browser.close();

  console.log("✅ PDF generated:", outputFile);
}

generateCostSummaryPDF().catch(console.error);