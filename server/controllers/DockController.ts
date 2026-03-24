/**
 * Dock Controller
 * Handles dock management and truck arrival business logic
 */

import { AppError } from '../utils/AppError.ts';
import dockRepository from '../db/repositories/DockRepository.js';
import type { Dock, TruckArrival, DockMetrics } from '../db/repositories/DockRepository.js';

export default class DockController {
  // ─── Dock Operations ───

  static async getDocks(warehouse?: string): Promise<Dock[]> {
    return dockRepository.findAllDocks(warehouse);
  }

  static async getDock(id: number): Promise<Dock> {
    const dock = await dockRepository.findDockById(id);
    if (!dock) throw AppError.notFound('Dock not found');
    return dock;
  }

  static async updateDock(id: number, data: { status?: string; notes?: string }): Promise<Dock> {
    const dock = await this.getDock(id);
    const updateData: Partial<Dock> = {};
    if (data.status) {
      if (!['available', 'occupied', 'maintenance'].includes(data.status)) {
        throw AppError.badRequest('Invalid dock status');
      }
      updateData.status = data.status as Dock['status'];
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await dockRepository.updateDock(id, updateData);
    if (!updated) throw AppError.notFound('Dock not found');
    return updated;
  }

  // ─── Truck Arrival Operations ───

  static async getTruckArrivals(filters: {
    status?: string;
    warehouse?: string;
    date?: string;
  }): Promise<TruckArrival[]> {
    return dockRepository.findAllTruckArrivals(filters);
  }

  static async getTodaySchedule(warehouse?: string): Promise<TruckArrival[]> {
    return dockRepository.getTodaySchedule(warehouse);
  }

  static async getQueue(warehouse?: string): Promise<TruckArrival[]> {
    return dockRepository.getQueuedTrucks(warehouse);
  }

  static async createTruckArrival(data: Partial<TruckArrival>): Promise<TruckArrival> {
    return dockRepository.createTruckArrival(data);
  }

  static async updateTruckArrival(truckId: number, data: Partial<TruckArrival>): Promise<TruckArrival> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (!['scheduled', 'checked_in'].includes(truck.status)) {
      throw AppError.conflict('Can only amend trucks that are scheduled or checked in');
    }

    const updated = await dockRepository.updateTruckArrival(truckId, data);
    if (!updated) throw AppError.notFound('Truck arrival not found');
    return updated;
  }

  static async cancelTruck(truckId: number): Promise<TruckArrival> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (['completed', 'departed'].includes(truck.status)) {
      throw AppError.conflict('Cannot cancel a completed or departed truck');
    }

    // If truck was occupying a dock, free it
    if (truck.dock_id) {
      await dockRepository.freeDock(truck.dock_id);
    }

    const updated = await dockRepository.updateTruckArrival(truckId, {
      status: 'cancelled' as TruckArrival['status'],
      queue_position: null,
    } as Partial<TruckArrival>);
    if (!updated) throw AppError.notFound('Truck arrival not found');
    return updated;
  }

  static async deleteTruck(truckId: number): Promise<void> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (!['scheduled', 'cancelled'].includes(truck.status)) {
      throw AppError.conflict('Can only remove scheduled or cancelled trucks');
    }

    await dockRepository.deleteTruckArrival(truckId);
  }

  static async checkIn(truckId: number, warehouse?: string): Promise<{ truck: TruckArrival; dock?: Dock }> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (truck.status !== 'scheduled') {
      throw AppError.conflict('Truck must be in scheduled status to check in');
    }

    const now = new Date();

    // Use truck's own warehouse if not explicitly provided
    const targetWarehouse = warehouse || truck.warehouse;

    // Try to find an available dock
    if (targetWarehouse) {
      const availableDock = await dockRepository.getAvailableDock(targetWarehouse);
      if (availableDock) {
        // Direct assignment
        await dockRepository.updateTruckArrival(truckId, {
          status: 'unloading' as TruckArrival['status'],
          check_in_time: now,
          actual_arrival: now,
          dock_id: availableDock.id,
        } as Partial<TruckArrival>);
        await dockRepository.updateDock(availableDock.id, {
          status: 'occupied',
          current_truck_id: truckId,
        } as Partial<Dock>);

        const updatedTruck = await dockRepository.findTruckById(truckId);
        return { truck: updatedTruck!, dock: { ...availableDock, status: 'occupied' as const, current_truck_id: truckId } };
      }
    }

    // No dock available — add to queue
    const queuePos = await dockRepository.getNextQueuePosition();
    await dockRepository.updateTruckArrival(truckId, {
      status: 'checked_in' as TruckArrival['status'],
      check_in_time: now,
      actual_arrival: now,
      queue_position: queuePos,
    } as Partial<TruckArrival>);

    const updatedTruck = await dockRepository.findTruckById(truckId);
    return { truck: updatedTruck! };
  }

  static async assignDock(truckId: number, dockId: number): Promise<{ truck: TruckArrival; dock: Dock }> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (!['checked_in', 'scheduled'].includes(truck.status)) {
      throw AppError.conflict('Truck must be checked in or scheduled to assign a dock');
    }

    const result = await dockRepository.assignDockToTruck(truckId, dockId);
    return result;
  }

  static async startUnloading(truckId: number): Promise<TruckArrival> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (truck.status !== 'checked_in' && truck.status !== 'unloading') {
      throw AppError.conflict('Truck must be checked in to start unloading');
    }

    const updated = await dockRepository.updateTruckArrival(truckId, {
      status: 'unloading' as TruckArrival['status'],
    } as Partial<TruckArrival>);
    if (!updated) throw AppError.notFound('Truck arrival not found');
    return updated;
  }

  static async completeTruck(truckId: number): Promise<{ truck: TruckArrival; nextAssigned?: TruckArrival }> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (truck.status !== 'unloading') {
      throw AppError.conflict('Truck must be unloading to complete');
    }

    const now = new Date();
    await dockRepository.updateTruckArrival(truckId, {
      status: 'completed' as TruckArrival['status'],
      check_out_time: now,
    } as Partial<TruckArrival>);

    // Free the dock and auto-assign next queued truck
    let nextAssigned: TruckArrival | undefined;
    if (truck.dock_id) {
      const dock = await dockRepository.findDockById(truck.dock_id);
      if (dock) {
        await dockRepository.freeDock(dock.id);

        // Check queue for next truck
        const queue = await dockRepository.getQueuedTrucks(dock.warehouse);
        if (queue.length > 0) {
          const nextTruck = queue[0];
          const assigned = await dockRepository.assignDockToTruck(nextTruck.id, dock.id);
          nextAssigned = assigned.truck;
        }
      }
    }

    const updatedTruck = await dockRepository.findTruckById(truckId);
    return { truck: updatedTruck!, nextAssigned };
  }

  static async departTruck(truckId: number): Promise<TruckArrival> {
    const truck = await dockRepository.findTruckById(truckId);
    if (!truck) throw AppError.notFound('Truck arrival not found');
    if (truck.status !== 'completed') {
      throw AppError.conflict('Truck must be completed to depart');
    }

    const updated = await dockRepository.updateTruckArrival(truckId, {
      status: 'departed' as TruckArrival['status'],
    } as Partial<TruckArrival>);
    if (!updated) throw AppError.notFound('Truck arrival not found');
    return updated;
  }

  // ─── Metrics ───

  static async getMetrics(warehouse?: string, startDate?: string, endDate?: string): Promise<DockMetrics> {
    return dockRepository.getDockMetrics(warehouse, startDate, endDate);
  }
}
