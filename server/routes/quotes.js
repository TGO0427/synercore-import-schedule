import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import PDFAnalyzer from '../services/pdfAnalyzer.js';
import { ALLOWED_FILE_TYPES, generateSafeFilename } from '../middleware/fileUpload.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for quotes storage
const QUOTES_DIR = path.join(__dirname, '../uploads/quotes');

// Supported forwarders
const FORWARDERS = ['dhl', 'dsv', 'afrigistics'];

// Initialize PDF analyzer
const pdfAnalyzer = new PDFAnalyzer();

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(QUOTES_DIR, { recursive: true });
    for (const forwarder of FORWARDERS) {
      await fs.mkdir(path.join(QUOTES_DIR, forwarder), { recursive: true });
    }
  } catch (error) {
    console.error('Error creating quotes directories:', error);
  }
}

// Initialize directories
ensureDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const forwarder = req.params.forwarder;
    if (!FORWARDERS.includes(forwarder)) {
      return cb(new Error('Invalid forwarder'));
    }
    cb(null, path.join(QUOTES_DIR, forwarder));
  },
  filename: (req, file, cb) => {
    // Preserve original filename with timestamp prefix to avoid conflicts
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${originalName}`);
  }
});

// Enhanced file filter using centralized validation
const fileFilter = (req, file, cb) => {
  // Get allowed MIME types for documents (PDF, Excel, Word)
  const allowedMimes = [
    ...ALLOWED_FILE_TYPES.pdf.mimes,
    ...ALLOWED_FILE_TYPES.excel.mimes,
    ...ALLOWED_FILE_TYPES.word.mimes
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    const error = new Error(
      `Invalid file type: ${file.mimetype}. Allowed types: PDF, Excel, Word`
    );
    error.code = 'INVALID_MIME_TYPE';
    return cb(error, false);
  }

  // Validate extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    ...ALLOWED_FILE_TYPES.pdf.extensions,
    ...ALLOWED_FILE_TYPES.excel.extensions,
    ...ALLOWED_FILE_TYPES.word.extensions
  ];

  if (!allowedExtensions.includes(ext)) {
    const error = new Error(
      `Invalid file extension: ${ext}. Allowed: ${allowedExtensions.join(', ')}`
    );
    error.code = 'INVALID_EXTENSION';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter
});

// GET /api/quotes/:forwarder - Get all quotes for a forwarder
router.get('/:forwarder', async (req, res) => {
  try {
    const { forwarder } = req.params;
    
    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }
    
    const forwarderDir = path.join(QUOTES_DIR, forwarder);
    
    try {
      const files = await fs.readdir(forwarderDir);
      const quotes = await Promise.all(
        files.map(async (filename) => {
          const filePath = path.join(forwarderDir, filename);
          const stats = await fs.stat(filePath);
          return {
            filename,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            path: `/api/quotes/${forwarder}/${encodeURIComponent(filename)}`
          };
        })
      );
      
      // Sort by upload date (newest first)
      quotes.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      
      res.json(quotes);
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json([]); // Directory doesn't exist yet
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error listing quotes:', error);
    res.status(500).json({ error: 'Failed to list quotes' });
  }
});

// POST /api/quotes/:forwarder/upload - Upload quotes for a forwarder
router.post('/:forwarder/upload', upload.array('documents', 10), async (req, res) => {
  try {
    const { forwarder } = req.params;
    
    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      path: `/api/quotes/${forwarder}/${encodeURIComponent(file.filename)}`
    }));
    
    res.json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s) to ${forwarder}`,
      files: uploadedFiles
    });
    
  } catch (error) {
    console.error('Error uploading quotes:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path).catch(console.error);
      });
    }
    
    res.status(500).json({ error: 'Failed to upload quotes' });
  }
});

// GET /api/quotes/:forwarder/:filename - Download specific quote
router.get('/:forwarder/:filename', async (req, res) => {
  try {
    const { forwarder, filename } = req.params;
    
    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }
    
    const filePath = path.join(QUOTES_DIR, forwarder, filename);
    
    try {
      await fs.access(filePath);
      res.download(filePath);
    } catch (error) {
      res.status(404).json({ error: 'Quote not found' });
    }
  } catch (error) {
    console.error('Error downloading quote:', error);
    res.status(500).json({ error: 'Failed to download quote' });
  }
});

// DELETE /api/quotes/:forwarder/:filename - Delete specific quote
router.delete('/:forwarder/:filename', async (req, res) => {
  try {
    const { forwarder, filename } = req.params;
    
    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }
    
    const filePath = path.join(QUOTES_DIR, forwarder, filename);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      res.json({ message: 'Quote deleted successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Quote not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// PUT /api/quotes/:forwarder/:filename/rename - Rename specific quote
router.put('/:forwarder/:filename/rename', async (req, res) => {
  try {
    const { forwarder, filename } = req.params;
    const { newName } = req.body;
    
    console.log('Rename quote request:', { forwarder, filename, newName, body: req.body });
    
    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }
    
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New name is required' });
    }
    
    // Validate filename - check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(newName.trim())) {
      return res.status(400).json({ error: 'Filename contains invalid characters. Cannot use: < > : " / \\ | ? *' });
    }
    
    const forwarderDir = path.join(QUOTES_DIR, forwarder);
    const oldFilePath = path.join(forwarderDir, filename);
    const newFilePath = path.join(forwarderDir, newName.trim());
    
    try {
      // Check if old file exists
      await fs.access(oldFilePath);
      
      // Check if new name already exists
      try {
        await fs.access(newFilePath);
        return res.status(400).json({ error: 'A quote with this name already exists' });
      } catch (error) {
        // File doesn't exist, which is what we want
      }
      
      // Rename the file
      await fs.rename(oldFilePath, newFilePath);
      
      res.json({ 
        message: 'Quote renamed successfully', 
        filename: newName.trim(),
        oldFilename: filename 
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Quote not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error renaming quote:', error);
    res.status(500).json({ error: 'Failed to rename quote' });
  }
});

// GET /api/quotes - Get summary of all quotes by forwarder
router.get('/', async (req, res) => {
  try {
    const summary = {};
    
    for (const forwarder of FORWARDERS) {
      try {
        const forwarderDir = path.join(QUOTES_DIR, forwarder);
        const files = await fs.readdir(forwarderDir);
        summary[forwarder] = {
          count: files.length,
          forwarder: forwarder.charAt(0).toUpperCase() + forwarder.slice(1)
        };
      } catch (error) {
        summary[forwarder] = {
          count: 0,
          forwarder: forwarder.charAt(0).toUpperCase() + forwarder.slice(1)
        };
      }
    }
    
    res.json(summary);
  } catch (error) {
    console.error('Error getting quotes summary:', error);
    res.status(500).json({ error: 'Failed to get quotes summary' });
  }
});

// POST /api/quotes/:forwarder/:filename/analyze - Analyze specific PDF quote
router.post('/:forwarder/:filename/analyze', async (req, res) => {
  try {
    const { forwarder, filename } = req.params;

    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }

    const filePath = path.join(QUOTES_DIR, forwarder, filename);

    try {
      await fs.access(filePath);

      // Only analyze PDF files
      if (!filename.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'File must be a PDF for analysis' });
      }

      console.log(`🔬 Starting PDF analysis for: ${filename}`);
      const analysis = await pdfAnalyzer.analyzePDFQuote(filePath);

      res.json({
        success: true,
        filename,
        forwarder,
        analysis
      });

    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Quote not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error analyzing PDF quote:', error);
    res.status(500).json({ error: 'Failed to analyze PDF quote', details: error.message });
  }
});

// POST /api/quotes/compare - Generate comparison report for selected quotes
router.post('/compare', async (req, res) => {
  try {
    const { quotes } = req.body;

    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of quotes to compare' });
    }

    console.log(`📊 Starting comparison analysis for ${quotes.length} quotes...`);

    const analyses = [];

    for (const quote of quotes) {
      const { forwarder, filename } = quote;

      if (!FORWARDERS.includes(forwarder)) {
        console.warn(`Skipping invalid forwarder: ${forwarder}`);
        continue;
      }

      const filePath = path.join(QUOTES_DIR, forwarder, filename);

      try {
        await fs.access(filePath);

        // Only analyze PDF files
        if (filename.toLowerCase().endsWith('.pdf')) {
          const analysis = await pdfAnalyzer.analyzePDFQuote(filePath);
          analysis.forwarder = forwarder;
          analyses.push(analysis);
        } else {
          console.warn(`Skipping non-PDF file: ${filename}`);
        }

      } catch (error) {
        console.warn(`Quote not found: ${forwarder}/${filename}`);
      }
    }

    if (analyses.length === 0) {
      return res.status(400).json({
        error: 'No valid PDF quotes found for comparison'
      });
    }

    console.log(`📊 Analyzing ${analyses.length} valid quotes...`);
    const comparisonReport = pdfAnalyzer.generateComparisonReport(analyses);

    res.json({
      success: true,
      report: comparisonReport
    });

  } catch (error) {
    console.error('Error generating comparison report:', error);
    res.status(500).json({
      error: 'Failed to generate comparison report',
      details: error.message
    });
  }
});

// GET /api/quotes/:forwarder/analyze-all - Analyze all PDF quotes for a forwarder
router.get('/:forwarder/analyze-all', async (req, res) => {
  try {
    const { forwarder } = req.params;

    if (!FORWARDERS.includes(forwarder)) {
      return res.status(400).json({ error: 'Invalid forwarder' });
    }

    const forwarderDir = path.join(QUOTES_DIR, forwarder);

    try {
      const files = await fs.readdir(forwarderDir);
      const pdfFiles = files.filter(filename => filename.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        return res.json({
          success: true,
          message: 'No PDF files found for analysis',
          analyses: []
        });
      }

      console.log(`🔬 Analyzing ${pdfFiles.length} PDF files for ${forwarder}...`);

      const analyses = [];

      for (const filename of pdfFiles) {
        try {
          const filePath = path.join(forwarderDir, filename);
          const analysis = await pdfAnalyzer.analyzePDFQuote(filePath);
          analysis.forwarder = forwarder;
          analyses.push({
            filename,
            analysis
          });
        } catch (error) {
          console.error(`Error analyzing ${filename}:`, error);
          analyses.push({
            filename,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        forwarder,
        totalFiles: pdfFiles.length,
        analyses
      });

    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          message: 'No quotes directory found',
          analyses: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error analyzing all quotes:', error);
    res.status(500).json({
      error: 'Failed to analyze quotes',
      details: error.message
    });
  }
});

export default router;