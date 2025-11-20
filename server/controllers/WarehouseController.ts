/**
 * Warehouse Controller
 * Handles all warehouse-related business logic
 */

import type { WarehouseCapacity } from '../types/index.js';
import { AppError } from '../utils/AppError.js';
import { warehouseRepository } from '../db/repositories/index.js';

/**
 * Create warehouse request body
 */
export interface CreateWarehouseRequest {
  location: string;
  totalCapacity: number;
  availableBins: number;
}

/**
 * Update warehouse request body
 */
export interface UpdateWarehouseRequest {
  totalCapacity?: number;
  availableBins?: number;
  usedCapacity?: number;
}

/**
 * Warehouse filter parameters
 */
export interface WarehouseFilterParams {
  location?: string;
  page?: number;
  limit?: number;
}

/**
 * Warehouse Controller Class
 */
export class WarehouseController {
  /**
   * Get all warehouses
   */
  static async getWarehouses(_params?: WarehouseFilterParams): Promise<{
    warehouses: WarehouseCapacity[];
  }> {
    const warehouses = await warehouseRepository.findAllWarehouses();

    return {
      warehouses
    };
  }

  /**
   * Get single warehouse by ID
   */
  static async getWarehouse(id: string): Promise<WarehouseCapacity> {
    const warehouse = await warehouseRepository.findById(id);

    if (!warehouse) {
      throw AppError.notFound(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  /**
   * Get warehouse by location
   */
  static async getWarehouseByLocation(location: string): Promise<WarehouseCapacity> {
    const warehouse = await warehouseRepository.findByLocation(location);

    if (!warehouse) {
      throw AppError.notFound(`Warehouse at location ${location} not found`);
    }

    return warehouse;
  }

  /**
   * Create new warehouse
   */
  static async createWarehouse(data: CreateWarehouseRequest): Promise<WarehouseCapacity> {
    // Create warehouse
    const warehouse = await warehouseRepository.create({
      id: `warehouse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      location: data.location,
      total_capacity: data.totalCapacity,
      available_bins: data.availableBins,
      used_capacity: 0,
      last_updated: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    } as Partial<WarehouseCapacity>);

    return warehouse;
  }

  /**
   * Update warehouse
   */
  static async updateWarehouse(id: string, data: UpdateWarehouseRequest): Promise<WarehouseCapacity> {
    // Verify warehouse exists
    await this.getWarehouse(id);

    // Update only provided fields
    const updateData: Partial<WarehouseCapacity> = {
      updated_at: new Date(),
      last_updated: new Date()
    };

    if (data.totalCapacity !== undefined) {
      updateData.total_capacity = data.totalCapacity;
    }
    if (data.availableBins !== undefined) {
      updateData.available_bins = data.availableBins;
    }
    if (data.usedCapacity !== undefined) {
      updateData.used_capacity = data.usedCapacity;
    }

    const warehouse = await warehouseRepository.update(id, updateData);

    return warehouse;
  }

  /**
   * Update available bins
   */
  static async updateAvailableBins(id: string, availableBins: number): Promise<WarehouseCapacity> {
    if (availableBins < 0) {
      throw AppError.badRequest('Available bins cannot be negative');
    }

    return warehouseRepository.updateAvailableBins(id, availableBins);
  }

  /**
   * Update used capacity
   */
  static async updateUsedCapacity(id: string, usedCapacity: number): Promise<WarehouseCapacity> {
    if (usedCapacity < 0) {
      throw AppError.badRequest('Used capacity cannot be negative');
    }

    return warehouseRepository.updateUsedCapacity(id, usedCapacity);
  }

  /**
   * Update total capacity
   */
  static async updateTotalCapacity(id: string, totalCapacity: number): Promise<WarehouseCapacity> {
    if (totalCapacity < 0) {
      throw AppError.badRequest('Total capacity cannot be negative');
    }

    return warehouseRepository.updateTotalCapacity(id, totalCapacity);
  }

  /**
   * Delete warehouse
   */
  static async deleteWarehouse(id: string): Promise<void> {
    // Verify warehouse exists
    await this.getWarehouse(id);

    // Delete warehouse
    const deleted = await warehouseRepository.delete(id);

    if (!deleted) {
      throw AppError.internal('Failed to delete warehouse');
    }
  }

  /**
   * Get warehouse utilization
   */
  static async getUtilization(id: string) {
    return warehouseRepository.getUtilization(id);
  }

  /**
   * Get all warehouse statistics
   */
  static async getStatistics(): Promise<{
    totalWarehouses: number;
    totalCapacity: number;
    totalUsed: number;
    avgUtilization: number;
  }> {
    return warehouseRepository.getStatistics();
  }

  /**
   * Get warehouse history
   */
  static async getHistory(warehouseId?: string, limit?: number) {
    return warehouseRepository.getHistory(warehouseId, limit);
  }

  /**
   * Record warehouse history
   */
  static async recordHistory(
    warehouseName: string,
    binsUsed: number,
    previousValue: number,
    changedBy?: string
  ) {
    return warehouseRepository.recordHistory(warehouseName, binsUsed, previousValue, changedBy);
  }
}

export default WarehouseController;
