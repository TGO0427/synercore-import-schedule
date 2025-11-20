/**
 * Quote Routes
 * Handles CRUD operations for quotes with full type safety
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import QuoteController, {
  type CreateQuoteRequest,
  type UpdateQuoteRequest,
  type QuoteFilterParams
} from '../controllers/QuoteController.js';
import type { BodyRequest } from '../types/api.js';

const router = Router();

/**
 * Validation for create quote
 */
const validateCreateQuote = [
  body('supplierId').trim().notEmpty().withMessage('Supplier ID is required'),
  body('productName').trim().notEmpty().withMessage('Product name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('validUntil').optional().isISO8601().withMessage('Valid until must be a valid date')
];

/**
 * Validation for update quote
 */
const validateUpdateQuote = [
  body('productName').optional().trim(),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('validUntil').optional().isISO8601().withMessage('Valid until must be a valid date')
];

/**
 * Validation for update validity
 */
const validateUpdateValidity = [
  body('validUntil')
    .notEmpty()
    .isISO8601()
    .withMessage('Valid until must be a valid date')
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
 * GET /api/quotes
 * Get all quotes with filtering and pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const params: QuoteFilterParams = {
      supplierId: (req.query.supplierId as string) || undefined,
      productName: (req.query.productName as string) || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      search: (req.query.search as string) || undefined,
      active: req.query.active ? req.query.active === 'true' : undefined
    };

    const result = await QuoteController.getQuotes(params);

    res.status(200).json({
      data: result.quotes,
      pagination: result.pagination
    });
  })
);

/**
 * POST /api/quotes
 * Create new quote
 */
router.post(
  '/',
  validateCreateQuote,
  asyncHandler(async (req: BodyRequest<CreateQuoteRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const { supplierId, productName, quantity, price, currency, validUntil } = req.body;

    const quote = await QuoteController.createQuote({
      supplierId,
      productName,
      quantity,
      price,
      currency,
      validUntil: validUntil ? new Date(validUntil) : undefined
    });

    res.status(201).json({
      data: quote,
      message: 'Quote created successfully'
    });
  })
);

/**
 * GET /api/quotes/statistics
 * Get quote statistics
 */
router.get(
  '/statistics',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await QuoteController.getStatistics();

    res.status(200).json({
      data: stats
    });
  })
);

/**
 * GET /api/quotes/active
 * Get all active quotes
 */
router.get(
  '/active',
  asyncHandler(async (_req: Request, res: Response) => {
    const quotes = await QuoteController.getActiveQuotes();

    res.status(200).json({
      data: quotes
    });
  })
);

/**
 * GET /api/quotes/expired
 * Get all expired quotes
 */
router.get(
  '/expired',
  asyncHandler(async (_req: Request, res: Response) => {
    const quotes = await QuoteController.getExpiredQuotes();

    res.status(200).json({
      data: quotes
    });
  })
);

/**
 * GET /api/quotes/with-supplier
 * Get all quotes with supplier info
 */
router.get(
  '/with-supplier',
  asyncHandler(async (_req: Request, res: Response) => {
    const quotes = await QuoteController.getAllWithSupplierInfo();

    res.status(200).json({
      data: quotes
    });
  })
);

/**
 * GET /api/quotes/:id
 * Get single quote by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const quote = await QuoteController.getQuote(req.params.id!);

    res.status(200).json({
      data: quote
    });
  })
);

/**
 * PUT /api/quotes/:id
 * Update quote
 */
router.put(
  '/:id',
  validateUpdateQuote,
  asyncHandler(async (req: BodyRequest<UpdateQuoteRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const updateData: UpdateQuoteRequest = {
      ...req.body,
      validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined
    };

    const quote = await QuoteController.updateQuote(req.params.id!, updateData);

    res.status(200).json({
      data: quote,
      message: 'Quote updated successfully'
    });
  })
);

/**
 * PATCH /api/quotes/:id/validity
 * Update quote validity
 */
router.patch(
  '/:id/validity',
  validateUpdateValidity,
  asyncHandler(async (req: BodyRequest<{ validUntil: string }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const quote = await QuoteController.updateValidity(
      req.params.id!,
      new Date(req.body.validUntil)
    );

    res.status(200).json({
      data: quote,
      message: 'Quote validity updated successfully'
    });
  })
);

/**
 * DELETE /api/quotes/:id
 * Delete quote
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await QuoteController.deleteQuote(req.params.id!);

    res.status(200).json({
      message: 'Quote deleted successfully'
    });
  })
);

export default router;
