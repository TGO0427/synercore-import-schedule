/**
 * Shipment Routes
 * Handles CRUD operations for shipments with full type safety
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import ShipmentController, {
  type CreateShipmentRequest,
  type UpdateShipmentRequest,
  type ShipmentFilterParams
} from '../controllers/ShipmentController.js';
import type { BodyRequest } from '../types/api.js';

const router = Router();

/**
 * Validation for create shipment
 */
const validateCreateShipment = [
  body('orderRef').trim().notEmpty().withMessage('Order reference is required'),
  body('supplier').trim().notEmpty().withMessage('Supplier is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('weekNumber').optional().isInt({ min: 1, max: 53 }).withMessage('Week number must be 1-53'),
  body('notes').optional().trim()
];

/**
 * Validation for update shipment
 */
const validateUpdateShipment = [
  body('latestStatus')
    .optional()
    .isIn([
      // Shipping schedule statuses
      'planned_airfreight',
      'planned_seafreight',
      'in_transit_airfreight',
      'in_transit_seafreight',
      'air_customs_clearance',
      'in_transit_roadway',
      'in_transit_seaway',
      'moored',
      'berth_working',
      'berth_complete',
      'arrived_pta',
      'arrived_klm',
      'arrived_offsite',
      'delayed',
      'cancelled',
      // Post-arrival workflow statuses
      'clearing_customs',
      'in_warehouse',
      'unloading',
      'inspection_pending',
      'inspecting',
      'inspection_in_progress',
      'inspection_passed',
      'inspection_failed',
      'receiving_goods',
      'receiving',
      'received',
      'stored',
      'archived'
    ])
    .withMessage('Invalid shipment status'),
  body('notes').optional().trim(),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  // Additional fields that frontend sends during amendment
  body('supplier').optional().trim(),
  body('orderRef').optional().trim(),
  body('finalPod').optional().trim(),
  body('cbm').optional(),
  body('palletQty').optional(),
  body('weekNumber').optional(),
  body('productName').optional().trim(),
  body('receivingWarehouse').optional().trim(),
  body('forwardingAgent').optional().trim(),
  body('vesselName').optional().trim(),
  body('incoterm').optional().trim(),
  body('selectedWeekDate').optional(),
  body('updatedAt').optional()
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
 * GET /api/shipments
 * Get all shipments with filtering and pagination
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const params: ShipmentFilterParams = {
      status: (req.query.status as any) || undefined,
      supplier: (req.query.supplier as string) || undefined,
      weekNumber: req.query.weekNumber ? parseInt(req.query.weekNumber as string, 10) : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      search: (req.query.search as string) || undefined
    };

    const result = await ShipmentController.getShipments(params);

    res.status(200).json({
      data: result.shipments,
      pagination: result.pagination
    });
  })
);

/**
 * POST /api/shipments
 * Create new shipment
 */
router.post(
  '/',
  validateCreateShipment,
  asyncHandler(async (req: BodyRequest<CreateShipmentRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const { orderRef, supplier, quantity, weekNumber, notes } = req.body;

    const shipment = await ShipmentController.createShipment({
      orderRef,
      supplier,
      quantity,
      weekNumber,
      notes
    });

    res.status(201).json({
      data: shipment,
      message: 'Shipment created successfully'
    });
  })
);

/**
 * GET /api/shipments/statistics
 * Get shipment statistics
 */
router.get(
  '/statistics',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await ShipmentController.getStatistics();

    res.status(200).json({
      data: stats
    });
  })
);

/**
 * GET /api/shipments/archives
 * Get archived shipments
 */
router.get(
  '/archives',
  asyncHandler(async (_req: Request, res: Response) => {
    const shipments = await ShipmentController.getArchives();
    res.status(200).json(shipments);
  })
);

/**
 * GET /api/shipments/post-arrival
 * Get post-arrival shipments (shipments that have arrived and are in workflow)
 */
router.get(
  '/post-arrival',
  asyncHandler(async (_req: Request, res: Response) => {
    const shipments = await ShipmentController.getPostArrivalShipments();
    res.status(200).json(shipments);
  })
);

/**
 * GET /api/shipments/:id
 * Get single shipment by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const shipment = await ShipmentController.getShipment(req.params.id!);

    res.status(200).json({
      data: shipment
    });
  })
);

/**
 * PUT /api/shipments/:id
 * Update shipment
 */
router.put(
  '/:id',
  validateUpdateShipment,
  asyncHandler(async (req: BodyRequest<UpdateShipmentRequest>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const shipment = await ShipmentController.updateShipment(req.params.id!, req.body);

    res.status(200).json({
      data: shipment,
      message: 'Shipment updated successfully'
    });
  })
);

/**
 * PATCH /api/shipments/:id/status
 * Update shipment status
 */
router.patch(
  '/:id/status',
  body('status')
    .notEmpty()
    .isIn([
      'planned_airfreight',
      'planned_seafreight',
      'in_transit_airfreight',
      'in_transit_seafreight',
      'arrived_klm',
      'arrived_pta',
      'clearing_customs',
      'in_warehouse',
      'unloading',
      'inspection_pending',
      'inspecting',
      'inspection_in_progress',
      'inspection_passed',
      'inspection_failed',
      'receiving_goods',
      'receiving',
      'received',
      'stored',
      'archived'
    ])
    .withMessage('Invalid shipment status'),
  body('notes').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ status: string; notes?: string }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const shipment = await ShipmentController.updateShipmentStatus(
      req.params.id!,
      req.body.status as any,
      req.body.notes
    );

    res.status(200).json({
      data: shipment,
      message: 'Shipment status updated successfully'
    });
  })
);

/**
 * DELETE /api/shipments/:id
 * Delete shipment
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await ShipmentController.deleteShipment(req.params.id!);

    res.status(200).json({
      message: 'Shipment deleted successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/archive
 * Archive shipment
 */
router.post(
  '/:id/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const shipment = await ShipmentController.archiveShipment(req.params.id!);

    res.status(200).json({
      data: shipment,
      message: 'Shipment archived successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/unarchive
 * Unarchive shipment
 */
router.post(
  '/:id/unarchive',
  asyncHandler(async (req: Request, res: Response) => {
    const shipment = await ShipmentController.unarchiveShipment(req.params.id!);

    res.status(200).json({
      data: shipment,
      message: 'Shipment unarchived successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/start-unloading
 * Start unloading workflow
 */
router.post(
  '/:id/start-unloading',
  asyncHandler(async (req: Request, res: Response) => {
    const shipment = await ShipmentController.startUnloading(req.params.id!);

    res.status(200).json({
      data: shipment,
      message: 'Unloading started successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/complete-unloading
 * Complete unloading workflow
 */
router.post(
  '/:id/complete-unloading',
  asyncHandler(async (req: Request, res: Response) => {
    const shipment = await ShipmentController.completeUnloading(req.params.id!);

    res.status(200).json({
      data: shipment,
      message: 'Unloading completed successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/start-inspection
 * Start inspection workflow
 */
router.post(
  '/:id/start-inspection',
  body('inspectedBy').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ inspectedBy?: string }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const shipment = await ShipmentController.startInspection(
      req.params.id!,
      req.body.inspectedBy
    );

    res.status(200).json({
      data: shipment,
      message: 'Inspection started successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/complete-inspection
 * Complete inspection workflow
 */
router.post(
  '/:id/complete-inspection',
  body('passed').isBoolean().withMessage('passed must be a boolean'),
  body('notes').optional().trim(),
  body('inspectedBy').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ passed: boolean; notes?: string; inspectedBy?: string }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const shipment = await ShipmentController.completeInspection(
      req.params.id!,
      req.body.passed,
      req.body.notes,
      req.body.inspectedBy
    );

    res.status(200).json({
      data: shipment,
      message: 'Inspection completed successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/start-receiving
 * Start receiving workflow
 */
router.post(
  '/:id/start-receiving',
  body('receivedBy').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ receivedBy?: string }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const shipment = await ShipmentController.startReceiving(
      req.params.id!,
      req.body.receivedBy
    );

    res.status(200).json({
      data: shipment,
      message: 'Receiving started successfully'
    });
  })
);

/**
 * POST /api/shipments/:id/complete-receiving
 * Complete receiving workflow
 */
router.post(
  '/:id/complete-receiving',
  body('receivedQuantity').optional().isInt({ min: 0 }).withMessage('Received quantity must be a non-negative integer'),
  body('receivedBy').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ receivedQuantity?: number; receivedBy?: string }>, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const shipment = await ShipmentController.completeReceiving(
      req.params.id!,
      req.body.receivedQuantity,
      req.body.receivedBy
    );

    res.status(200).json({
      data: shipment,
      message: 'Receiving completed successfully'
    });
  })
);

export default router;
