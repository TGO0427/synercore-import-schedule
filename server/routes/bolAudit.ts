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
import { parseExcelRateSheet } from '../services/rateSheetParser.ts';

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
        COALESCE(SUM(CASE WHEN audit_status = 'discrepancy' THEN freight_charges_usd ELSE 0 END), 0) as flagged_freight_usd,
        -- Cost protection metrics
        COALESCE(SUM(CASE WHEN freight_variance_usd > 0 THEN freight_variance_usd ELSE 0 END), 0) as total_overcharges_usd,
        COUNT(CASE WHEN freight_variance_usd > 0 THEN 1 END) as overcharge_count,
        COALESCE(SUM(CASE WHEN freight_variance_usd < 0 THEN ABS(freight_variance_usd) ELSE 0 END), 0) as total_undercharges_usd,
        COUNT(CASE WHEN is_duplicate THEN 1 END) as duplicate_count,
        COUNT(CASE WHEN weight_variance_pct IS NOT NULL AND ABS(weight_variance_pct) > 5 THEN 1 END) as weight_discrepancy_count,
        COALESCE(AVG(CASE WHEN freight_charges_usd > 0 AND gross_weight_kg > 0 THEN freight_charges_usd / gross_weight_kg END), 0) as avg_freight_per_kg
      FROM bol_audits
    `);
    res.json({ data: stats });
  })
);

// ==================== FREIGHT BENCHMARK ROUTES ====================
// These MUST be before /:id to prevent Express treating "benchmarks" as an ID

/**
 * GET /api/bol-audit/benchmarks
 * List all freight benchmarks
 */
router.get(
  '/benchmarks',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await queryAll(
      `SELECT * FROM freight_benchmarks ORDER BY port_of_loading, carrier_name, port_of_discharge`
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
 * POST /api/bol-audit/benchmark-check
 * Re-run benchmark comparison on all BOLs (or specific ones)
 * Matches BOL freight charges against imported benchmark rates
 */
router.post(
  '/benchmark-check',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
    const { bol_ids } = req.body; // optional: specific BOL IDs to check

    // Get BOLs to check
    let bols: any[];
    if (bol_ids && Array.isArray(bol_ids) && bol_ids.length > 0) {
      bols = await queryAll(
        `SELECT id, bol_number, port_of_loading, port_of_discharge, carrier_name,
                freight_charges_usd, gross_weight_kg, container_numbers, container_type
         FROM bol_audits WHERE id = ANY($1)`,
        [bol_ids]
      );
    } else {
      bols = await queryAll(
        `SELECT id, bol_number, port_of_loading, port_of_discharge, carrier_name,
                freight_charges_usd, gross_weight_kg, container_numbers, container_type
         FROM bol_audits WHERE freight_charges_usd IS NOT NULL`
      );
    }

    // Helper: find benchmarks matching port conditions
    // Priority: 1) MSC Standard, 2) any other MSC rate, 3) BOL carrier, 4) any carrier
    async function findBenchmarks(pol: string | null, pod: string | null, carrier: string | null): Promise<any[]> {
      const conds: string[] = [];
      const prms: any[] = [];
      let i = 1;
      if (pol) { conds.push(`LOWER(port_of_loading) LIKE LOWER($${i++})`); prms.push(`%${pol.substring(0, 30)}%`); }
      if (pod) { conds.push(`LOWER(port_of_discharge) LIKE LOWER($${i++})`); prms.push(`%${pod.substring(0, 30)}%`); }
      if (conds.length === 0) return [];

      const whereBase = `${conds.join(' AND ')} AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`;
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

      // 4) Any available rate
      return queryAll(
        `SELECT ${cols} FROM freight_benchmarks WHERE ${whereBase} ORDER BY valid_from DESC NULLS LAST LIMIT 5`,
        prms
      );
    }

    let updated = 0;
    for (const bol of bols) {
      const freight = parseFloat(bol.freight_charges_usd);
      if (!freight || freight <= 0) continue;

      const pol = bol.port_of_loading || null;
      const pod = bol.port_of_discharge || null;
      if (!pol && !pod) continue;

      // Strategy 1: exact POL → POD match
      let benchmarks = await findBenchmarks(pol, pod, bol.carrier_name);

      // Strategy 2: swap POL/POD (PDF parser may have reversed them)
      if (benchmarks.length === 0 && pol && pod) {
        benchmarks = await findBenchmarks(pod, pol, bol.carrier_name);
      }

      // Strategy 3: match by POL only (POD might be missing/wrong)
      if (benchmarks.length === 0 && pol) {
        benchmarks = await findBenchmarks(pol, null, bol.carrier_name);
      }

      // Strategy 4: match by POD as POL (single port, PDF put it in wrong field)
      if (benchmarks.length === 0 && pod) {
        benchmarks = await findBenchmarks(pod, null, bol.carrier_name);
      }

      if (benchmarks.length === 0) continue;

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
    res.json({ message: `Benchmark check completed: ${updated} of ${bols.length} BOLs matched against rates`, updated, total: bols.length });
    } catch (err: any) {
      logError('Benchmark check failed', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Benchmark check failed', details: err.message });
    }
  }
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
      issue_date, ship_on_board_date, notify_party, payment_terms, incoterm, notes
    } = req.body;

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

      // 3. Validate date fields (must be valid or null for DATE columns)
      const safeDate = (val: string | null): string | null => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : val;
      };

      // 4. Create BOL record with extracted data + cost protection
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

export default router;
