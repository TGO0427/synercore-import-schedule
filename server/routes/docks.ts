/**
 * Dock & Truck Arrival Routes
 * Handles dock management and truck check-in/check-out workflows
 */

import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler.ts';
import DockController from '../controllers/DockController.js';
import type { BodyRequest } from '../types/api.js';

const router = Router();

// ─── Dock Routes ───

/**
 * GET /api/docks
 * List all docks, optionally filtered by warehouse
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const warehouse = req.query.warehouse as string | undefined;
    const docks = await DockController.getDocks(warehouse);
    res.json(docks);
  })
);

/**
 * GET /api/docks/metrics
 * Get dock utilization metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const { warehouse, startDate, endDate } = req.query as Record<string, string>;
    const metrics = await DockController.getMetrics(warehouse, startDate, endDate);
    res.json(metrics);
  })
);

/**
 * PUT /api/docks/:id
 * Update dock (e.g., set to maintenance mode)
 */
router.put(
  '/:id',
  body('status').optional().isIn(['available', 'occupied', 'maintenance']),
  body('notes').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ status?: string; notes?: string }>, res: Response) => {
    const dock = await DockController.updateDock(parseInt(req.params.id!, 10), req.body);
    res.json(dock);
  })
);

// ─── Truck Arrival Routes ───

/**
 * GET /api/docks/trucks
 * List truck arrivals with optional filters
 */
router.get(
  '/trucks',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, warehouse, date } = req.query as Record<string, string>;
    const trucks = await DockController.getTruckArrivals({ status, warehouse, date });
    res.json(trucks);
  })
);

/**
 * GET /api/docks/trucks/today
 * Get today's truck schedule
 */
router.get(
  '/trucks/today',
  asyncHandler(async (req: Request, res: Response) => {
    const warehouse = req.query.warehouse as string | undefined;
    const schedule = await DockController.getTodaySchedule(warehouse);
    res.json(schedule);
  })
);

/**
 * GET /api/docks/trucks/queue
 * Get current truck queue
 */
router.get(
  '/trucks/queue',
  asyncHandler(async (req: Request, res: Response) => {
    const warehouse = req.query.warehouse as string | undefined;
    const queue = await DockController.getQueue(warehouse);
    res.json(queue);
  })
);

/**
 * POST /api/docks/trucks
 * Create a new truck arrival
 */
router.post(
  '/trucks',
  body('carrier').optional().trim(),
  body('driverName').optional().trim(),
  body('driverPhone').optional().trim(),
  body('vehicleReg').optional().trim(),
  body('expectedArrival').optional(),
  body('warehouse').optional().trim(),
  body('shipmentId').optional().trim(),
  body('notes').optional().trim(),
  asyncHandler(async (req: BodyRequest, res: Response) => {
    const { carrier, driverName, driverPhone, vehicleReg, expectedArrival, warehouse, shipmentId, notes } = req.body;
    const currentUser = (req as any).user;
    const truck = await DockController.createTruckArrival({
      carrier,
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_reg: vehicleReg,
      expected_arrival: expectedArrival ? new Date(expectedArrival) : undefined,
      warehouse: warehouse || null,
      shipment_id: shipmentId || null,
      notes,
      created_by: currentUser?.username || currentUser?.id || null,
    });
    res.status(201).json(truck);
  })
);

/**
 * PUT /api/docks/trucks/:id
 * Amend a scheduled or checked-in truck arrival
 */
router.put(
  '/trucks/:id',
  body('carrier').optional().trim(),
  body('driverName').optional().trim(),
  body('driverPhone').optional().trim(),
  body('vehicleReg').optional().trim(),
  body('warehouse').optional().trim(),
  body('expectedArrival').optional(),
  body('notes').optional().trim(),
  asyncHandler(async (req: BodyRequest, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const { carrier, driverName, driverPhone, vehicleReg, warehouse, expectedArrival, notes } = req.body;
    const updateData: Record<string, any> = {};
    if (carrier !== undefined) updateData.carrier = carrier;
    if (driverName !== undefined) updateData.driver_name = driverName;
    if (driverPhone !== undefined) updateData.driver_phone = driverPhone;
    if (vehicleReg !== undefined) updateData.vehicle_reg = vehicleReg;
    if (warehouse !== undefined) updateData.warehouse = warehouse;
    if (expectedArrival !== undefined) updateData.expected_arrival = expectedArrival ? new Date(expectedArrival) : null;
    if (notes !== undefined) updateData.notes = notes;

    const truck = await DockController.updateTruckArrival(truckId, updateData);
    res.json({ message: 'Truck arrival updated', data: truck });
  })
);

/**
 * POST /api/docks/trucks/:id/cancel
 * Cancel a truck arrival (frees dock if assigned)
 */
router.post(
  '/trucks/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const truck = await DockController.cancelTruck(truckId);
    res.json({ message: 'Truck arrival cancelled', data: truck });
  })
);

/**
 * DELETE /api/docks/trucks/:id
 * Remove a scheduled or cancelled truck arrival
 */
router.delete(
  '/trucks/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    await DockController.deleteTruck(truckId);
    res.json({ message: 'Truck arrival removed' });
  })
);

/**
 * POST /api/docks/trucks/:id/check-in
 * Check in a truck (auto-assign dock if available, otherwise queue)
 */
router.post(
  '/trucks/:id/check-in',
  body('warehouse').optional().trim(),
  asyncHandler(async (req: BodyRequest<{ warehouse?: string }>, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const result = await DockController.checkIn(truckId, req.body.warehouse);
    res.json({
      message: result.dock ? 'Truck checked in and assigned to dock' : 'Truck checked in and added to queue',
      ...result,
    });
  })
);

/**
 * POST /api/docks/trucks/:id/assign-dock
 * Assign a specific dock to a truck
 */
router.post(
  '/trucks/:id/assign-dock',
  body('dockId').isInt({ min: 1 }).withMessage('dockId is required'),
  asyncHandler(async (req: BodyRequest<{ dockId: number }>, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const result = await DockController.assignDock(truckId, req.body.dockId);
    res.json({ message: 'Dock assigned', ...result });
  })
);

/**
 * POST /api/docks/trucks/:id/start-unloading
 * Start unloading a truck
 */
router.post(
  '/trucks/:id/start-unloading',
  asyncHandler(async (req: Request, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const truck = await DockController.startUnloading(truckId);
    res.json({ message: 'Unloading started', data: truck });
  })
);

/**
 * POST /api/docks/trucks/:id/complete
 * Complete truck processing (frees dock, auto-assigns next in queue)
 */
router.post(
  '/trucks/:id/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const result = await DockController.completeTruck(truckId);
    res.json({
      message: 'Truck completed',
      ...result,
    });
  })
);

/**
 * POST /api/docks/trucks/:id/depart
 * Mark truck as departed
 */
router.post(
  '/trucks/:id/depart',
  asyncHandler(async (req: Request, res: Response) => {
    const truckId = parseInt(req.params.id!, 10);
    const truck = await DockController.departTruck(truckId);
    res.json({ message: 'Truck departed', data: truck });
  })
);

export default router;
