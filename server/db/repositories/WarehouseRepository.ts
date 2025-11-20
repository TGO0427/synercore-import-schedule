/**
 * Warehouse capacity repository
 * Handles all warehouse capacity-related database operations
 */

import type { WarehouseCapacity } from '../../types/index.js';
import BaseRepository from './BaseRepository.js';
import { queryAll, queryOne } from '../connection.js';

/**
 * Warehouse filter options
 */
export interface WarehouseFilter {
  location?: string;
}

/**
 * Warehouse history record
 */
export interface WarehouseHistory {
  id: string;
  warehouse_name: string;
  bins_used: number;
  previous_value: number;
  changed_at: Date;
  changed_by?: string;
}

/**
 * Warehouse repository class
 */
export class WarehouseRepository extends BaseRepository<WarehouseCapacity> {
  protected tableName = 'warehouse_capacity';
  protected columns = [
    'id',
    'location',
    'total_capacity',
    'available_bins',
    'used_capacity',
    'last_updated',
    'created_at',
    'updated_at'
  ];

  /**
   * Find warehouse by location
   */
  async findByLocation(location: string): Promise<WarehouseCapacity | null> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE location = $1
    `;

    return queryOne<WarehouseCapacity>(sql, [location]);
  }

  /**
   * Get all warehouses
   */
  async findAllWarehouses(): Promise<WarehouseCapacity[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      ORDER BY location ASC
    `;

    return queryAll<WarehouseCapacity>(sql);
  }

  /**
   * Update available bins for a warehouse
   */
  async updateAvailableBins(id: string, availableBins: number): Promise<WarehouseCapacity> {
    const sql = `
      UPDATE ${this.tableName}
      SET available_bins = $1, last_updated = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<WarehouseCapacity>(sql, [availableBins, id]);

    if (!result) {
      throw new Error('Warehouse not found');
    }

    return result;
  }

  /**
   * Update used capacity for a warehouse
   */
  async updateUsedCapacity(id: string, usedCapacity: number): Promise<WarehouseCapacity> {
    const sql = `
      UPDATE ${this.tableName}
      SET used_capacity = $1, last_updated = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<WarehouseCapacity>(sql, [usedCapacity, id]);

    if (!result) {
      throw new Error('Warehouse not found');
    }

    return result;
  }

  /**
   * Update total capacity for a warehouse
   */
  async updateTotalCapacity(id: string, totalCapacity: number): Promise<WarehouseCapacity> {
    const sql = `
      UPDATE ${this.tableName}
      SET total_capacity = $1, last_updated = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<WarehouseCapacity>(sql, [totalCapacity, id]);

    if (!result) {
      throw new Error('Warehouse not found');
    }

    return result;
  }

  /**
   * Calculate warehouse utilization
   */
  async getUtilization(id: string): Promise<{
    warehouseId: string;
    location: string;
    totalCapacity: number;
    usedCapacity: number;
    availableBins: number;
    utilizationPercent: number;
  } | null> {
    const warehouse = await this.findById(id);

    if (!warehouse) {
      return null;
    }

    const utilizationPercent =
      warehouse.total_capacity > 0
        ? (warehouse.used_capacity / warehouse.total_capacity) * 100
        : 0;

    return {
      warehouseId: warehouse.id,
      location: warehouse.location,
      totalCapacity: warehouse.total_capacity,
      usedCapacity: warehouse.used_capacity,
      availableBins: warehouse.available_bins,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100
    };
  }

  /**
   * Get all warehouse statistics
   */
  async getStatistics() {
    const sql = `
      SELECT
        COUNT(*) as total_warehouses,
        SUM(total_capacity) as total_capacity_sum,
        SUM(used_capacity) as total_used_sum,
        AVG(
          CASE
            WHEN total_capacity > 0 THEN (used_capacity::float / total_capacity::float) * 100
            ELSE 0
          END
        ) as avg_utilization
      FROM ${this.tableName}
    `;

    const result = await queryOne<{
      total_warehouses: string;
      total_capacity_sum: string | null;
      total_used_sum: string | null;
      avg_utilization: string | null;
    }>(sql);

    return {
      totalWarehouses: parseInt(result?.total_warehouses || '0', 10),
      totalCapacity: result?.total_capacity_sum ? parseInt(result.total_capacity_sum, 10) : 0,
      totalUsed: result?.total_used_sum ? parseInt(result.total_used_sum, 10) : 0,
      avgUtilization: result?.avg_utilization ? parseFloat(result.avg_utilization) : 0
    };
  }

  /**
   * Get warehouse history
   */
  async getHistory(warehouseId?: string, limit: number = 50): Promise<WarehouseHistory[]> {
    let sql = `
      SELECT
        id,
        warehouse_name,
        bins_used,
        previous_value,
        changed_at,
        changed_by
      FROM warehouse_capacity_history
    `;

    const params: any[] = [];

    if (warehouseId) {
      sql += ' WHERE warehouse_name = $1';
      params.push(warehouseId);
    }

    sql += ' ORDER BY changed_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    return queryAll<WarehouseHistory>(sql, params);
  }

  /**
   * Create warehouse history entry
   */
  async recordHistory(
    warehouseName: string,
    binsUsed: number,
    previousValue: number,
    changedBy?: string
  ): Promise<WarehouseHistory> {
    const sql = `
      INSERT INTO warehouse_capacity_history
        (warehouse_name, bins_used, previous_value, changed_by, changed_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, warehouse_name, bins_used, previous_value, changed_at, changed_by
    `;

    const result = await queryOne<WarehouseHistory>(sql, [
      warehouseName,
      binsUsed,
      previousValue,
      changedBy || null
    ]);

    if (!result) {
      throw new Error('Failed to record warehouse history');
    }

    return result;
  }
}

export default new WarehouseRepository();
