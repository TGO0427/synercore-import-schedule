// Supplier portal controller - handles supplier authentication and data access
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import path from 'path';
import fs from 'fs/promises';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
const ACCESS_TOKEN_EXPIRY = '15m';

export class SupplierController {
  /**
   * Register a new supplier account
   * Suppliers can self-register and get access to their shipments
   */
  static async register(req, res) {
    try {
      const { supplierId, email, password, companyName } = req.body;

      // Validate input
      if (!supplierId || !email || !password) {
        return res.status(400).json({
          error: 'Supplier ID, email, and password are required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters'
        });
      }

      // Check if supplier exists
      const supplierCheck = await pool.query(
        'SELECT id FROM suppliers WHERE id = $1',
        [supplierId]
      );

      if (supplierCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Supplier not found in system'
        });
      }

      // Check if account already exists
      const accountCheck = await pool.query(
        'SELECT id FROM supplier_accounts WHERE supplier_id = $1',
        [supplierId]
      );

      if (accountCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Supplier account already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create account
      const result = await pool.query(
        `INSERT INTO supplier_accounts (supplier_id, email, password_hash, is_verified)
         VALUES ($1, $2, $3, true)
         RETURNING id, supplier_id, email, created_at`,
        [supplierId, email, passwordHash]
      );

      res.status(201).json({
        message: 'Supplier account created successfully',
        account: result.rows[0]
      });
    } catch (error) {
      console.error('Error registering supplier:', error);
      if (error.code === '23505') { // unique violation
        return res.status(409).json({ error: 'Email already registered' });
      }
      res.status(500).json({ error: 'Failed to register account' });
    }
  }

  /**
   * Login supplier account
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Find supplier account
      const result = await pool.query(
        `SELECT sa.id, sa.supplier_id, sa.email, sa.password_hash, sa.is_active, s.name
         FROM supplier_accounts sa
         JOIN suppliers s ON sa.supplier_id = s.id
         WHERE sa.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const account = result.rows[0];

      if (!account.is_active) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, account.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: account.supplier_id,
          email: account.email,
          role: 'supplier',
          name: account.name
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      // Update last login
      await pool.query(
        'UPDATE supplier_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [account.id]
      );

      res.json({
        token,
        expiresIn: 900, // 15 minutes in seconds
        user: {
          id: account.supplier_id,
          email: account.email,
          name: account.name,
          role: 'supplier'
        }
      });
    } catch (error) {
      console.error('Error logging in supplier:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  }

  /**
   * Get supplier's shipments
   */
  static async getSupplierShipments(req, res) {
    try {
      const supplierId = req.user.id; // From JWT token
      const { status, limit = 50, offset = 0 } = req.query;

      // Get supplier name from suppliers table for matching
      const supplierNameResult = await pool.query(
        'SELECT name FROM suppliers WHERE id = $1',
        [supplierId]
      );

      let supplierName = '';
      if (supplierNameResult.rows.length > 0) {
        supplierName = supplierNameResult.rows[0].name;
      }

      // Get all shipments for this supplier by matching supplier names (case-insensitive)
      // Uses flexible matching: LIKE for partial matches and exact name match
      let query = `
        SELECT s.id, s.order_ref as "orderRef", s.product_name as "productName", s.supplier,
               s.quantity, s.pallet_qty as "palletQty",
               s.latest_status as "latestStatus", s.final_pod as "finalPod",
               s.receiving_warehouse as "receivingWarehouse",
               s.week_number as "weekNumber", s.incoterm, s.created_at, s.updated_at
        FROM shipments s
        WHERE s.supplier IS NOT NULL
        AND (
          LOWER(s.supplier) LIKE LOWER('%' || $1 || '%')
          OR LOWER(s.supplier) = LOWER($2)
        )
      `;
      const params = [supplierName, supplierName];

      // Filter by status if provided
      if (status) {
        query += ` AND s.latest_status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM shipments s
        WHERE s.supplier IS NOT NULL
        AND (
          LOWER(s.supplier) LIKE LOWER('%' || $1 || '%')
          OR LOWER(s.supplier) = LOWER($2)
        )
      `;
      const countParams = [supplierName, supplierName];

      if (status) {
        countQuery += ` AND s.latest_status = $${countParams.length + 1}`;
        countParams.push(status);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        shipments: result.rows,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Error fetching supplier shipments:', error);
      res.status(500).json({ error: 'Failed to fetch shipments' });
    }
  }

  /**
   * Get single shipment details
   */
  static async getShipmentDetail(req, res) {
    try {
      const { shipmentId } = req.params;
      const supplierId = req.user.id;

      // Get supplier name from suppliers table for matching
      const supplierNameResult = await pool.query(
        'SELECT name FROM suppliers WHERE id = $1',
        [supplierId]
      );

      let supplierName = '';
      if (supplierNameResult.rows.length > 0) {
        supplierName = supplierNameResult.rows[0].name;
      }

      // Verify supplier owns this shipment (with flexible supplier name matching)
      const shipmentResult = await pool.query(
        `SELECT * FROM shipments s
         WHERE s.id = $1
         AND (
           LOWER(s.supplier) LIKE LOWER('%' || $2 || '%')
           OR LOWER(s.supplier) = LOWER($3)
         )`,
        [shipmentId, supplierName, supplierName]
      );

      if (shipmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not authorized' });
      }

      const shipment = shipmentResult.rows[0];

      // Get associated documents
      const docsResult = await pool.query(
        `SELECT id, document_type, file_name, uploaded_at, description, is_verified
         FROM supplier_documents
         WHERE shipment_id = $1`,
        [shipmentId]
      );

      res.json({
        shipment,
        documents: docsResult.rows
      });
    } catch (error) {
      console.error('Error fetching shipment detail:', error);
      res.status(500).json({ error: 'Failed to fetch shipment' });
    }
  }

  /**
   * Upload supplier document (POD, delivery proof, etc.)
   */
  static async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { shipmentId, documentType, description } = req.body;
      const supplierId = req.user.id;

      // Validate inputs
      if (!shipmentId || !documentType) {
        return res.status(400).json({
          error: 'Shipment ID and document type are required'
        });
      }

      const validTypes = ['POD', 'delivery_proof', 'customs', 'invoice', 'other'];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({ error: 'Invalid document type' });
      }

      // Get supplier name from suppliers table for matching
      const supplierNameResult = await pool.query(
        'SELECT name FROM suppliers WHERE id = $1',
        [supplierId]
      );

      let supplierName = '';
      if (supplierNameResult.rows.length > 0) {
        supplierName = supplierNameResult.rows[0].name;
      }

      // Verify supplier owns this shipment (with flexible supplier name matching)
      const shipmentCheck = await pool.query(
        `SELECT id FROM shipments s
         WHERE s.id = $1 AND (
           LOWER(s.supplier) LIKE LOWER('%' || $2 || '%')
           OR LOWER(s.supplier) = LOWER($3)
         )`,
        [shipmentId, supplierName, supplierName]
      );

      if (shipmentCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'You do not have permission to upload documents for this shipment'
        });
      }

      // Save file to documents directory
      const uploadsDir = './uploads/supplier-documents';
      await fs.mkdir(uploadsDir, { recursive: true });

      const fileName = `${supplierId}_${shipmentId}_${Date.now()}_${req.file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);

      await fs.writeFile(filePath, req.file.buffer);

      // Record in database
      const result = await pool.query(
        `INSERT INTO supplier_documents
         (shipment_id, supplier_id, document_type, file_name, file_path,
          file_size, mime_type, uploaded_by, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, document_type, file_name, uploaded_at`,
        [
          shipmentId,
          supplierId,
          documentType,
          req.file.originalname,
          filePath,
          req.file.size,
          req.file.mimetype,
          supplierId,
          description || null
        ]
      );

      res.status(201).json({
        message: 'Document uploaded successfully',
        document: result.rows[0]
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }

  /**
   * Get supplier reports
   */
  static async getSupplierReports(req, res) {
    try {
      const supplierId = req.user.id;

      // Get supplier name from suppliers table for matching
      const supplierNameResult = await pool.query(
        'SELECT name FROM suppliers WHERE id = $1',
        [supplierId]
      );

      let supplierName = '';
      if (supplierNameResult.rows.length > 0) {
        supplierName = supplierNameResult.rows[0].name;
      }

      // Get supplier's shipment statistics (with flexible supplier name matching)
      const statsResult = await pool.query(
        `SELECT
           COUNT(*) as total_shipments,
           SUM(CASE WHEN latest_status = 'received' THEN 1 ELSE 0 END) as delivered,
           SUM(CASE WHEN latest_status IN ('arrived_pta', 'arrived_klm', 'arrived_offsite') THEN 1 ELSE 0 END) as arrived,
           SUM(CASE WHEN latest_status = 'stored' THEN 1 ELSE 0 END) as stored,
           SUM(CASE WHEN pallet_qty IS NOT NULL THEN pallet_qty ELSE 0 END) as total_pallets,
           SUM(CASE WHEN quantity IS NOT NULL THEN quantity ELSE 0 END) as total_quantity
         FROM shipments
         WHERE (
           LOWER(supplier) LIKE LOWER('%' || $1 || '%')
           OR LOWER(supplier) = LOWER($2)
         )`,
        [supplierName, supplierName]
      );

      // Get document upload statistics
      const docsResult = await pool.query(
        `SELECT
           COUNT(*) as total_documents,
           COUNT(DISTINCT shipment_id) as shipments_with_docs,
           SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) as verified_documents
         FROM supplier_documents
         WHERE supplier_id = $1`,
        [supplierId]
      );

      // Get shipments by status (with flexible supplier name matching)
      const statusResult = await pool.query(
        `SELECT latest_status as "latestStatus", COUNT(*) as count
         FROM shipments
         WHERE (
           LOWER(supplier) LIKE LOWER('%' || $1 || '%')
           OR LOWER(supplier) = LOWER($2)
         )
         GROUP BY latest_status
         ORDER BY count DESC`,
        [supplierName, supplierName]
      );

      res.json({
        summary: statsResult.rows[0],
        documents: docsResult.rows[0],
        shipmentsByStatus: statusResult.rows
      });
    } catch (error) {
      console.error('Error generating reports:', error);
      res.status(500).json({ error: 'Failed to generate reports' });
    }
  }

  /**
   * Middleware to verify supplier token
   */
  static verifySupplierToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.role !== 'supplier') {
        return res.status(403).json({ error: 'Not a supplier account' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

export default SupplierController;
