import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data file path
const SUPPLIERS_FILE = path.join(__dirname, '../data/suppliers.json');
const DOCUMENTS_DIR = path.join(__dirname, '../uploads/documents');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(path.join(__dirname, '../data'), { recursive: true });
    await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Initialize directories
ensureDirectories();

// Helper function to read suppliers
async function readSuppliers() {
  try {
    const data = await fs.readFile(SUPPLIERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return [];
    }
    throw error;
  }
}

// Helper function to write suppliers
async function writeSuppliers(suppliers) {
  await fs.writeFile(SUPPLIERS_FILE, JSON.stringify(suppliers, null, 2));
}

// GET /api/suppliers - Get all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await readSuppliers();
    res.json(suppliers);
  } catch (error) {
    console.error('Error reading suppliers:', error);
    res.status(500).json({ error: 'Failed to read suppliers' });
  }
});

// GET /api/suppliers/:id - Get specific supplier
router.get('/:id', async (req, res) => {
  try {
    const suppliers = await readSuppliers();
    const supplier = suppliers.find(s => s.id === req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error) {
    console.error('Error reading supplier:', error);
    res.status(500).json({ error: 'Failed to read supplier' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', async (req, res) => {
  try {
    const suppliers = await readSuppliers();
    const newSupplier = {
      id: req.body.id || Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    suppliers.push(newSupplier);
    await writeSuppliers(suppliers);
    
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', async (req, res) => {
  try {
    const suppliers = await readSuppliers();
    const index = suppliers.findIndex(s => s.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    suppliers[index] = {
      ...suppliers[index],
      ...req.body,
      id: req.params.id, // Preserve the ID
      updatedAt: new Date().toISOString()
    };
    
    await writeSuppliers(suppliers);
    res.json(suppliers[index]);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', async (req, res) => {
  try {
    const suppliers = await readSuppliers();
    const index = suppliers.findIndex(s => s.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    suppliers.splice(index, 1);
    await writeSuppliers(suppliers);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// POST /api/suppliers/:id/import - Import schedule for specific supplier
router.post('/:id/import', async (req, res) => {
  try {
    const { scheduleData, documents = [] } = req.body;
    
    if (!scheduleData || !Array.isArray(scheduleData)) {
      return res.status(400).json({ error: 'Invalid schedule data' });
    }
    
    // Get supplier info
    const suppliers = await readSuppliers();
    const supplier = suppliers.find(s => s.id === req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Process and validate schedule data
    const processedSchedule = scheduleData.map((item, index) => ({
      ...item,
      id: item.id || `${supplier.code || supplier.name}-${Date.now()}-${index}`,
      supplier: supplier.name,
      supplierId: supplier.id,
      importedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    // Store document references if any
    const documentRefs = documents.map(doc => ({
      filename: doc.filename,
      originalName: doc.originalName,
      size: doc.size,
      uploadedAt: new Date().toISOString(),
      supplierId: supplier.id
    }));
    
    // Return the processed data (the main app will handle adding to shipments)
    res.json({
      message: `Successfully processed ${processedSchedule.length} items from ${supplier.name}`,
      scheduleData: processedSchedule,
      documents: documentRefs,
      supplier: supplier
    });
    
  } catch (error) {
    console.error('Error importing schedule:', error);
    res.status(500).json({ error: 'Failed to import schedule' });
  }
});

// GET /api/suppliers/:id/documents - Get documents for supplier
router.get('/:id/documents', async (req, res) => {
  try {
    const supplierId = req.params.id;
    
    // Read document metadata (you might want to store this in a separate file)
    // For now, we'll just list files in the supplier's directory
    const supplierDocsDir = path.join(DOCUMENTS_DIR, supplierId);
    
    try {
      const files = await fs.readdir(supplierDocsDir);
      const documentList = await Promise.all(
        files.map(async (filename) => {
          const filePath = path.join(supplierDocsDir, filename);
          const stats = await fs.stat(filePath);
          return {
            filename,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            path: `/api/suppliers/${supplierId}/documents/${encodeURIComponent(filename)}`
          };
        })
      );
      
      res.json(documentList);
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json([]); // No documents directory exists yet
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// GET /api/suppliers/:id/documents/:filename - Download specific document
router.get('/:id/documents/:filename', async (req, res) => {
  try {
    const { id: supplierId, filename } = req.params;
    const filePath = path.join(DOCUMENTS_DIR, supplierId, filename);
    
    try {
      await fs.access(filePath);
      res.download(filePath);
    } catch (error) {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// DELETE /api/suppliers/:id/documents/:filename - Delete specific document
router.delete('/:id/documents/:filename', async (req, res) => {
  try {
    const { id: supplierId, filename } = req.params;
    const filePath = path.join(DOCUMENTS_DIR, supplierId, filename);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Document not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// PUT /api/suppliers/:id/documents/:filename/rename - Rename specific document
router.put('/:id/documents/:filename/rename', async (req, res) => {
  try {
    const { id: supplierId, filename } = req.params;
    const { newName } = req.body;
    
    console.log('Rename request:', { supplierId, filename, newName, body: req.body });
    
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New name is required' });
    }
    
    // Validate filename - check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(newName.trim())) {
      return res.status(400).json({ error: 'Filename contains invalid characters. Cannot use: < > : " / \\ | ? *' });
    }
    
    const supplierDocsDir = path.join(DOCUMENTS_DIR, supplierId);
    const oldFilePath = path.join(supplierDocsDir, filename);
    const newFilePath = path.join(supplierDocsDir, newName.trim());
    
    try {
      // Check if old file exists
      await fs.access(oldFilePath);
      
      // Check if new name already exists
      try {
        await fs.access(newFilePath);
        return res.status(400).json({ error: 'A document with this name already exists' });
      } catch (error) {
        // File doesn't exist, which is what we want
      }
      
      // Rename the file
      await fs.rename(oldFilePath, newFilePath);
      
      res.json({ 
        message: 'Document renamed successfully', 
        filename: newName.trim(),
        oldFilename: filename 
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Document not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error renaming document:', error);
    res.status(500).json({ error: 'Failed to rename document' });
  }
});

export default router;