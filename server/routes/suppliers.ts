/**
 * Supplier Routes
 * Handles CRUD operations for suppliers with full type safety
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import SupplierController, {
  type CreateSupplierRequest,
  type UpdateSupplierRequest,
  type SupplierFilterParams
} from '../controllers/SupplierController.js';
import type { BodyRequest } from '../types/api.js';

const router = Router();

/**
 * Validation for create supplier
 */
const validateCreateSupplier = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('country').optional().trim(),
  body('contactPerson').optional().trim(),
  body('paymentTerms').optional().trim()
];

/**
 * Validation for update supplier
 */
const validateUpdateSupplier = [
  body('name').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('country').optional().trim(),
  body('contactPerson').optional().trim(),
  body('paymentTerms').optional().trim(),
  body('performanceRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Performance rating must be between 1 and 5')
];

/**
 * Validation for update rating
 */
const validateRating = [
  body('rating')
    .notEmpty()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
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
 * GET /api/suppliers
 * Get all suppliers with filtering and pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const params: SupplierFilterParams = {
      country: (req.query.country as string) || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      search: (req.query.search as string) || undefined,
      sort: (req.query.sort as string) || undefined
    };

    const result = await SupplierController.getSuppliers(params);

    res.status(200).json({
      data: result.suppliers,
      pagination: result.pagination
    });
  })
);

/**
 * POST /api/suppliers
 * Create new supplier
 */
router.post(
  '/',
  validateCreateSupplier,
  asyncHandler(async (req: BodyRequest<CreateSupplierRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const { name, email, phone, country, contactPerson, paymentTerms } = req.body;

    const supplier = await SupplierController.createSupplier({
      name,
      email,
      phone,
      country,
      contactPerson,
      paymentTerms
    });

    res.status(201).json({
      data: supplier,
      message: 'Supplier created successfully'
    });
  })
);

/**
 * GET /api/suppliers/statistics
 * Get supplier statistics
 */
router.get(
  '/statistics',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await SupplierController.getStatistics();

    res.status(200).json({
      data: stats
    });
  })
);

/**
 * GET /api/suppliers/with-shipments
 * Get suppliers with shipment counts
 */
router.get(
  '/with-shipments',
  asyncHandler(async (_req: Request, res: Response) => {
    const suppliers = await SupplierController.getSuppliersWithShipmentCounts();

    res.status(200).json({
      data: suppliers
    });
  })
);

/**
 * GET /api/suppliers/:id
 * Get single supplier by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const supplier = await SupplierController.getSupplier(req.params.id!);

    res.status(200).json({
      data: supplier
    });
  })
);

/**
 * PUT /api/suppliers/:id
 * Update supplier
 */
router.put(
  '/:id',
  validateUpdateSupplier,
  asyncHandler(async (req: BodyRequest<UpdateSupplierRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const supplier = await SupplierController.updateSupplier(req.params.id!, req.body);

    res.status(200).json({
      data: supplier,
      message: 'Supplier updated successfully'
    });
  })
);

/**
 * PATCH /api/suppliers/:id/rating
 * Update supplier performance rating
 */
router.patch(
  '/:id/rating',
  validateRating,
  asyncHandler(async (req: BodyRequest<{ rating: number }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const supplier = await SupplierController.updateRating(req.params.id!, req.body.rating);

    res.status(200).json({
      data: supplier,
      message: 'Supplier rating updated successfully'
    });
  })
);

/**
 * DELETE /api/suppliers/:id
 * Delete supplier
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await SupplierController.deleteSupplier(req.params.id!);

    res.status(200).json({
      message: 'Supplier deleted successfully'
    });
  })
);

export default router;
