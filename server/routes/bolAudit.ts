/**
 * Bill of Lading Audit Routes
 * API endpoints for managing and auditing bills of lading
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import { authenticateToken } from '../middleware/security.js';
import { requireAdmin } from '../middleware/auth.ts';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { getPool, queryAll, queryOne, transaction } from '../db/connection.js';
import { AuditRepository } from '../db/repositories/AuditRepository.ts';
import { parseBolPdf, autoAuditBol } from '../services/bolPdfParser.ts';
import { parseExcelRateSheet } from '../services/rateSheetParser.ts';
import { parseForwardingInvoice } from '../services/forwardingInvoiceParser.ts';

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

// Rate sheet upload (PDF, Excel — 10MB max)
const rateSheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv|pdf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Excel (.xlsx/.xls), or CSV files are accepted'));
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
  body('container_type').optional({ nullable: true }).isIn(['20GP', '40GP', '40HC']),
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
    if (req.query.date_from && req.query.date_to) {
      // Include BOLs whose date falls in range, OR BOLs with no date that were created in range
      conditions.push(`(
        (COALESCE(b.ship_on_board_date, b.issue_date) >= $${paramIndex} AND COALESCE(b.ship_on_board_date, b.issue_date) <= $${paramIndex + 1})
        OR (b.issue_date IS NULL AND b.ship_on_board_date IS NULL AND b.created_at >= $${paramIndex}::date AND b.created_at <= ($${paramIndex + 1}::date + INTERVAL '1 day'))
      )`);
      params.push(req.query.date_from, req.query.date_to);
      paramIndex += 2;
    } else if (req.query.date_from) {
      conditions.push(`(COALESCE(b.ship_on_board_date, b.issue_date) >= $${paramIndex} OR (b.issue_date IS NULL AND b.ship_on_board_date IS NULL AND b.created_at >= $${paramIndex}::date))`);
      params.push(req.query.date_from);
      paramIndex++;
    } else if (req.query.date_to) {
      conditions.push(`(COALESCE(b.ship_on_board_date, b.issue_date) <= $${paramIndex} OR (b.issue_date IS NULL AND b.ship_on_board_date IS NULL AND b.created_at <= ($${paramIndex}::date + INTERVAL '1 day')))`);
      params.push(req.query.date_to);
      paramIndex++;
    }
    if (req.query.search) {
      conditions.push(`(
        b.bol_number ILIKE $${paramIndex} OR
        b.supplier_name ILIKE $${paramIndex} OR
        b.carrier_name ILIKE $${paramIndex} OR
        b.vessel_name ILIKE $${paramIndex} OR
        b.consignee ILIKE $${paramIndex} OR
        b.description_of_goods ILIKE $${paramIndex} OR
        b.container_numbers::text ILIKE $${paramIndex}
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

// Helper: parse ?month=YYYY-MM into { monthStart, monthEnd } date strings
function parseMonth(monthStr: string | undefined): { monthStart: string; monthEnd: string } | null {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return null;
  const [y, m] = monthStr.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { monthStart, monthEnd };
}

// Helper: BOL date column for month filtering — falls back to created_at for undated BOLs
const BOL_DATE_COL = `COALESCE(ship_on_board_date, issue_date, created_at::date)`;

/**
 * GET /api/bol-audit/stats
 * Get audit statistics/summary. Supports ?month=YYYY-MM filter.
 */
router.get(
  '/stats',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const month = parseMonth(req.query.month as string);
    let whereClause = '';
    const params: any[] = [];
    if (month) {
      whereClause = `WHERE ${BOL_DATE_COL} >= $1 AND ${BOL_DATE_COL} <= $2`;
      params.push(month.monthStart, month.monthEnd);
    }

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
        COALESCE(SUM(CASE WHEN audit_status = 'discrepancy' THEN freight_charges_usd ELSE 0 END), 0) as flagged_freight_usd,
        -- Cost protection metrics
        COALESCE(SUM(CASE WHEN freight_variance_usd > 0 THEN freight_variance_usd ELSE 0 END), 0) as total_overcharges_usd,
        COUNT(CASE WHEN freight_variance_usd > 0 THEN 1 END) as overcharge_count,
        COALESCE(SUM(CASE WHEN freight_variance_usd < 0 THEN ABS(freight_variance_usd) ELSE 0 END), 0) as total_undercharges_usd,
        COUNT(CASE WHEN is_duplicate THEN 1 END) as duplicate_count,
        COUNT(CASE WHEN weight_variance_pct IS NOT NULL AND ABS(weight_variance_pct) > 5 THEN 1 END) as weight_discrepancy_count,
        COALESCE(AVG(CASE WHEN freight_charges_usd > 0 AND gross_weight_kg > 0 THEN freight_charges_usd / gross_weight_kg END), 0) as avg_freight_per_kg
      FROM bol_audits ${whereClause}
    `, params);
    res.json({ data: stats });
  })
);

// ==================== FREIGHT BENCHMARK ROUTES ====================
// These MUST be before /:id to prevent Express treating "benchmarks" as an ID

/**
 * GET /api/bol-audit/benchmarks
 * List freight benchmarks. Supports ?month=YYYY-MM to filter rates active during that month.
 */
router.get(
  '/benchmarks',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const month = parseMonth(req.query.month as string);
    let whereClause = '';
    const params: any[] = [];
    if (month) {
      // Show rates whose validity overlaps the selected month
      // Exclude NULL-dated rates if there are any dated rates (to avoid showing old duplicates)
      whereClause = `WHERE valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_from <= $2 AND valid_until >= $1`;
      params.push(month.monthStart, month.monthEnd);
      // Fallback: if no dated rates exist at all, show everything
      const dated = await queryOne(`SELECT COUNT(*) as c FROM freight_benchmarks WHERE valid_from IS NOT NULL`, []);
      if (parseInt(dated?.c || '0') === 0) {
        whereClause = '';
        params.length = 0;
      }
    }
    const rows = await queryAll(
      `SELECT * FROM freight_benchmarks ${whereClause} ORDER BY port_of_loading, carrier_name, port_of_discharge`,
      params
    );
    res.json({ data: rows });
  })
);

/**
 * POST /api/bol-audit/benchmarks
 * Create a new freight benchmark
 */
router.post(
  '/benchmarks',
  authenticateToken,
  [
    body('carrier_name').trim().notEmpty(),
    body('port_of_loading').trim().notEmpty(),
    body('port_of_discharge').trim().notEmpty(),
    body('rate_per_kg_usd').optional({ nullable: true }).isFloat({ min: 0 }),
    body('rate_20gp_usd').optional({ nullable: true }).isFloat({ min: 0 }),
    body('rate_40gp_usd').optional({ nullable: true }).isFloat({ min: 0 }),
    body('rate_40hc_usd').optional({ nullable: true }).isFloat({ min: 0 }),
    body('transport_mode').optional().isIn(['sea', 'air', 'road']),
    body('valid_from').optional({ nullable: true }).isISO8601(),
    body('valid_until').optional({ nullable: true }).isISO8601(),
    body('notes').optional({ nullable: true }).trim(),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const {
      carrier_name, port_of_loading, port_of_discharge,
      rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd,
      transport_mode, valid_from, valid_until, notes
    } = req.body;

    const result = await queryOne(
      `INSERT INTO freight_benchmarks (
        carrier_name, port_of_loading, port_of_discharge,
        rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd,
        transport_mode, valid_from, valid_until, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        carrier_name, port_of_loading, port_of_discharge,
        rate_per_kg_usd || null, rate_20gp_usd || null, rate_40gp_usd || null, rate_40hc_usd || null,
        transport_mode || 'sea', valid_from || null, valid_until || null,
        notes || null, userId
      ]
    );

    logInfo(`Benchmark created: ${carrier_name} ${port_of_loading} → ${port_of_discharge}`);
    res.status(201).json({ data: result, message: 'Benchmark rate created' });
  })
);

/**
 * PUT /api/bol-audit/benchmarks/:benchmarkId
 * Update a freight benchmark
 */
router.put(
  '/benchmarks/:benchmarkId',
  authenticateToken,
  [param('benchmarkId').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { benchmarkId } = req.params;
    const {
      carrier_name, port_of_loading, port_of_discharge,
      rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd,
      transport_mode, valid_from, valid_until, notes
    } = req.body;

    const result = await queryOne(
      `UPDATE freight_benchmarks SET
        carrier_name = COALESCE($1, carrier_name),
        port_of_loading = COALESCE($2, port_of_loading),
        port_of_discharge = COALESCE($3, port_of_discharge),
        rate_per_kg_usd = $4, rate_20gp_usd = $5, rate_40gp_usd = $6, rate_40hc_usd = $7,
        transport_mode = COALESCE($8, transport_mode),
        valid_from = $9, valid_until = $10, notes = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 RETURNING *`,
      [
        carrier_name || null, port_of_loading || null, port_of_discharge || null,
        rate_per_kg_usd ?? null, rate_20gp_usd ?? null, rate_40gp_usd ?? null, rate_40hc_usd ?? null,
        transport_mode || null, valid_from || null, valid_until || null,
        notes || null, benchmarkId
      ]
    );

    if (!result) {
      return res.status(404).json({ error: 'Benchmark not found' });
    }

    logInfo(`Benchmark updated: ID ${benchmarkId}`);
    res.json({ data: result, message: 'Benchmark rate updated' });
  })
);

/**
 * DELETE /api/bol-audit/benchmarks
 * Delete ALL freight benchmarks
 */
router.delete(
  '/benchmarks',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await queryOne<{ count: string }>(
      'WITH deleted AS (DELETE FROM freight_benchmarks RETURNING id) SELECT COUNT(*) FROM deleted'
    );
    const count = parseInt(result?.count || '0', 10);
    logInfo(`All benchmarks deleted: ${count} removed`);
    res.json({ message: `${count} benchmark rates deleted` });
  })
);

/**
 * DELETE /api/bol-audit/benchmarks/:benchmarkId
 * Delete a freight benchmark
 */
router.delete(
  '/benchmarks/:benchmarkId',
  authenticateToken,
  [param('benchmarkId').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await queryOne(
      'DELETE FROM freight_benchmarks WHERE id = $1 RETURNING id',
      [req.params.benchmarkId]
    );
    if (!result) {
      return res.status(404).json({ error: 'Benchmark not found' });
    }
    logInfo(`Benchmark deleted: ID ${req.params.benchmarkId}`);
    res.json({ message: 'Benchmark deleted' });
  })
);

/**
 * POST /api/bol-audit/benchmarks/upload
 * Upload a rate sheet (PDF or Excel) and auto-extract benchmark rates
 */
router.post(
  '/benchmarks/upload',
  (req: Request, res: Response, next: NextFunction) => {
    rateSheetUpload.single('rateSheet')(req, res, (err: any) => {
      if (err) {
        logError('Rate sheet upload error', { error: err.message });
        return res.status(400).json({ error: `Upload failed: ${err.message}` });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Rate sheet file is required' });
      }

      const userId = (req as any).user?.id;
      const filename = req.file.originalname;

      logInfo(`Parsing rate sheet: ${filename} (${(req.file.size / 1024).toFixed(1)}KB)`);

      const { rates, debug } = await parseExcelRateSheet(req.file.buffer, filename);

      // If a month is specified, override valid_from/valid_until on all extracted rates
      const uploadMonth = parseMonth(req.body?.month);
      if (uploadMonth) {
        for (const rate of rates) {
          rate.valid_from = uploadMonth.monthStart;
          rate.valid_until = uploadMonth.monthEnd;
        }
        logInfo(`Rate sheet month override: ${uploadMonth.monthStart} → ${uploadMonth.monthEnd}`);
      }

      if (rates.length === 0) {
        return res.status(400).json({
          error: 'No rates could be extracted from the file.',
          hint: 'Use the "Download Template" to see the expected format, or upload your rate sheet with port sections and 20GP/40GP/40HC columns.',
          debug,
        });
      }

      // Insert rates, skip duplicates
      let inserted = 0;
      let skipped = 0;
      for (const rate of rates) {
        const existing = await queryOne(
          `SELECT id FROM freight_benchmarks
           WHERE carrier_name = $1 AND port_of_loading = $2 AND port_of_discharge = $3
             AND transport_mode = $4
             AND (valid_from = $5 OR (valid_from IS NULL AND $5 IS NULL))`,
          [rate.carrier_name, rate.port_of_loading, rate.port_of_discharge, rate.transport_mode, rate.valid_from]
        );

        if (existing) {
          skipped++;
          continue;
        }

        await queryOne(
          `INSERT INTO freight_benchmarks (
            carrier_name, port_of_loading, port_of_discharge,
            rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd,
            transport_mode, valid_from, valid_until, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id`,
          [
            rate.carrier_name, rate.port_of_loading, rate.port_of_discharge,
            rate.rate_per_kg_usd, rate.rate_20gp_usd, rate.rate_40gp_usd, rate.rate_40hc_usd,
            rate.transport_mode, rate.valid_from, rate.valid_until,
            rate.notes, userId
          ]
        );
        inserted++;
      }

      logInfo(`Rate sheet processed: ${inserted} inserted, ${skipped} skipped from ${filename}`);
      res.status(201).json({
        message: `Extracted ${rates.length} rates: ${inserted} new, ${skipped} duplicates skipped`,
        data: { total_extracted: rates.length, inserted, skipped, rates, debug },
      });
    } catch (err: any) {
      logError('Rate sheet processing failed', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to process rate sheet', details: err.message });
    }
  }
);

/**
 * GET /api/bol-audit/benchmark-debug
 * Debug endpoint: shows what's in freight_benchmarks and bol_audits for troubleshooting matching
 */
router.get(
  '/benchmark-debug',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const benchmarks = await queryAll(
      `SELECT id, carrier_name, port_of_loading, port_of_discharge,
              rate_20gp_usd, rate_40gp_usd, rate_40hc_usd,
              valid_from, valid_until
       FROM freight_benchmarks ORDER BY carrier_name, port_of_loading LIMIT 100`
    );
    const bols = await queryAll(
      `SELECT id, bol_number, port_of_loading, port_of_discharge, carrier_name,
              freight_charges_usd, ship_on_board_date, issue_date, container_type,
              benchmark_rate_per_kg, freight_variance_usd
       FROM bol_audits ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ benchmarks, bols });
  })
);

/**
 * POST /api/bol-audit/benchmark-check
 * Re-run benchmark comparison on all BOLs (or specific ones)
 * Matches BOL freight charges against imported benchmark rates
 */
router.post(
  '/benchmark-check',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
    const { bol_ids, month } = req.body; // optional: specific BOL IDs or month filter
    const monthRange = parseMonth(month);

    // Get BOLs to check
    let bols: any[];
    const bolCols = `id, bol_number, port_of_loading, port_of_discharge, carrier_name,
                freight_charges_usd, gross_weight_kg, container_numbers, container_type,
                ship_on_board_date, issue_date`;
    if (bol_ids && Array.isArray(bol_ids) && bol_ids.length > 0) {
      bols = await queryAll(
        `SELECT ${bolCols} FROM bol_audits WHERE id = ANY($1)`,
        [bol_ids]
      );
    } else if (monthRange) {
      bols = await queryAll(
        `SELECT ${bolCols} FROM bol_audits
         WHERE freight_charges_usd IS NOT NULL
           AND ${BOL_DATE_COL} >= $1 AND ${BOL_DATE_COL} <= $2`,
        [monthRange.monthStart, monthRange.monthEnd]
      );
    } else {
      bols = await queryAll(
        `SELECT ${bolCols} FROM bol_audits WHERE freight_charges_usd IS NOT NULL`
      );
    }

    // Split port string into searchable parts: "DALIAN, CHINA" → ["DALIAN, CHINA", "DALIAN", "CHINA"]
    // "Cape Town, South Africa" → ["Cape Town, South Africa", "Cape Town", "South Africa"]
    function portParts(port: string | null): string[] {
      if (!port) return [];
      const parts = [port.trim()];
      // Split on comma, dash, or slash
      for (const sep of [',', '-', '/']) {
        if (port.includes(sep)) {
          port.split(sep).forEach(p => {
            const t = p.trim();
            if (t.length >= 3) parts.push(t);
          });
        }
      }
      return [...new Set(parts)];
    }

    // Log benchmark search for debugging
    function logBenchmarkSearch(bolNumber: string, pol: string | null, pod: string | null, found: boolean): void {
      if (!found) {
        logWarn('Benchmark not found', { bol: bolNumber, pol, pod, polParts: portParts(pol), podParts: portParts(pod) });
      }
    }

    // Helper: find benchmarks matching port conditions
    // Priority: 1) MSC Standard, 2) any other MSC rate, 3) BOL carrier, 4) any carrier
    // Uses the BOL's ship/issue date to find rates that were valid at the time of shipment
    async function findBenchmarks(pol: string | null, pod: string | null, carrier: string | null, refDate: string | null): Promise<any[]> {
      const polParts = portParts(pol);
      const podParts = portParts(pod);
      if (polParts.length === 0 && podParts.length === 0) return [];

      // Try each combination of POL/POD parts (most specific first)
      for (const polTerm of polParts.length > 0 ? polParts : [null]) {
        for (const podTerm of podParts.length > 0 ? podParts : [null]) {
          const result = await findBenchmarksExact(polTerm, podTerm, carrier, refDate);
          if (result.length > 0) return result;
        }
      }
      return [];
    }

    async function findBenchmarksExact(pol: string | null, pod: string | null, carrier: string | null, refDate: string | null): Promise<any[]> {
      const conds: string[] = [];
      const prms: any[] = [];
      let i = 1;
      if (pol) { conds.push(`LOWER(port_of_loading) LIKE LOWER($${i++})`); prms.push(`%${pol.substring(0, 30)}%`); }
      if (pod) { conds.push(`LOWER(port_of_discharge) LIKE LOWER($${i++})`); prms.push(`%${pod.substring(0, 30)}%`); }
      if (conds.length === 0) return [];

      // Use BOL's date to find rates valid at time of shipment, fallback to current date
      const dateParam = refDate ? `$${i++}` : 'CURRENT_DATE';
      if (refDate) prms.push(refDate);
      const validityCond = `(valid_from IS NULL OR valid_from <= ${dateParam}) AND (valid_until IS NULL OR valid_until >= ${dateParam})`;
      const whereBase = `${conds.join(' AND ')} AND (${validityCond})`;
      const cols = `rate_per_kg_usd, rate_20gp_usd, rate_40gp_usd, rate_40hc_usd, carrier_name`;

      // 1) MSC Standard rate (default benchmark)
      let res = await queryAll(
        `SELECT ${cols} FROM freight_benchmarks WHERE ${whereBase} AND LOWER(carrier_name) = 'msc standard'
         ORDER BY valid_from DESC NULLS LAST LIMIT 5`,
        prms
      );
      if (res.length > 0) return res;

      // 2) Any other MSC rate
      res = await queryAll(
        `SELECT ${cols} FROM freight_benchmarks WHERE ${whereBase} AND LOWER(carrier_name) LIKE 'msc%'
         ORDER BY valid_from DESC NULLS LAST LIMIT 5`,
        prms
      );
      if (res.length > 0) return res;

      // 3) BOL's actual carrier
      if (carrier) {
        res = await queryAll(
          `SELECT ${cols} FROM freight_benchmarks WHERE ${whereBase} AND LOWER(carrier_name) LIKE LOWER($${i})
           ORDER BY valid_from DESC NULLS LAST LIMIT 5`,
          [...prms, `%${carrier.substring(0, 30)}%`]
        );
        if (res.length > 0) return res;
      }

      // 4) Any available rate (regardless of carrier)
      return queryAll(
        `SELECT ${cols} FROM freight_benchmarks WHERE ${whereBase} ORDER BY valid_from DESC NULLS LAST LIMIT 5`,
        prms
      );
    }

    let updated = 0;
    const debugLog: any[] = [];
    for (const bol of bols) {
      const freight = parseFloat(bol.freight_charges_usd);
      if (!freight || freight <= 0) {
        debugLog.push({ bol: bol.bol_number, skip: 'no freight', freight: bol.freight_charges_usd });
        continue;
      }

      const pol = bol.port_of_loading || null;
      const pod = bol.port_of_discharge || null;
      if (!pol && !pod) {
        debugLog.push({ bol: bol.bol_number, skip: 'no ports' });
        continue;
      }

      // Use the BOL's ship date or issue date to find rates valid at time of shipment
      const refDate = bol.ship_on_board_date || bol.issue_date || null;
      logInfo(`Benchmark check: BOL ${bol.bol_number} | POL="${pol}" POD="${pod}" | carrier="${bol.carrier_name}" | refDate=${refDate} | polParts=${JSON.stringify(portParts(pol))} podParts=${JSON.stringify(portParts(pod))}`);

      // Strategy 1: exact POL → POD match (with date range)
      let benchmarks = await findBenchmarks(pol, pod, bol.carrier_name, refDate);

      // Strategy 2: swap POL/POD (PDF parser may have reversed them)
      if (benchmarks.length === 0 && pol && pod) {
        benchmarks = await findBenchmarks(pod, pol, bol.carrier_name, refDate);
      }

      // Strategy 3: match by POL only (POD might be missing/wrong)
      if (benchmarks.length === 0 && pol) {
        benchmarks = await findBenchmarks(pol, null, bol.carrier_name, refDate);
      }

      // Strategy 4: match by POD as POL (single port, PDF put it in wrong field)
      if (benchmarks.length === 0 && pod) {
        benchmarks = await findBenchmarks(pod, null, bol.carrier_name, refDate);
      }

      // Strategy 5: retry ALL strategies WITHOUT date filtering (use closest available rate)
      if (benchmarks.length === 0 && refDate) {
        logInfo(`  → No date-matched rate found, retrying without date filter`);
        benchmarks = await findBenchmarks(pol, pod, bol.carrier_name, null);
        if (benchmarks.length === 0 && pol && pod) {
          benchmarks = await findBenchmarks(pod, pol, bol.carrier_name, null);
        }
        if (benchmarks.length === 0 && pol) {
          benchmarks = await findBenchmarks(pol, null, bol.carrier_name, null);
        }
        if (benchmarks.length === 0 && pod) {
          benchmarks = await findBenchmarks(pod, null, bol.carrier_name, null);
        }
      }

      if (benchmarks.length === 0) {
        logBenchmarkSearch(bol.bol_number, pol, pod, false);
        debugLog.push({ bol: bol.bol_number, pol, pod, refDate, result: 'no match' });
        continue;
      }

      logInfo(`  → Matched benchmark: carrier="${benchmarks[0].carrier_name}" rate20=${benchmarks[0].rate_20gp_usd} rate40=${benchmarks[0].rate_40gp_usd} rate40hc=${benchmarks[0].rate_40hc_usd}`);

      const rate = benchmarks[0];

      // Use explicit container_type if set on the BOL
      let benchmarkRate: number | null = null;
      let containerType = bol.container_type || '';

      if (containerType === '40HC') {
        benchmarkRate = parseFloat(rate.rate_40hc_usd) || null;
      } else if (containerType === '40GP') {
        benchmarkRate = parseFloat(rate.rate_40gp_usd) || null;
      } else if (containerType === '20GP') {
        benchmarkRate = parseFloat(rate.rate_20gp_usd) || null;
      }

      // Fallback: try to detect from container numbers text
      if (!benchmarkRate) {
        const containerStr = (typeof bol.container_numbers === 'string' ? bol.container_numbers : JSON.stringify(bol.container_numbers || '')).toLowerCase();
        if (/40\s*h[cq]|high\s*cube/i.test(containerStr)) {
          benchmarkRate = parseFloat(rate.rate_40hc_usd) || null;
          containerType = '40HC';
        } else if (/40/i.test(containerStr)) {
          benchmarkRate = parseFloat(rate.rate_40gp_usd) || null;
          containerType = '40GP';
        } else if (/20/i.test(containerStr)) {
          benchmarkRate = parseFloat(rate.rate_20gp_usd) || null;
          containerType = '20GP';
        }
      }

      // Fallback: pick closest container rate to actual freight
      if (!benchmarkRate) {
        const options = [
          { r: parseFloat(rate.rate_20gp_usd) || 0, t: '20GP' },
          { r: parseFloat(rate.rate_40gp_usd) || 0, t: '40GP' },
          { r: parseFloat(rate.rate_40hc_usd) || 0, t: '40HC' },
        ].filter(o => o.r > 0);

        if (options.length > 0) {
          const closest = options.reduce((a, b) =>
            Math.abs(a.r - freight) < Math.abs(b.r - freight) ? a : b
          );
          benchmarkRate = closest.r;
          containerType = closest.t;
        }
      }

      if (!benchmarkRate || benchmarkRate <= 0) continue;

      const variance = Math.round((freight - benchmarkRate) * 100) / 100;

      await queryOne(
        `UPDATE bol_audits SET
          benchmark_rate_per_kg = $1,
          expected_freight_usd = $2,
          freight_variance_usd = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`,
        [benchmarkRate, Math.round(benchmarkRate * 100) / 100, variance, bol.id]
      );
      updated++;
    }

    logInfo(`Benchmark check completed: ${updated}/${bols.length} BOLs updated`);
    res.json({ message: `Benchmark check completed: ${updated} of ${bols.length} BOLs matched against rates`, updated, total: bols.length, debug: debugLog });
    } catch (err: any) {
      logError('Benchmark check failed', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Benchmark check failed', details: err.message });
    }
  }
);

// ==================== BULK AUDIT ====================

/**
 * POST /api/bol-audit/bulk-audit
 * Bulk approve/reject/flag multiple BOLs at once
 */
router.post(
  '/bulk-audit',
  authenticateToken,
  [
    body('bol_ids').isArray({ min: 1 }).withMessage('At least one BOL ID is required'),
    body('audit_status').isIn(['approved', 'rejected', 'discrepancy']).withMessage('Invalid audit status'),
    body('audit_notes').optional({ nullable: true }).trim(),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const user = (req as any).user;
    const { bol_ids, audit_status, audit_notes } = req.body;

    let updated = 0;
    for (const bolId of bol_ids) {
      const result = await queryOne(
        `UPDATE bol_audits SET
          audit_status = $1,
          audit_notes = COALESCE($2, audit_notes),
          audited_by = $3,
          audited_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 RETURNING id, bol_number`,
        [audit_status, audit_notes || null, userId, bolId]
      );
      if (result) {
        updated++;
        AuditRepository.logAudit(
          userId, user?.username || '', 'audit', 'bol_audit', String(bolId),
          (result as any).bol_number, { audit_status, bulk: true }
        );
      }
    }

    logInfo(`Bulk audit: ${updated}/${bol_ids.length} BOLs set to ${audit_status}`);
    res.json({ message: `${updated} BOL(s) ${audit_status}`, updated });
  })
);

// ==================== CARRIER STATS ====================

/**
 * GET /api/bol-audit/carrier-stats
 * Carrier scorecards: aggregate cost protection data per carrier
 */
router.get(
  '/carrier-stats',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const month = parseMonth(req.query.month as string);
    let whereClause = '';
    const params: any[] = [];
    if (month) {
      whereClause = `WHERE ${BOL_DATE_COL} >= $1 AND ${BOL_DATE_COL} <= $2`;
      params.push(month.monthStart, month.monthEnd);
    }

    const rows = await queryAll(`
      SELECT
        carrier_name,
        COUNT(*) as total_bols,
        COALESCE(SUM(freight_charges_usd), 0) as total_freight,
        COUNT(CASE WHEN freight_variance_usd > 0 THEN 1 END) as overcharge_count,
        COUNT(CASE WHEN freight_variance_usd < 0 THEN 1 END) as undercharge_count,
        COALESCE(SUM(CASE WHEN freight_variance_usd > 0 THEN freight_variance_usd ELSE 0 END), 0) as total_overcharges,
        COALESCE(SUM(CASE WHEN freight_variance_usd < 0 THEN ABS(freight_variance_usd) ELSE 0 END), 0) as total_undercharges,
        COALESCE(AVG(freight_variance_usd), 0) as avg_variance,
        COALESCE(AVG(CASE WHEN freight_charges_usd > 0 AND benchmark_rate_per_kg > 0
          THEN ((freight_charges_usd - benchmark_rate_per_kg) / benchmark_rate_per_kg * 100)
          ELSE NULL END), 0) as avg_variance_pct,
        COUNT(CASE WHEN weight_variance_pct IS NOT NULL AND ABS(weight_variance_pct) > 5 THEN 1 END) as weight_discrepancies,
        COUNT(CASE WHEN is_duplicate THEN 1 END) as duplicates,
        COUNT(CASE WHEN audit_status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN audit_status = 'discrepancy' THEN 1 END) as discrepancy_count
      FROM bol_audits
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} carrier_name IS NOT NULL AND carrier_name != ''
      GROUP BY carrier_name
      ORDER BY total_freight DESC
    `, params);

    res.json({ data: rows });
  })
);

// ==================== AUDIT HISTORY ====================

/**
 * GET /api/bol-audit/:id/history
 * Get audit history/timeline for a specific BOL
 */
router.get(
  '/:id/history',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await queryAll(
      `SELECT al.*, u.username
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = 'bol_audit' AND al.entity_id = $1
       ORDER BY al.created_at ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  })
);

// ==================== CLEARING AGENT INVOICES & BENCHMARKS ====================

import { parseClearingInvoice, parseAgxRateSheet } from '../services/clearingInvoiceParser.ts';

/**
 * GET /api/bol-audit/clearing-benchmarks
 * List clearing agent rate benchmarks
 */
router.get(
  '/clearing-benchmarks',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await queryAll(
      `SELECT * FROM clearing_rate_benchmarks ORDER BY category, description`
    );
    res.json({ data: rows });
  })
);

/**
 * POST /api/bol-audit/clearing-benchmarks
 * Create a clearing rate benchmark
 */
router.post(
  '/clearing-benchmarks',
  authenticateToken,
  [
    body('description').trim().notEmpty(),
    body('unit_rate_zar').isFloat({ min: 0 }),
    body('per_type').optional().trim(),
    body('category').optional().trim(),
    body('agent_name').optional().trim(),
    body('route').optional({ nullable: true }).trim(),
    body('valid_from').optional({ nullable: true }).isISO8601(),
    body('valid_until').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { description, unit_rate_zar, per_type, category, agent_name, route, valid_from, valid_until, notes } = req.body;
    const userId = (req as any).user?.id;
    const result = await queryOne(
      `INSERT INTO clearing_rate_benchmarks (description, unit_rate_zar, per_type, category, agent_name, route, valid_from, valid_until, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [description, unit_rate_zar, per_type || 'per container', category || 'destination', agent_name || 'AGX', route || null, valid_from || null, valid_until || null, notes || null, userId]
    );
    res.status(201).json({ data: result });
  })
);

/**
 * PUT /api/bol-audit/clearing-benchmarks/:benchmarkId
 */
router.put(
  '/clearing-benchmarks/:benchmarkId',
  authenticateToken,
  [param('benchmarkId').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { description, unit_rate_zar, per_type, category, agent_name, route, valid_from, valid_until, notes } = req.body;
    const result = await queryOne(
      `UPDATE clearing_rate_benchmarks SET
        description = COALESCE($1, description), unit_rate_zar = COALESCE($2, unit_rate_zar),
        per_type = COALESCE($3, per_type), category = COALESCE($4, category),
        agent_name = COALESCE($5, agent_name), route = $6,
        valid_from = $7, valid_until = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [description, unit_rate_zar, per_type, category, agent_name, route || null, valid_from || null, valid_until || null, notes || null, req.params.benchmarkId]
    );
    if (!result) return res.status(404).json({ error: 'Benchmark not found' });
    res.json({ data: result });
  })
);

/**
 * DELETE /api/bol-audit/clearing-benchmarks/:benchmarkId
 */
router.delete(
  '/clearing-benchmarks/:benchmarkId',
  authenticateToken,
  [param('benchmarkId').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await queryOne('DELETE FROM clearing_rate_benchmarks WHERE id = $1 RETURNING id', [req.params.benchmarkId]);
    if (!result) return res.status(404).json({ error: 'Benchmark not found' });
    res.json({ message: 'Clearing benchmark deleted' });
  })
);

/**
 * POST /api/bol-audit/clearing-benchmarks/upload
 * Upload AGX rate sheet PDF and import clearing rate benchmarks
 */
router.post(
  '/clearing-benchmarks/upload',
  (req: Request, res: Response, next: NextFunction) => {
    pdfUpload.single('pdf')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: `Upload failed: ${err.message}` });
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'PDF file is required.' });

      const userId = (req as any).user?.id;
      logInfo(`Parsing clearing rate sheet: ${req.file.originalname}`);
      const entries = await parseAgxRateSheet(req.file.buffer);

      if (entries.length === 0) {
        return res.status(400).json({ error: 'No rate entries found in the PDF.' });
      }

      // Insert/update each entry
      let imported = 0;
      for (const entry of entries) {
        await queryOne(
          `INSERT INTO clearing_rate_benchmarks (description, unit_rate_zar, per_type, category, agent_name, route, created_by)
           VALUES ($1, $2, $3, $4, 'AGX', $5, $6)
           ON CONFLICT DO NOTHING`,
          [entry.description, entry.unit_rate_zar, entry.per_type, entry.category, entry.route, userId]
        );
        imported++;
      }

      logInfo(`Clearing rate sheet imported: ${imported} entries from ${req.file.originalname}`);
      res.json({ message: `${imported} clearing rate benchmarks imported`, data: entries });
    } catch (err: any) {
      logError('Rate sheet upload failed', { error: err.message });
      res.status(500).json({ error: 'Failed to process rate sheet', details: err.message });
    }
  }
);

/**
 * POST /api/bol-audit/upload-clearing-invoice
 * Upload a clearing agent invoice PDF, parse it, match to BOL, audit against benchmarks
 */
router.post(
  '/upload-clearing-invoice',
  (req: Request, res: Response, next: NextFunction) => {
    pdfUpload.single('pdf')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: `Upload failed: ${err.message}` });
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'PDF file is required.' });

      const userId = (req as any).user?.id;
      logInfo(`Parsing clearing invoice: ${req.file.originalname}`);
      const invoice = await parseClearingInvoice(req.file.buffer);

      // Match to BOL
      const bolNumber = invoice.mobl || invoice.hobl;
      if (!bolNumber) {
        return res.status(400).json({ error: 'Could not extract a BOL number from the clearing invoice.', extracted: invoice });
      }

      let bol = await queryOne(
        `SELECT * FROM bol_audits WHERE bol_number = $1 ORDER BY created_at DESC LIMIT 1`,
        [bolNumber]
      );
      if (!bol) {
        bol = await queryOne(
          `SELECT * FROM bol_audits WHERE bol_number ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
          [`%${bolNumber}%`]
        );
      }

      if (!bol) {
        return res.status(404).json({
          error: `No matching BOL found for "${bolNumber}". Upload the BOL PDF first.`,
          extracted: invoice,
        });
      }

      const bolId = (bol as any).id;

      // Check for duplicate invoice
      const existingInv = await queryOne(
        `SELECT id FROM bol_invoices WHERE invoice_number = $1 AND bol_audit_id = $2`,
        [invoice.invoice_number, bolId]
      );
      if (existingInv) {
        return res.status(409).json({ error: `Invoice ${invoice.invoice_number} has already been uploaded for this BOL.` });
      }

      // Insert invoice record
      const invResult = await queryOne(
        `INSERT INTO bol_invoices (
          bol_audit_id, invoice_number, invoice_type, agent_name, account_no, file_ref,
          invoice_date, due_date, subtotal, vat, total, raw_text, pdf_filename,
          matched_bol_number, importer, vessel, mobl, hobl, container_numbers, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [
          bolId, invoice.invoice_number, 'clearing', 'AGX', invoice.account_no, invoice.file_ref,
          invoice.invoice_date, invoice.due_date, invoice.subtotal, invoice.vat, invoice.total,
          invoice.raw_text, req.file.originalname,
          bolNumber, invoice.importer, invoice.vessel, invoice.mobl, invoice.hobl,
          invoice.container_numbers.length > 0 ? JSON.stringify(invoice.container_numbers) : null,
          userId,
        ]
      );

      const invoiceId = (invResult as any).id;

      // Insert line items and audit each against clearing benchmarks
      let totalVariance = 0;
      const lineResults: any[] = [];

      // Synonym map: invoice description keywords → benchmark description keywords
      const DESCRIPTION_SYNONYMS: Record<string, string[]> = {
        'UNPACK / REPACK': ['UNPACK / RELOAD'],
        'UNPACK / RELOAD': ['UNPACK / REPACK'],
        'CARTAGE': ['TRANSPORT', 'LOCAL CARTAGE'],
        'TRANSPORT': ['CARTAGE', 'LOCAL CARTAGE'],
        'IMPORT CLEARANCE FEE': ['CUSTOMS DECLARATION'],
        'CUSTOMS DECLARATION': ['IMPORT CLEARANCE FEE'],
        'CLEARANCE FEE': ['CUSTOMS DECLARATION'],
        'CARGO DUES': ['CARGO DUES 20FT', 'CARGO DUES 40FT'], // size resolved below
        'HANDLING': ['HANDLING/RELEASE COSTS'],
        'RELEASE': ['HANDLING/RELEASE COSTS'],
        'WMS': ['WMS LOGGING'],
        'STORAGE': ['STORAGE PER PALLET'],
        'UNPACKING': ['CONTAINER UNPACKING CHARGES'],
      };

      // Pass-through charges that don't have benchmarks (billed at cost)
      const PASSTHROUGH_CHARGES = ['LANDSIDE CHARGES', 'SEAL', 'DO FEE', 'DETENTION', 'CUSTOMS VAT', 'CUSTOMS DUTY'];

      // City/port abbreviation expansions for route matching
      const ROUTE_ABBREVIATIONS: Record<string, string[]> = {
        'PTA': ['PRETORIA'],
        'PRETORIA': ['PTA'],
        'DBN': ['DURBAN'],
        'DURBAN': ['DBN'],
        'CPT': ['CAPE TOWN'],
        'CAPE TOWN': ['CPT'],
        'WHS': ['WAREHOUSE'],
        'WAREHOUSE': ['WHS'],
      };

      // Load all benchmarks once for this invoice
      const allBenchmarks = await queryAll(
        `SELECT * FROM clearing_rate_benchmarks ORDER BY updated_at DESC`
      );

      for (const charge of invoice.charges) {
        // Normalize: strip parenthetical rate info like "- (R5430.00/cnt)"
        const normalizedDesc = charge.description
          .replace(/\s*-\s*\(R[\d,.]+\/\w+\)/g, '')
          .replace(/\s*\(.*?\)/g, '')
          .trim()
          .toUpperCase();

        // Check if this is a pass-through charge (no benchmark expected)
        const isPassthrough = PASSTHROUGH_CHARGES.some(p => normalizedDesc.includes(p));

        // Find matching benchmark using multi-strategy approach
        let benchmark: any = null;

        if (!isPassthrough) {
          // Strategy 1: Direct ILIKE match
          benchmark = allBenchmarks.find((b: any) => {
            const bd = (b.description as string).toUpperCase();
            return bd.includes(normalizedDesc) || normalizedDesc.includes(bd);
          });

          // Strategy 2: Route-aware match with abbreviation expansion
          // e.g., "CARTAGE: DBN to PTA" → "TRANSPORT: DBN PORT TO PRETORIA PER 20FT"
          if (!benchmark && normalizedDesc.includes(':')) {
            const routePart = normalizedDesc.split(':').slice(1).join(':').trim();
            if (routePart.length > 3) {
              // Extract route keywords and expand abbreviations
              const routeWords = routePart.split(/[\s]+/).filter(w => w.length >= 2);
              const expandedWords = new Set<string>();
              for (const w of routeWords) {
                expandedWords.add(w.toUpperCase());
                const expansions = ROUTE_ABBREVIATIONS[w.toUpperCase()];
                if (expansions) expansions.forEach(e => expandedWords.add(e.toUpperCase()));
              }

              // Match benchmarks that contain at least 2 route keywords (original or expanded)
              let bestMatch: any = null;
              let bestScore = 0;
              for (const b of allBenchmarks) {
                const bd = (b.description as string).toUpperCase();
                let score = 0;
                for (const w of expandedWords) {
                  if (bd.includes(w)) score++;
                }
                if (score >= 2 && score > bestScore) {
                  bestScore = score;
                  bestMatch = b;
                }
              }
              benchmark = bestMatch;
            }
          }

          // Strategy 3: Synonym mapping
          if (!benchmark) {
            for (const [key, synonyms] of Object.entries(DESCRIPTION_SYNONYMS)) {
              if (normalizedDesc.includes(key)) {
                for (const syn of synonyms) {
                  benchmark = allBenchmarks.find((b: any) =>
                    (b.description as string).toUpperCase().includes(syn)
                  );
                  if (benchmark) break;
                }
                if (benchmark) break;
              }
            }
          }

          // Strategy 4: Keyword overlap — match if 2+ significant words overlap
          if (!benchmark) {
            const stopWords = new Set(['PER', 'TO', 'THE', 'A', 'AN', 'OF', 'AND', 'OR', 'FOR', 'AT', 'IN', 'ON']);
            const descWords = normalizedDesc.split(/[\s\/\-:]+/).filter(w => w.length > 2 && !stopWords.has(w));
            let bestMatch: any = null;
            let bestOverlap = 0;
            for (const b of allBenchmarks) {
              const bWords = ((b as any).description as string).toUpperCase().split(/[\s\/\-:]+/).filter(w => w.length > 2 && !stopWords.has(w));
              const overlap = descWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw))).length;
              if (overlap >= 2 && overlap > bestOverlap) {
                bestOverlap = overlap;
                bestMatch = b;
              }
            }
            benchmark = bestMatch;
          }
        }

          // Strategy 5: For size-variant benchmarks (CARGO DUES, CARTAGE with tonnage),
          // if multiple benchmarks match, pick the one closest to the invoice amount
          if (benchmark && charge.local_amount) {
            const benchDesc = ((benchmark as any).description as string).toUpperCase();
            // Check if there are multiple size variants for this category
            if (benchDesc.includes('CARGO DUES') || benchDesc.includes('CARTAGE') || benchDesc.includes('TRANSPORT')) {
              const baseDesc = benchDesc.replace(/\s*(20FT|40FT|PER\s+20FT|PER\s+40FT|<\s*20\s*TON|21-28\s*TON|SUPERLINK|TAUTLINER\s*[AB]|6M\s*DECKSPACE|12M\s*DECKSPACE).*$/i, '').trim();
              const variants = allBenchmarks.filter((b: any) =>
                (b.description as string).toUpperCase().startsWith(baseDesc) ||
                (b.description as string).toUpperCase().includes(baseDesc)
              );
              if (variants.length > 1) {
                // Pick the variant whose rate is closest to the invoice amount
                let closestVariant = benchmark;
                let closestDiff = Math.abs(charge.local_amount - parseFloat((benchmark as any).unit_rate_zar));
                for (const v of variants) {
                  const diff = Math.abs(charge.local_amount - parseFloat((v as any).unit_rate_zar));
                  if (diff < closestDiff) {
                    closestDiff = diff;
                    closestVariant = v;
                  }
                }
                benchmark = closestVariant;
              }
            }
          }

        let benchmarkRate: number | null = null;
        let varianceAmount: number | null = null;
        let variancePct: number | null = null;
        let benchmarkId: number | null = null;

        if (benchmark && charge.local_amount) {
          benchmarkRate = parseFloat((benchmark as any).unit_rate_zar);
          benchmarkId = (benchmark as any).id;

          // Special handling for agency fee (percentage-based: 3.5% of cargo value, min R1,187)
          const isAgencyFee = (benchmark as any).description.toUpperCase().includes('AGENCY FEE');
          if (isAgencyFee) {
            // Agency fee benchmark is the minimum; if invoice amount > minimum, it's likely
            // the percentage-based fee which is correct. Only flag if below minimum.
            // We can't calculate 3.5% without cargo value, so accept amounts >= minimum as OK.
            if (charge.local_amount >= benchmarkRate) {
              // Fee is at or above minimum — acceptable (likely percentage-based)
              varianceAmount = 0;
              variancePct = 0;
            } else {
              // Below minimum — flag it
              varianceAmount = charge.local_amount - benchmarkRate;
              variancePct = ((charge.local_amount - benchmarkRate) / benchmarkRate) * 100;
            }
          } else {
            varianceAmount = charge.local_amount - benchmarkRate;
            variancePct = benchmarkRate > 0 ? ((charge.local_amount - benchmarkRate) / benchmarkRate) * 100 : null;
          }
          totalVariance += varianceAmount;
        }

        const lineResult = await queryOne(
          `INSERT INTO bol_invoice_line_items (
            bol_invoice_id, description, vat_code, roe, foreign_amount, local_amount, vat_amount,
            benchmark_rate, variance_amount, variance_pct, benchmark_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            invoiceId, charge.description, charge.vat_code, charge.roe,
            charge.foreign_amount, charge.local_amount, charge.vat_amount,
            benchmarkRate, varianceAmount, variancePct, benchmarkId,
          ]
        );
        lineResults.push(lineResult);
      }

      // Update invoice with total variance and audit status
      const auditStatus = totalVariance > 100 ? 'discrepancy' : 'approved';
      await queryOne(
        `UPDATE bol_invoices SET total_variance = $1, audit_status = $2 WHERE id = $3`,
        [totalVariance, auditStatus, invoiceId]
      );

      AuditRepository.logAudit(
        userId, (req as any).user?.username || '', 'clearing_invoice', 'bol_audit',
        String(bolId), bolNumber,
        { invoice_number: invoice.invoice_number, total: invoice.total, charges: invoice.charges.length, total_variance: totalVariance }
      );

      logInfo(`Clearing invoice ${invoice.invoice_number} linked to BOL ${bolNumber}: ${invoice.charges.length} charges, total R${invoice.total}, variance R${totalVariance.toFixed(2)}`);

      res.json({
        data: { ...invResult, line_items: lineResults },
        invoice: {
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          charges_count: invoice.charges.length,
          total_variance: totalVariance,
          audit_status: auditStatus,
          matched_bol: bolNumber,
        },
        message: `Clearing invoice matched to BOL ${bolNumber}. ${invoice.charges.length} charges audited. Total: R${invoice.total?.toLocaleString() || 'N/A'}. Variance: R${totalVariance.toFixed(2)}`,
      });
    } catch (err: any) {
      logError('Clearing invoice upload failed', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to process clearing invoice', details: err.message });
    }
  }
);

/**
 * GET /api/bol-audit/invoices/:bolId
 * Get all invoices linked to a specific BOL
 */
router.get(
  '/invoices/:bolId',
  authenticateToken,
  [param('bolId').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const invoices = await queryAll(
      `SELECT * FROM bol_invoices WHERE bol_audit_id = $1 ORDER BY created_at DESC`,
      [req.params.bolId]
    );

    // Fetch line items for each invoice
    for (const inv of invoices) {
      const items = await queryAll(
        `SELECT li.*, cb.description as benchmark_description
         FROM bol_invoice_line_items li
         LEFT JOIN clearing_rate_benchmarks cb ON li.benchmark_id = cb.id
         WHERE li.bol_invoice_id = $1
         ORDER BY li.id`,
        [(inv as any).id]
      );
      (inv as any).line_items = items;
    }

    res.json({ data: invoices });
  })
);

// ==================== PARAMETERIZED ROUTES (must be last) ====================

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
      description_of_goods, container_numbers, container_type, gross_weight_kg, volume_cbm,
      number_of_packages, freight_charges_usd, declared_value_usd,
      issue_date, ship_on_board_date, notify_party, payment_terms, incoterm, notes
    } = req.body;

    const result = await queryOne(
      `INSERT INTO bol_audits (
        bol_number, shipment_id, supplier_name, carrier_name, vessel_name,
        voyage_number, port_of_loading, port_of_discharge, consignee, shipper,
        description_of_goods, container_numbers, container_type, gross_weight_kg, volume_cbm,
        number_of_packages, freight_charges_usd, declared_value_usd,
        issue_date, ship_on_board_date, notify_party, payment_terms, incoterm,
        notes, created_by, audit_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, 'pending'
      ) RETURNING *`,
      [
        bol_number, shipment_id || null, supplier_name || null, carrier_name || null,
        vessel_name || null, voyage_number || null, port_of_loading || null,
        port_of_discharge || null, consignee || null, shipper || null,
        description_of_goods || null, container_numbers ? JSON.stringify(container_numbers) : null,
        container_type || null, gross_weight_kg || null, volume_cbm || null, number_of_packages || null,
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
      description_of_goods, container_numbers, container_type, gross_weight_kg, volume_cbm,
      number_of_packages, freight_charges_usd, declared_value_usd,
      issue_date, ship_on_board_date, notify_party, payment_terms, incoterm, notes,
      benchmark_rate_per_kg
    } = req.body;

    // If benchmark rate was provided, recalculate expected freight and variance
    const hasBenchmark = benchmark_rate_per_kg !== undefined && benchmark_rate_per_kg !== '';
    const benchmarkRate = hasBenchmark ? (parseFloat(benchmark_rate_per_kg) || null) : null;
    const freightVal = freight_charges_usd ? parseFloat(freight_charges_usd) : null;
    const expectedFreight = benchmarkRate ? Math.round(benchmarkRate * 100) / 100 : null;
    const freightVariance = (freightVal && benchmarkRate)
      ? Math.round((freightVal - benchmarkRate) * 100) / 100
      : null;

    const result = await queryOne(
      `UPDATE bol_audits SET
        bol_number = COALESCE($1, bol_number),
        shipment_id = $2, supplier_name = $3, carrier_name = $4,
        vessel_name = $5, voyage_number = $6, port_of_loading = $7,
        port_of_discharge = $8, consignee = $9, shipper = $10,
        description_of_goods = $11, container_numbers = $12,
        container_type = $13, gross_weight_kg = $14, volume_cbm = $15,
        number_of_packages = $16, freight_charges_usd = $17, declared_value_usd = $18,
        issue_date = $19, ship_on_board_date = $20, notify_party = $21,
        payment_terms = $22, incoterm = $23, notes = $24,
        benchmark_rate_per_kg = CASE WHEN $26 THEN $27 ELSE benchmark_rate_per_kg END,
        expected_freight_usd = CASE WHEN $26 THEN $28 ELSE expected_freight_usd END,
        freight_variance_usd = CASE WHEN $26 THEN $29 ELSE freight_variance_usd END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $25 RETURNING *`,
      [
        bol_number, shipment_id || null, supplier_name || null, carrier_name || null,
        vessel_name || null, voyage_number || null, port_of_loading || null,
        port_of_discharge || null, consignee || null, shipper || null,
        description_of_goods || null, container_numbers ? JSON.stringify(container_numbers) : null,
        container_type || null, gross_weight_kg || null, volume_cbm || null,
        number_of_packages || null, freight_charges_usd || null, declared_value_usd || null,
        issue_date || null, ship_on_board_date || null, notify_party || null,
        payment_terms || null, incoterm || null, notes || null, id,
        hasBenchmark, benchmarkRate, expectedFreight, freightVariance,
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
  (req: Request, res: Response, next: NextFunction) => {
    pdfUpload.single('pdf')(req, res, (err: any) => {
      if (err) {
        logError('Multer upload error', { error: err.message, code: err.code });
        return res.status(400).json({ error: `Upload failed: ${err.message}` });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'PDF file is required. Ensure field name is "pdf".' });
      }

      const userId = (req as any).user?.id;
      const user = (req as any).user;

      // 1. Extract data from PDF
      logInfo(`Parsing BOL PDF: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)}KB)`);
      const extracted = await parseBolPdf(req.file.buffer);

      // 2. Auto-audit against shipments
      const auditResult = await autoAuditBol(extracted);

      // 3. Block exact duplicates (same BOL number + same filename)
      if (auditResult.cost_protection.is_duplicate) {
        const dupFinding = auditResult.findings.find((f: any) => f.field === 'bol_number' && f.existing_filenames);
        const existingFiles: string[] = dupFinding?.existing_filenames || [];
        if (existingFiles.includes(req.file.originalname)) {
          // Fetch the existing BOL's date so the user knows where to find it
          const existingBol = dupFinding?.shipment_value
            ? await queryOne(`SELECT id, COALESCE(ship_on_board_date, issue_date) as bol_date FROM bol_audits WHERE id = $1`, [dupFinding.shipment_value])
            : null;
          const dateHint = existingBol?.bol_date
            ? `. It is in ${new Date(existingBol.bol_date).toLocaleString('default', { month: 'long', year: 'numeric' })} — switch month filter to view it`
            : '. It may have no date set — try clearing the month filter or check all months';
          return res.status(409).json({
            error: `Exact duplicate: BOL "${extracted.bol_number}" from file "${req.file.originalname}" has already been uploaded${dateHint}`,
            existing_id: dupFinding?.shipment_value,
            existing_date: existingBol?.bol_date || null,
          });
        }
        // BOL number exists but from a different file — allow but escalate to discrepancy
        auditResult.status = 'discrepancy';
      }

      // 4. Validate date fields (must be valid or null for DATE columns)
      const safeDate = (val: string | null): string | null => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : val;
      };

      // 5. Create BOL record with extracted data + cost protection
      const bolNumber = extracted.bol_number || `IMPORT_${Date.now()}`;
      const cp = auditResult.cost_protection;
      const result = await queryOne(
        `INSERT INTO bol_audits (
          bol_number, shipment_id, supplier_name, carrier_name, vessel_name,
          voyage_number, port_of_loading, port_of_discharge, consignee, shipper,
          description_of_goods, container_numbers, gross_weight_kg, volume_cbm,
          number_of_packages, freight_charges_usd, declared_value_usd,
          issue_date, ship_on_board_date, notify_party, payment_terms, incoterm,
          notes, created_by, audit_status, audit_notes, discrepancies,
          raw_pdf_text, extraction_confidence, pdf_filename,
          benchmark_rate_per_kg, expected_freight_usd, freight_variance_usd,
          weight_variance_kg, weight_variance_pct, is_duplicate
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36
        ) RETURNING *`,
        [
          bolNumber,
          auditResult.matched_shipment?.id || null,
          extracted.supplier_name || null, extracted.carrier_name || null, extracted.vessel_name || null,
          extracted.voyage_number || null, extracted.port_of_loading || null, extracted.port_of_discharge || null,
          extracted.consignee || null, extracted.shipper || null,
          extracted.description_of_goods || null,
          extracted.container_numbers && extracted.container_numbers.length > 0 ? JSON.stringify(extracted.container_numbers) : null,
          extracted.gross_weight_kg || null, extracted.volume_cbm || null, extracted.number_of_packages || null,
          extracted.freight_charges_usd || null, extracted.declared_value_usd || null,
          safeDate(extracted.issue_date), safeDate(extracted.ship_on_board_date),
          extracted.notify_party || null, extracted.payment_terms || null, extracted.incoterm || null,
          `Imported from PDF: ${req.file.originalname}`,
          userId,
          auditResult.status,
          auditResult.findings.length > 0
            ? `Auto-audit score: ${auditResult.score}/100. ${auditResult.findings.filter((f: any) => f.severity === 'error').length} errors, ${auditResult.findings.filter((f: any) => f.severity === 'warning').length} warnings.`
            : null,
          auditResult.findings.length > 0 ? JSON.stringify(auditResult.findings) : null,
          extracted.raw_text || null,
          JSON.stringify(extracted.confidence || {}),
          req.file.originalname,
          cp.benchmark_rate_per_kg, cp.expected_freight_usd, cp.freight_variance_usd,
          cp.weight_variance_kg, cp.weight_variance_pct, cp.is_duplicate,
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
          cost_protection: auditResult.cost_protection,
        },
        message: `BOL imported from PDF. Auto-audit: ${auditResult.status} (score: ${auditResult.score}/100)`,
      });
    } catch (err: any) {
      logError('PDF upload failed', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to process PDF', details: err.message });
    }
  }
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

/**
 * POST /api/bol-audit/upload-forwarding-invoice
 * Upload a forwarding agent invoice PDF (e.g. DHL), parse it, match to an
 * existing BOL by ocean/house BOL number, and update freight_charges_usd
 * plus any other empty fields.
 */
router.post(
  '/upload-forwarding-invoice',
  (req: Request, res: Response, next: NextFunction) => {
    pdfUpload.single('pdf')(req, res, (err: any) => {
      if (err) {
        logError('Forwarding invoice upload error', { error: err.message });
        return res.status(400).json({ error: `Upload failed: ${err.message}` });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'PDF file is required.' });
      }

      const userId = (req as any).user?.id;

      logInfo(`Parsing forwarding invoice: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)}KB)`);
      const invoice = await parseForwardingInvoice(req.file.buffer);

      // Find matching BOL by ocean or house BOL number
      const bolNumber = invoice.ocean_bol_number || invoice.house_bol_number;
      if (!bolNumber) {
        return res.status(400).json({
          error: 'Could not extract a BOL number from the forwarding invoice.',
          extracted: invoice,
        });
      }

      // Try exact match first, then partial match (BOL number contained in DB or vice-versa)
      let existing = await queryOne(
        `SELECT * FROM bol_audits WHERE bol_number = $1 ORDER BY created_at DESC LIMIT 1`,
        [bolNumber]
      );
      if (!existing) {
        existing = await queryOne(
          `SELECT * FROM bol_audits WHERE bol_number ILIKE $1 OR $2 ILIKE '%' || bol_number || '%' ORDER BY created_at DESC LIMIT 1`,
          [`%${bolNumber}%`, bolNumber]
        );
      }

      if (!existing) {
        return res.status(404).json({
          error: `No matching BOL found for "${bolNumber}". Upload the BOL PDF first, then upload the forwarding invoice.`,
          extracted: invoice,
        });
      }

      const bol = existing as any;

      // Build SET clauses — only update fields that are currently empty/null on the BOL
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      const setIfEmpty = (column: string, newValue: any) => {
        if (newValue != null && (bol[column] == null || bol[column] === '' || bol[column] === 0)) {
          updates.push(`${column} = $${paramIdx++}`);
          values.push(newValue);
        }
      };

      // Freight is the primary value — always update if invoice has it, even if BOL has a value
      if (invoice.freight_usd != null) {
        updates.push(`freight_charges_usd = $${paramIdx++}`);
        values.push(invoice.freight_usd);
      }

      // Fill other empty fields from the invoice
      setIfEmpty('vessel_name', invoice.vessel_name);
      setIfEmpty('voyage_number', invoice.voyage_number);
      setIfEmpty('port_of_loading', invoice.origin_port);
      setIfEmpty('port_of_discharge', invoice.destination_port);
      setIfEmpty('shipper', invoice.shipper);
      setIfEmpty('consignee', invoice.consignee);
      setIfEmpty('container_numbers', invoice.container_number ? JSON.stringify([invoice.container_number]) : null);
      setIfEmpty('container_type', invoice.container_type);

      if (updates.length === 0) {
        return res.json({ message: 'No fields to update — BOL already has all data.', data: bol });
      }

      // Add updated_at
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      // Append notes about the forwarding invoice
      updates.push(`notes = COALESCE(notes, '') || $${paramIdx++}`);
      values.push(`\nForwarding invoice ${invoice.invoice_number || req.file.originalname} applied: freight $${invoice.freight_usd || 'N/A'}${invoice.exchange_rate ? ` @ rate ${invoice.exchange_rate}` : ''}`);

      values.push(bol.id);

      const result = await queryOne(
        `UPDATE bol_audits SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        values
      );

      AuditRepository.logAudit(
        userId, (req as any).user?.username || '', 'forwarding_invoice', 'bol_audit',
        String(bol.id), bolNumber,
        { invoice_number: invoice.invoice_number, freight_usd: invoice.freight_usd, filename: req.file.originalname }
      );

      logInfo(`Forwarding invoice applied to BOL ${bolNumber}: freight=$${invoice.freight_usd}`);

      res.json({
        data: result,
        invoice: {
          invoice_number: invoice.invoice_number,
          freight_usd: invoice.freight_usd,
          exchange_rate: invoice.exchange_rate,
          matched_bol: bolNumber,
        },
        message: `Forwarding invoice matched to BOL ${bolNumber}. Freight: $${invoice.freight_usd?.toLocaleString() || 'N/A'}`,
      });
    } catch (err: any) {
      logError('Forwarding invoice upload failed', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to process forwarding invoice', details: err.message });
    }
  }
);

export default router;
