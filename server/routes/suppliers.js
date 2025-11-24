import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/connection.js';
import { validateSupplierCreate, validateSupplierUpdate, validateId, validate } from '../middleware/validation.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCUMENTS_DIR = path.join(__dirname, '../uploads/documents');

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Initialize directories
ensureDirectories();

// Helper to convert DB row to camelCase
function dbRowToSupplier(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    country: row.country,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/suppliers - Get all suppliers
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers ORDER BY name');
    res.json(result.rows.map(dbRowToSupplier));
  } catch (error) {
    console.error('Error reading suppliers:', error);
    res.status(500).json({ error: 'Failed to read suppliers' });
  }
});

// GET /api/suppliers/:id - Get specific supplier
router.get('/:id', validateId, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(dbRowToSupplier(result.rows[0]));
  } catch (error) {
    console.error('Error reading supplier:', error);
    res.status(500).json({ error: 'Failed to read supplier' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', validateSupplierCreate, async (req, res) => {
  try {
    const id = req.body.id || Date.now().toString();

    await db.query(
      `INSERT INTO suppliers (id, name, contact_person, email, phone, address, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        req.body.name,
        req.body.contactPerson || null,
        req.body.email || null,
        req.body.phone || null,
        req.body.address || null,
        req.body.country || null,
        req.body.notes || null
      ]
    );

    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    res.status(201).json(dbRowToSupplier(result.rows[0]));
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', validateSupplierUpdate, async (req, res) => {
  try {
    await db.query(
      `UPDATE suppliers SET
        name = COALESCE($1, name),
        contact_person = COALESCE($2, contact_person),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address),
        country = COALESCE($6, country),
        notes = COALESCE($7, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8`,
      [
        req.body.name,
        req.body.contactPerson,
        req.body.email,
        req.body.phone,
        req.body.address,
        req.body.country,
        req.body.notes,
        req.params.id
      ]
    );

    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(dbRowToSupplier(result.rows[0]));
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', validateId, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

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
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = dbRowToSupplier(result.rows[0]);

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

/**
 * GET /api/suppliers/metrics - Get performance metrics for all suppliers
 * Returns KPI data (on-time %, quality %, lead time, grades) for all suppliers
 */
router.get('/metrics/all', async (req, res) => {
  try {
    // Fetch all suppliers and shipments
    const suppliersResult = await db.query('SELECT * FROM suppliers ORDER BY name');
    const shipmentsResult = await db.query('SELECT * FROM shipments');

    const suppliers = suppliersResult.rows.map(dbRowToSupplier);
    const shipments = shipmentsResult.rows;

    // Calculate metrics for each supplier
    const metricsData = suppliers.map(supplier => {
      const supplierShipments = shipments.filter(s =>
        s.supplier?.toLowerCase().trim() === supplier.name?.toLowerCase().trim()
      );

      if (supplierShipments.length === 0) {
        return {
          supplierName: supplier.name,
          supplierId: supplier.id,
          onTimePercent: 0,
          passRatePercent: null,
          avgLeadTime: null,
          totalShipments: 0,
          grade: { grade: 'N/A', label: 'No Data', color: '#ccc' }
        };
      }

      // Calculate on-time delivery %
      const arrivedShipments = supplierShipments.filter(s => {
        const isArrived = ['ARRIVED_PTA', 'ARRIVED_KLM', 'ARRIVED_OFFSITE', 'STORED', 'RECEIVED']
          .includes(s.latest_status);
        return isArrived;
      });
      const onTimePercent = arrivedShipments.length > 0
        ? Math.round((arrivedShipments.length / supplierShipments.length) * 100)
        : 0;

      // Calculate inspection pass rate %
      const inspectedShipments = supplierShipments.filter(s => s.inspection_date);
      const passRatePercent = inspectedShipments.length > 0
        ? Math.round((inspectedShipments.filter(s =>
            s.inspection_status === 'PASSED' || s.inspection_status === 'passed'
          ).length / inspectedShipments.length) * 100)
        : null;

      // Calculate average lead time
      const shippedWithReceiving = supplierShipments.filter(s => s.receiving_date && s.week_number);
      const avgLeadTime = shippedWithReceiving.length > 0
        ? Math.round(shippedWithReceiving.reduce((sum, s) => {
            const scheduled = new Date(s.selected_week_date || `${new Date().getFullYear()}-01-01`);
            const actual = new Date(s.receiving_date);
            const diffMs = actual - scheduled;
            return sum + Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          }, 0) / shippedWithReceiving.length)
        : null;

      // Determine grade
      let grade = { grade: 'C', label: 'Needs Improvement', color: '#dc3545' };
      if (onTimePercent >= 85 && (passRatePercent === null || passRatePercent >= 90)) {
        grade = { grade: 'A', label: 'Excellent', color: '#28a745' };
      } else if (onTimePercent >= 70 && (passRatePercent === null || passRatePercent >= 80)) {
        grade = { grade: 'B', label: 'Good', color: '#ffc107' };
      }

      return {
        supplierName: supplier.name,
        supplierId: supplier.id,
        onTimePercent,
        passRatePercent,
        avgLeadTime,
        totalShipments: supplierShipments.length,
        grade
      };
    });

    res.json(metricsData);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch supplier metrics' });
  }
});

/**
 * GET /api/suppliers/:id/metrics - Get performance metrics for a specific supplier
 */
router.get('/:id/metrics', validateId, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch supplier
    const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = dbRowToSupplier(supplierResult.rows[0]);

    // Fetch shipments for this supplier
    const shipmentsResult = await db.query(
      'SELECT * FROM shipments WHERE LOWER(supplier) = LOWER($1)',
      [supplier.name]
    );
    const shipments = shipmentsResult.rows;

    if (shipments.length === 0) {
      return res.json({
        supplier,
        metrics: {
          onTimePercent: 0,
          passRatePercent: null,
          avgLeadTime: null,
          totalShipments: 0,
          grade: { grade: 'N/A', label: 'No Data', color: '#ccc' }
        }
      });
    }

    // Calculate on-time delivery %
    const arrivedShipments = shipments.filter(s => {
      const isArrived = ['ARRIVED_PTA', 'ARRIVED_KLM', 'ARRIVED_OFFSITE', 'STORED', 'RECEIVED']
        .includes(s.latest_status);
      return isArrived;
    });
    const onTimePercent = arrivedShipments.length > 0
      ? Math.round((arrivedShipments.length / shipments.length) * 100)
      : 0;

    // Calculate inspection pass rate %
    const inspectedShipments = shipments.filter(s => s.inspection_date);
    const passRatePercent = inspectedShipments.length > 0
      ? Math.round((inspectedShipments.filter(s =>
          s.inspection_status === 'PASSED' || s.inspection_status === 'passed'
        ).length / inspectedShipments.length) * 100)
      : null;

    // Calculate average lead time
    const shippedWithReceiving = shipments.filter(s => s.receiving_date && s.week_number);
    const avgLeadTime = shippedWithReceiving.length > 0
      ? Math.round(shippedWithReceiving.reduce((sum, s) => {
          const scheduled = new Date(s.selected_week_date || `${new Date().getFullYear()}-01-01`);
          const actual = new Date(s.receiving_date);
          const diffMs = actual - scheduled;
          return sum + Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }, 0) / shippedWithReceiving.length)
      : null;

    // Determine grade
    let grade = { grade: 'C', label: 'Needs Improvement', color: '#dc3545' };
    if (onTimePercent >= 85 && (passRatePercent === null || passRatePercent >= 90)) {
      grade = { grade: 'A', label: 'Excellent', color: '#28a745' };
    } else if (onTimePercent >= 70 && (passRatePercent === null || passRatePercent >= 80)) {
      grade = { grade: 'B', label: 'Good', color: '#ffc107' };
    }

    res.json({
      supplier,
      metrics: {
        onTimePercent,
        passRatePercent,
        avgLeadTime,
        totalShipments: shipments.length,
        grade
      }
    });
  } catch (error) {
    console.error('Error fetching supplier metrics:', error);
    res.status(500).json({ error: 'Failed to fetch supplier metrics' });
  }
});

export default router;
