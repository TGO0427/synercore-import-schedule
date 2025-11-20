/**
 * Warehouse Capacity Routes
 * Handles warehouse capacity operations with full type safety
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import WarehouseController, {
  type CreateWarehouseRequest,
  type UpdateWarehouseRequest
} from '../controllers/WarehouseController.js';
import type { BodyRequest } from '../types/api.js';

const router = Router();

/**
 * Validation for create warehouse
 */
const validateCreateWarehouse = [
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('totalCapacity')
    .isInt({ min: 0 })
    .withMessage('Total capacity must be a non-negative integer'),
  body('availableBins')
    .isInt({ min: 0 })
    .withMessage('Available bins must be a non-negative integer')
];

/**
 * Validation for update warehouse
 */
const validateUpdateWarehouse = [
  body('totalCapacity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total capacity must be a non-negative integer'),
  body('availableBins')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Available bins must be a non-negative integer'),
  body('usedCapacity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Used capacity must be a non-negative integer')
];

/**
 * Validation for available bins update
 */
const validateAvailableBins = [
  body('availableBins')
    .notEmpty()
    .isInt({ min: 0 })
    .withMessage('Available bins must be a non-negative integer')
];

/**
 * Validation for used capacity update
 */
const validateUsedCapacity = [
  body('usedCapacity')
    .notEmpty()
    .isInt({ min: 0 })
    .withMessage('Used capacity must be a non-negative integer')
];

/**
 * Validation for total capacity update
 */
const validateTotalCapacity = [
  body('totalCapacity')
    .notEmpty()
    .isInt({ min: 0 })
    .withMessage('Total capacity must be a non-negative integer')
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
 * GET /api/warehouses
 * Get all warehouses
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await WarehouseController.getWarehouses();

    res.status(200).json({
      data: result.warehouses
    });
  })
);

/**
 * POST /api/warehouses
 * Create new warehouse
 */
router.post(
  '/',
  validateCreateWarehouse,
  asyncHandler(async (req: BodyRequest<CreateWarehouseRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const { location, totalCapacity, availableBins } = req.body;

    const warehouse = await WarehouseController.createWarehouse({
      location,
      totalCapacity,
      availableBins
    });

    res.status(201).json({
      data: warehouse,
      message: 'Warehouse created successfully'
    });
  })
);

/**
 * GET /api/warehouses/statistics
 * Get warehouse statistics
 */
router.get(
  '/statistics',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await WarehouseController.getStatistics();

    res.status(200).json({
      data: stats
    });
  })
);

/**
 * GET /api/warehouses/history/all
 * Get all warehouse history (admin only)
 */
router.get(
  '/history/all',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const history = await WarehouseController.getHistory(undefined, limit);

    res.status(200).json({
      data: history
    });
  })
);

/**
 * GET /api/warehouses/:id
 * Get single warehouse by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const warehouse = await WarehouseController.getWarehouse(req.params.id!);

    res.status(200).json({
      data: warehouse
    });
  })
);

/**
 * GET /api/warehouses/:id/utilization
 * Get warehouse utilization
 */
router.get(
  '/:id/utilization',
  asyncHandler(async (req: Request, res: Response) => {
    const utilization = await WarehouseController.getUtilization(req.params.id!);

    res.status(200).json({
      data: utilization
    });
  })
);

/**
 * GET /api/warehouses/:id/history
 * Get warehouse history
 */
router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const history = await WarehouseController.getHistory(req.params.id, limit);

    res.status(200).json({
      data: history
    });
  })
);

/**
 * PUT /api/warehouses/:id
 * Update warehouse
 */
router.put(
  '/:id',
  validateUpdateWarehouse,
  asyncHandler(async (req: BodyRequest<UpdateWarehouseRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const warehouse = await WarehouseController.updateWarehouse(req.params.id!, req.body);

    res.status(200).json({
      data: warehouse,
      message: 'Warehouse updated successfully'
    });
  })
);

/**
 * PATCH /api/warehouses/:id/available-bins
 * Update available bins
 */
router.patch(
  '/:id/available-bins',
  validateAvailableBins,
  asyncHandler(async (req: BodyRequest<{ availableBins: number }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const warehouse = await WarehouseController.updateAvailableBins(
      req.params.id!,
      req.body.availableBins
    );

    res.status(200).json({
      data: warehouse,
      message: 'Available bins updated successfully'
    });
  })
);

/**
 * PATCH /api/warehouses/:id/used-capacity
 * Update used capacity
 */
router.patch(
  '/:id/used-capacity',
  validateUsedCapacity,
  asyncHandler(async (req: BodyRequest<{ usedCapacity: number }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const warehouse = await WarehouseController.updateUsedCapacity(
      req.params.id!,
      req.body.usedCapacity
    );

    res.status(200).json({
      data: warehouse,
      message: 'Used capacity updated successfully'
    });
  })
);

/**
 * PATCH /api/warehouses/:id/total-capacity
 * Update total capacity
 */
router.patch(
  '/:id/total-capacity',
  validateTotalCapacity,
  asyncHandler(async (req: BodyRequest<{ totalCapacity: number }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const warehouse = await WarehouseController.updateTotalCapacity(
      req.params.id!,
      req.body.totalCapacity
    );

    res.status(200).json({
      data: warehouse,
      message: 'Total capacity updated successfully'
    });
  })
);

/**
 * DELETE /api/warehouses/:id
 * Delete warehouse
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await WarehouseController.deleteWarehouse(req.params.id!);

    res.status(200).json({
      message: 'Warehouse deleted successfully'
    });
  })
);

export default router;
