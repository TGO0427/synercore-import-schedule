/**
 * Reports Routes
 * Handles report generation, retrieval, and analytics with full type safety
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import ReportController from '../controllers/ReportController.js';
import type { BodyRequest } from '../types/api.js';
import type { GenerateReportRequest, ReportFilterParams } from '../services/ReportService.js';

const router = Router();

/**
 * Validation for generate report
 */
const validateGenerateReport = [
  body('reportData').notEmpty().withMessage('Report data is required'),
  body('reportType').optional().trim(),
  body('dateRange.start').optional().isISO8601().withMessage('Start date must be valid'),
  body('dateRange.end').optional().isISO8601().withMessage('End date must be valid')
];

/**
 * Validation for report query parameters
 */
const validateReportQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type').optional().trim(),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid'),
  query('search').optional().trim()
];

/**
 * Validation for analytics summary query
 */
const validateAnalyticsSummary = [
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Period must be daily, weekly, or monthly'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation error handler
 */
const handleValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = AppError.unprocessable('Validation failed', {
      fields: errors.array().map((err: any) => ({
        field: err.param || err.path,
        message: err.msg,
        value: err.value
      }))
    });
    res.status(error.statusCode).json(error.toJSON());
    return false;
  }
  return true;
};

/**
 * POST /api/reports/generate
 * Generate a new report
 */
router.post(
  '/generate',
  validateGenerateReport,
  asyncHandler(async (req: BodyRequest<GenerateReportRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const result = await ReportController.generateReport(req.body);

    res.status(201).json(result);
  })
);

/**
 * GET /api/reports
 * Get all reports with filtering and pagination
 */
router.get(
  '/',
  validateReportQuery,
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const params: ReportFilterParams = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      type: (req.query.type as string) || undefined,
      startDate: (req.query.startDate as string) || undefined,
      endDate: (req.query.endDate as string) || undefined,
      search: (req.query.search as string) || undefined
    };

    const result = await ReportController.getReports(params);

    res.status(200).json(result);
  })
);

/**
 * GET /api/reports/analytics/workflow
 * Get workflow analytics for post-arrival shipments
 */
router.get(
  '/analytics/workflow',
  asyncHandler(async (_req: Request, res: Response) => {
    const analytics = await ReportController.getWorkflowAnalytics();

    res.status(200).json(analytics);
  })
);

/**
 * GET /api/reports/analytics/summary
 * Get analytics summary by period
 */
router.get(
  '/analytics/summary',
  validateAnalyticsSummary,
  asyncHandler(async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'weekly';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;

    const summary = await ReportController.getAnalyticsSummary(period, limit);

    res.status(200).json(summary);
  })
);

/**
 * GET /api/reports/:reportId
 * Get specific report by ID
 */
router.get(
  '/:reportId',
  asyncHandler(async (req: Request, res: Response) => {
    const report = await ReportController.getReport(req.params.reportId!);

    res.status(200).json(report);
  })
);

/**
 * DELETE /api/reports/:reportId
 * Delete report by ID
 */
router.delete(
  '/:reportId',
  asyncHandler(async (req: Request, res: Response) => {
    await ReportController.deleteReport(req.params.reportId!);

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  })
);

export default router;
