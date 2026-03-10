/**
 * Bill of Lading Audit Routes
 * API endpoints for managing and auditing bills of lading
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import { authenticateToken } from '../middleware/security.js';
import { requireAdmin } from '../middleware/auth.ts';
import { logInfo, logError } from '../utils/logger.js';
import { getPool, queryAll, queryOne, transaction } from '../db/connection.js';
import { AuditRepository } from '../db/repositories/AuditRepository.ts';
import { parseBolPdf, autoAuditBol } from '../services/bolPdfParser.ts';

// PDF-only upload (10MB max)
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

// Validation rules
const createBolValidation = [
  body('bol_number').trim().notEmpty().withMessage('BOL number is required'),
  body('shipment_id').optional({ nullable: true }).isString(),
  body('supplier_name').optional({ nullable: true }).trim(),
  body('carrier_name').optional({ nullable: true }).trim(),
  body('vessel_name').optional({ nullable: true }).trim(),
  body('voyage_number').optional({ nullable: true }).trim(),
  body('port_of_loading').optional({ nullable: true }).trim(),
  body('port_of_discharge').optional({ nullable: true }).trim(),
  body('consignee').optional({ nullable: true }).trim(),
  body('shipper').optional({ nullable: true }).trim(),
  body('description_of_goods').optional({ nullable: true }).trim(),
  body('container_numbers').optional({ nullable: true }),
  body('gross_weight_kg').optional({ nullable: true }).isFloat({ min: 0, max: 100000000 }),
  body('volume_cbm').optional({ nullable: true }).isFloat({ min: 0, max: 1000000 }),
  body('number_of_packages').optional({ nullable: true }).isInt({ min: 0, max: 1000000 }),
  body('freight_charges_usd').optional({ nullable: true }).isFloat({ min: 0, max: 100000000 }),
  body('declared_value_usd').optional({ nullable: true }).isFloat({ min: 0, max: 100000000 }),
  body('issue_date').optional({ nullable: true }).isISO8601(),
  body('ship_on_board_date').optional({ nullable: true }).isISO8601(),
  body('notify_party').optional({ nullable: true }).trim(),
  body('payment_terms').optional({ nullable: true }).isIn(['prepaid', 'collect', 'third_party']),
  body('incoterm').optional({ nullable: true }).trim(),
  body('notes').optional({ nullable: true }).trim(),
];

const auditBolValidation = [
  param('id').isInt({ min: 1 }),
  body('audit_status').isIn(['pending', 'in_review', 'approved', 'rejected', 'discrepancy']).withMessage('Invalid audit status'),
  body('audit_notes').optional({ nullable: true }).trim(),
  body('discrepancies').optional({ nullable: true }),
  body('weight_verified').optional().isBoolean(),
  body('charges_verified').optional().isBoolean(),
  body('documents_verified').optional().isBoolean(),
];

// ==================== BOL CRUD ROUTES ====================

/**
 * GET /api/bol-audit
 * List all BOLs with optional filtering
 */
router.get(
  '/',
  authenticateToken,
  [
    query('audit_status').optional().isIn(['pending', 'in_review', 'approved', 'rejected', 'discrepancy']),
    query('supplier').optional().isString(),
    query('carrier').optional().isString(),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.query.audit_status) {
      conditions.push(`b.audit_status = $${paramIndex++}`);
      params.push(req.query.audit_status);
    }
    if (req.query.supplier) {
      conditions.push(`b.supplier_name ILIKE $${paramIndex++}`);
      params.push(`%${req.query.supplier}%`);
    }
    if (req.query.carrier) {
      conditions.push(`b.carrier_name ILIKE $${paramIndex++}`);
      params.push(`%${req.query.carrier}%`);
    }
    if (req.query.date_from) {
      conditions.push(`b.issue_date >= $${paramIndex++}`);
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      conditions.push(`b.issue_date <= $${paramIndex++}`);
      params.push(req.query.date_to);
    }
    if (req.query.search) {
      conditions.push(`(
        b.bol_number ILIKE $${paramIndex} OR
        b.supplier_name ILIKE $${paramIndex} OR
        b.carrier_name ILIKE $${paramIndex} OR
        b.vessel_name ILIKE $${paramIndex} OR
        b.consignee ILIKE $${paramIndex} OR
        b.description_of_goods ILIKE $${paramIndex}
      )`);
      params.push(`%${req.query.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM bol_audits b ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    const rows = await queryAll(
      `SELECT b.*,
              u1.username as created_by_name,
              u2.username as audited_by_name
       FROM bol_audits b
       LEFT JOIN users u1 ON b.created_by = u1.id
       LEFT JOIN users u2 ON b.audited_by = u2.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

/**
 * GET /api/bol-audit/stats
 * Get audit statistics/summary
 */
router.get(
  '/stats',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await queryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN audit_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN audit_status = 'in_review' THEN 1 END) as in_review,
        COUNT(CASE WHEN audit_status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN audit_status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN audit_status = 'discrepancy' THEN 1 END) as discrepancy,
        COALESCE(SUM(freight_charges_usd), 0) as total_freight_usd,
        COALESCE(SUM(declared_value_usd), 0) as total_declared_value_usd,
        COALESCE(SUM(CASE WHEN audit_status = 'discrepancy' THEN freight_charges_usd ELSE 0 END), 0) as flagged_freight_usd
      FROM bol_audits
    `);
    res.json({ data: stats });
  })
);

/**
 * GET /api/bol-audit/:id
 * Get single BOL details
 */
router.get(
  '/:id',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const bol = await queryOne(
      `SELECT b.*,
              u1.username as created_by_name,
              u2.username as audited_by_name
       FROM bol_audits b
       LEFT JOIN users u1 ON b.created_by = u1.id
       LEFT JOIN users u2 ON b.audited_by = u2.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!bol) {
      return res.status(404).json({ error: 'Bill of Lading not found' });
    }
    res.json({ data: bol });
  })
);

/**
 * POST /api/bol-audit
 * Create a new BOL entry
 */
router.post(
  '/',
  authenticateToken,
  createBolValidation,
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const {
      bol_number, shipment_id, supplier_name, carrier_name, vessel_name,
      voyage_number, port_of_loading, port_of_discharge, consignee, shipper,
      description_of_goods, container_numbers, gross_weight_kg, volume_cbm,
      number_of_packages, freight_charges_usd, declared_value_usd,
      issue_date, ship_on_board_date, notify_party, payment_terms, incoterm, notes
    } = req.body;

    const result = await queryOne(
      `INSERT INTO bol_audits (
        bol_number, shipment_id, supplier_name, carrier_name, vessel_name,
        voyage_number, port_of_loading, port_of_discharge, consignee, shipper,
        description_of_goods, container_numbers, gross_weight_kg, volume_cbm,
        number_of_packages, freight_charges_usd, declared_value_usd,
        issue_date, ship_on_board_date, notify_party, payment_terms, incoterm,
        notes, created_by, audit_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 'pending'
      ) RETURNING *`,
      [
        bol_number, shipment_id || null, supplier_name || null, carrier_name || null,
        vessel_name || null, voyage_number || null, port_of_loading || null,
        port_of_discharge || null, consignee || null, shipper || null,
        description_of_goods || null, container_numbers ? JSON.stringify(container_numbers) : null,
        gross_weight_kg || null, volume_cbm || null, number_of_packages || null,
        freight_charges_usd || null, declared_value_usd || null,
        issue_date || null, ship_on_board_date || null, notify_party || null,
        payment_terms || null, incoterm || null, notes || null, userId
      ]
    );

    const user = (req as any).user;
    AuditRepository.logAudit(
      userId, user?.username || '', 'create', 'bol_audit', String(result.id),
      bol_number, { bol_number, supplier_name, carrier_name }
    );

    logInfo(`BOL created: ${bol_number} (ID: ${result.id})`);
    res.status(201).json({ data: result, message: 'Bill of Lading created successfully' });
  })
);

/**
 * PUT /api/bol-audit/:id
 * Update BOL details
 */
router.put(
  '/:id',
  authenticateToken,
  [param('id').isInt({ min: 1 }), ...createBolValidation],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check exists
    const existing = await queryOne('SELECT id FROM bol_audits WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Bill of Lading not found' });
    }

    const {
      bol_number, shipment_id, supplier_name, carrier_name, vessel_name,
      voyage_number, port_of_loading, port_of_discharge, consignee, shipper,
      description_of_goods, container_numbers, gross_weight_kg, volume_cbm,
      number_of_packages, freight_charges_usd, declared_value_usd,
      issue_date, ship_on_board_date, notify_party, payment_terms, incoterm, notes
    } = req.body;

    const result = await queryOne(
      `UPDATE bol_audits SET
        bol_number = COALESCE($1, bol_number),
        shipment_id = $2, supplier_name = $3, carrier_name = $4,
        vessel_name = $5, voyage_number = $6, port_of_loading = $7,
        port_of_discharge = $8, consignee = $9, shipper = $10,
        description_of_goods = $11, container_numbers = $12,
        gross_weight_kg = $13, volume_cbm = $14, number_of_packages = $15,
        freight_charges_usd = $16, declared_value_usd = $17,
        issue_date = $18, ship_on_board_date = $19, notify_party = $20,
        payment_terms = $21, incoterm = $22, notes = $23,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $24 RETURNING *`,
      [
        bol_number, shipment_id || null, supplier_name || null, carrier_name || null,
        vessel_name || null, voyage_number || null, port_of_loading || null,
        port_of_discharge || null, consignee || null, shipper || null,
        description_of_goods || null, container_numbers ? JSON.stringify(container_numbers) : null,
        gross_weight_kg || null, volume_cbm || null, number_of_packages || null,
        freight_charges_usd || null, declared_value_usd || null,
        issue_date || null, ship_on_board_date || null, notify_party || null,
        payment_terms || null, incoterm || null, notes || null, id
      ]
    );

    const user = (req as any).user;
    AuditRepository.logAudit(
      user?.id, user?.username || '', 'update', 'bol_audit', id,
      bol_number || String(id), req.body
    );

    logInfo(`BOL updated: ID ${id}`);
    res.json({ data: result, message: 'Bill of Lading updated successfully' });
  })
);

/**
 * POST /api/bol-audit/:id/audit
 * Submit audit decision (approve/reject/flag discrepancy)
 */
router.post(
  '/:id/audit',
  authenticateToken,
  auditBolValidation,
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { audit_status, audit_notes, discrepancies, weight_verified, charges_verified, documents_verified } = req.body;

    const existing = await queryOne('SELECT id, bol_number FROM bol_audits WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Bill of Lading not found' });
    }

    const result = await queryOne(
      `UPDATE bol_audits SET
        audit_status = $1,
        audit_notes = $2,
        discrepancies = $3,
        weight_verified = COALESCE($4, weight_verified),
        charges_verified = COALESCE($5, charges_verified),
        documents_verified = COALESCE($6, documents_verified),
        audited_by = $7,
        audited_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *`,
      [
        audit_status,
        audit_notes || null,
        discrepancies ? JSON.stringify(discrepancies) : null,
        weight_verified ?? null,
        charges_verified ?? null,
        documents_verified ?? null,
        userId,
        id
      ]
    );

    const user = (req as any).user;
    AuditRepository.logAudit(
      userId, user?.username || '', 'audit', 'bol_audit', id,
      (existing as any).bol_number, { audit_status, audit_notes, discrepancies }
    );

    logInfo(`BOL ${id} audited: ${audit_status}`);
    res.json({ data: result, message: `Bill of Lading ${audit_status}` });
  })
);

/**
 * POST /api/bol-audit/upload-pdf
 * Upload a BOL PDF, extract data, auto-audit, and create BOL record
 */
router.post(
  '/upload-pdf',
  authenticateToken,
  pdfUpload.single('pdf'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const userId = (req as any).user?.id;
    const user = (req as any).user;

    // 1. Extract data from PDF
    logInfo(`Parsing BOL PDF: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)}KB)`);
    const extracted = await parseBolPdf(req.file.buffer);

    // 2. Auto-audit against shipments
    const auditResult = await autoAuditBol(extracted);

    // 3. Create BOL record with extracted data
    const bolNumber = extracted.bol_number || `IMPORT_${Date.now()}`;
    const result = await queryOne(
      `INSERT INTO bol_audits (
        bol_number, shipment_id, supplier_name, carrier_name, vessel_name,
        voyage_number, port_of_loading, port_of_discharge, consignee, shipper,
        description_of_goods, container_numbers, gross_weight_kg, volume_cbm,
        number_of_packages, freight_charges_usd, declared_value_usd,
        issue_date, ship_on_board_date, notify_party, payment_terms, incoterm,
        notes, created_by, audit_status, audit_notes, discrepancies,
        raw_pdf_text, extraction_confidence, pdf_filename
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28, $29, $30
      ) RETURNING *`,
      [
        bolNumber,
        auditResult.matched_shipment?.id || null,
        extracted.supplier_name, extracted.carrier_name, extracted.vessel_name,
        extracted.voyage_number, extracted.port_of_loading, extracted.port_of_discharge,
        extracted.consignee, extracted.shipper,
        extracted.description_of_goods,
        extracted.container_numbers.length > 0 ? JSON.stringify(extracted.container_numbers) : null,
        extracted.gross_weight_kg, extracted.volume_cbm, extracted.number_of_packages,
        extracted.freight_charges_usd, extracted.declared_value_usd,
        extracted.issue_date, extracted.ship_on_board_date,
        extracted.notify_party, extracted.payment_terms, extracted.incoterm,
        `Imported from PDF: ${req.file.originalname}`,
        userId,
        auditResult.status,
        auditResult.findings.length > 0
          ? `Auto-audit score: ${auditResult.score}/100. ${auditResult.findings.filter(f => f.severity === 'error').length} errors, ${auditResult.findings.filter(f => f.severity === 'warning').length} warnings.`
          : null,
        auditResult.findings.length > 0 ? JSON.stringify(auditResult.findings) : null,
        extracted.raw_text,
        JSON.stringify(extracted.confidence),
        req.file.originalname,
      ]
    );

    AuditRepository.logAudit(
      userId, user?.username || '', 'import_pdf', 'bol_audit',
      String((result as any).id), bolNumber,
      { filename: req.file.originalname, auto_status: auditResult.status, score: auditResult.score }
    );

    logInfo(`BOL PDF imported: ${bolNumber} (status: ${auditResult.status}, score: ${auditResult.score})`);

    res.status(201).json({
      data: result,
      extraction: {
        confidence: extracted.confidence,
        findings: auditResult.findings,
        score: auditResult.score,
        matched_shipment: auditResult.matched_shipment
          ? { id: auditResult.matched_shipment.id, order_ref: auditResult.matched_shipment.order_ref, supplier: auditResult.matched_shipment.supplier }
          : null,
      },
      message: `BOL imported from PDF. Auto-audit: ${auditResult.status} (score: ${auditResult.score}/100)`,
    });
  })
);

/**
 * DELETE /api/bol-audit/:id
 * Delete a BOL (admin only)
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await queryOne('DELETE FROM bol_audits WHERE id = $1 RETURNING id, bol_number', [id]);
    if (!result) {
      return res.status(404).json({ error: 'Bill of Lading not found' });
    }

    const user = (req as any).user;
    AuditRepository.logAudit(
      user?.id, user?.username || '', 'delete', 'bol_audit', id,
      (result as any).bol_number, null
    );

    logInfo(`BOL deleted: ID ${id}`);
    res.json({ message: 'Bill of Lading deleted successfully' });
  })
);

export default router;
