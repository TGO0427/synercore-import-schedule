import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/connection.ts';
import { validateSupplierCreate, validateSupplierUpdate, validateId, validate } from '../middleware/validation.js';

const router = Router();
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

const DOCUMENTS_DIR: string = path.join(__dirname, '../uploads/documents');

interface SupplierRow {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  code?: string;
}

interface DocumentRef {
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  supplierId: string;
}

interface DocumentInfo {
  filename: string;
  size: number;
  uploadedAt: string;
  path: string;
}

interface ScheduleItem {
  id?: string;
  [key: string]: any;
}

interface Grade {
  grade: string;
  label: string;
  color: string;
}

interface SupplierMetrics {
  supplierName: string;
  supplierId: string;
  onTimePercent: number;
  passRatePercent: number | null;
  avgLeadTime: number | null;
  totalShipments: number;
  grade: Grade;
}

// Ensure directories exist
async function ensureDirectories(): Promise<void> {
  try {
    await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Initialize directories
ensureDirectories();

// Helper to convert DB row to camelCase
function dbRowToSupplier(row: SupplierRow): Supplier;
function dbRowToSupplier(row: null | undefined): null;
function dbRowToSupplier(row: SupplierRow | null | undefined): Supplier | null;
function dbRowToSupplier(row: SupplierRow | null | undefined): Supplier | null {
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM suppliers ORDER BY name');
    res.json(result.rows.map((row: SupplierRow) => dbRowToSupplier(row)));
  } catch (error) {
    console.error('Error reading suppliers:', error);
    res.status(500).json({ error: 'Failed to read suppliers' });
  }
});

// GET /api/suppliers/:id - Get specific supplier
router.get('/:id', validateId, async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(dbRowToSupplier(result.rows[0] as SupplierRow));
  } catch (error) {
    console.error('Error reading supplier:', error);
    res.status(500).json({ error: 'Failed to read supplier' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', validateSupplierCreate, async (req: Request, res: Response) => {
  try {
    const id: string = req.body.id || Date.now().toString();

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
    res.status(201).json(dbRowToSupplier(result.rows[0] as SupplierRow));
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', validateSupplierUpdate, async (req: Request, res: Response) => {
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

    res.json(dbRowToSupplier(result.rows[0] as SupplierRow));
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', validateId, async (req: Request, res: Response) => {
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
router.post('/:id/import', async (req: Request, res: Response) => {
  try {
    const { scheduleData, documents = [] }: { scheduleData: ScheduleItem[]; documents: any[] } = req.body;

    if (!scheduleData || !Array.isArray(scheduleData)) {
      return res.status(400).json({ error: 'Invalid schedule data' });
    }

    // Get supplier info
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier: Supplier = dbRowToSupplier(result.rows[0] as SupplierRow);

    // Process and validate schedule data
    const processedSchedule = scheduleData.map((item: ScheduleItem, index: number) => ({
      ...item,
      id: item.id || `${supplier.code || supplier.name}-${Date.now()}-${index}`,
      supplier: supplier.name,
      supplierId: supplier.id,
      importedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Store document references if any
    const documentRefs: DocumentRef[] = documents.map((doc: any) => ({
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
router.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const supplierId: string = req.params.id;

    // Read document metadata (you might want to store this in a separate file)
    // For now, we'll just list files in the supplier's directory
    const supplierDocsDir: string = path.join(DOCUMENTS_DIR, supplierId);

    try {
      const files: string[] = await fs.readdir(supplierDocsDir);
      const documentList: DocumentInfo[] = await Promise.all(
        files.map(async (filename: string): Promise<DocumentInfo> => {
          const filePath: string = path.join(supplierDocsDir, filename);
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
      if ((error as any).code === 'ENOENT') {
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
router.get('/:id/documents/:filename', async (req: Request, res: Response) => {
  try {
    const { id: supplierId, filename } = req.params;
    const baseDir: string = path.resolve(DOCUMENTS_DIR, supplierId);
    const filePath: string = path.resolve(baseDir, filename);
    if (!filePath.startsWith(baseDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

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
router.delete('/:id/documents/:filename', async (req: Request, res: Response) => {
  try {
    const { id: supplierId, filename } = req.params;
    const baseDir: string = path.resolve(DOCUMENTS_DIR, supplierId);
    const filePath: string = path.resolve(baseDir, filename);
    if (!filePath.startsWith(baseDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
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
router.put('/:id/documents/:filename/rename', async (req: Request, res: Response) => {
  try {
    const { id: supplierId, filename } = req.params;
    const { newName }: { newName: string } = req.body;


    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New name is required' });
    }

    // Validate filename - check for invalid characters
    const invalidChars: RegExp = /[<>:"/\\|?*]/g;
    if (invalidChars.test(newName.trim())) {
      return res.status(400).json({ error: 'Filename contains invalid characters. Cannot use: < > : " / \\ | ? *' });
    }

    const supplierDocsDir: string = path.resolve(DOCUMENTS_DIR, supplierId);
    const oldFilePath: string = path.resolve(supplierDocsDir, filename);
    const newFilePath: string = path.resolve(supplierDocsDir, newName.trim());
    if (!oldFilePath.startsWith(supplierDocsDir) || !newFilePath.startsWith(supplierDocsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

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
      if ((error as any).code === 'ENOENT') {
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
router.get('/metrics/all', async (req: Request, res: Response) => {
  try {
    // Single aggregation query instead of loading all shipments into memory
    const result = await db.query(`
      SELECT
        s.id as supplier_id,
        s.name as supplier_name,
        COUNT(sh.id) as total_shipments,
        COUNT(CASE WHEN LOWER(sh.latest_status) IN ('arrived_pta', 'arrived_klm', 'arrived_offsite', 'stored', 'received') THEN 1 END) as arrived_count,
        COUNT(CASE WHEN sh.inspection_date IS NOT NULL THEN 1 END) as inspected_count,
        COUNT(CASE WHEN sh.inspection_date IS NOT NULL AND LOWER(sh.inspection_status) = 'passed' THEN 1 END) as passed_count,
        ROUND(AVG(
          CASE WHEN sh.receiving_date IS NOT NULL AND sh.week_number IS NOT NULL
          THEN EXTRACT(EPOCH FROM (sh.receiving_date::timestamp - COALESCE(sh.selected_week_date::timestamp, DATE_TRUNC('year', CURRENT_DATE)))) / 86400
          END
        )) as avg_lead_time
      FROM suppliers s
      LEFT JOIN shipments sh ON LOWER(TRIM(s.name)) = LOWER(TRIM(sh.supplier))
      GROUP BY s.id, s.name
      ORDER BY s.name
    `);

    const metricsData: SupplierMetrics[] = result.rows.map((row: any) => {
      const total: number = parseInt(row.total_shipments) || 0;
      const arrived: number = parseInt(row.arrived_count) || 0;
      const inspected: number = parseInt(row.inspected_count) || 0;
      const passed: number = parseInt(row.passed_count) || 0;

      if (total === 0) {
        return {
          supplierName: row.supplier_name,
          supplierId: row.supplier_id,
          onTimePercent: 0,
          passRatePercent: null,
          avgLeadTime: null,
          totalShipments: 0,
          grade: { grade: 'N/A', label: 'No Data', color: '#ccc' }
        };
      }

      const onTimePercent: number = arrived > 0 ? Math.round((arrived / total) * 100) : 0;
      const passRatePercent: number | null = inspected > 0 ? Math.round((passed / inspected) * 100) : null;
      const avgLeadTime: number | null = row.avg_lead_time != null ? Math.round(parseFloat(row.avg_lead_time)) : null;

      // Determine grade
      let grade: Grade = { grade: 'C', label: 'Needs Improvement', color: '#dc3545' };
      if (onTimePercent >= 85 && (passRatePercent === null || passRatePercent >= 90)) {
        grade = { grade: 'A', label: 'Excellent', color: '#28a745' };
      } else if (onTimePercent >= 70 && (passRatePercent === null || passRatePercent >= 80)) {
        grade = { grade: 'B', label: 'Good', color: '#ffc107' };
      }

      return {
        supplierName: row.supplier_name,
        supplierId: row.supplier_id,
        onTimePercent,
        passRatePercent,
        avgLeadTime,
        totalShipments: total,
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
router.get('/:id/metrics', validateId, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch supplier
    const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier: Supplier = dbRowToSupplier(supplierResult.rows[0] as SupplierRow);

    // Fetch shipments for this supplier
    const shipmentsResult = await db.query(
      'SELECT * FROM shipments WHERE LOWER(supplier) = LOWER($1)',
      [supplier.name]
    );
    const shipments: any[] = shipmentsResult.rows;

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
    const arrivedShipments: any[] = shipments.filter((s: any) => {
      const isArrived: boolean = ['ARRIVED_PTA', 'ARRIVED_KLM', 'ARRIVED_OFFSITE', 'STORED', 'RECEIVED']
        .includes(s.latest_status);
      return isArrived;
    });
    const onTimePercent: number = arrivedShipments.length > 0
      ? Math.round((arrivedShipments.length / shipments.length) * 100)
      : 0;

    // Calculate inspection pass rate %
    const inspectedShipments: any[] = shipments.filter((s: any) => s.inspection_date);
    const passRatePercent: number | null = inspectedShipments.length > 0
      ? Math.round((inspectedShipments.filter((s: any) =>
          s.inspection_status === 'PASSED' || s.inspection_status === 'passed'
        ).length / inspectedShipments.length) * 100)
      : null;

    // Calculate average lead time
    const shippedWithReceiving: any[] = shipments.filter((s: any) => s.receiving_date && s.week_number);
    const avgLeadTime: number | null = shippedWithReceiving.length > 0
      ? Math.round(shippedWithReceiving.reduce((sum: number, s: any) => {
          const scheduled: Date = new Date(s.selected_week_date || `${new Date().getFullYear()}-01-01`);
          const actual: Date = new Date(s.receiving_date);
          const diffMs: number = actual.getTime() - scheduled.getTime();
          return sum + Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }, 0) / shippedWithReceiving.length)
      : null;

    // Determine grade
    let grade: Grade = { grade: 'C', label: 'Needs Improvement', color: '#dc3545' };
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
