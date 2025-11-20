/**
 * Shipment repository
 * Handles all shipment-related database operations
 */

import type { Shipment, ShipmentStatus } from '../../types/index.js';
import BaseRepository from './BaseRepository.js';
import { queryAll, queryOne } from '../connection.js';

/**
 * Shipment filter options
 */
export interface ShipmentFilter {
  latestStatus?: ShipmentStatus;
  supplier?: string;
  weekNumber?: number;
  orderRef?: string;
}

/**
 * Shipment repository class
 */
export class ShipmentRepository extends BaseRepository<Shipment> {
  protected tableName = 'shipments';
  protected columns = [
    'id',
    'order_ref',
    'supplier_id',
    'supplier',
    'quantity',
    'latest_status',
    'week_number',
    'week_date',
    'notes',
    'created_at',
    'updated_at',
    'archived_at'
  ];

  /**
   * Find shipments by status
   */
  async findByStatus(status: ShipmentStatus): Promise<Shipment[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE latest_status = $1
      ORDER BY created_at DESC
    `;

    return queryAll<Shipment>(sql, [status]);
  }

  /**
   * Find shipments by supplier
   */
  async findBySupplier(supplier: string): Promise<Shipment[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE supplier = $1
      ORDER BY created_at DESC
    `;

    return queryAll<Shipment>(sql, [supplier]);
  }

  /**
   * Find shipments by week number
   */
  async findByWeek(weekNumber: number): Promise<Shipment[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE week_number = $1
      ORDER BY created_at DESC
    `;

    return queryAll<Shipment>(sql, [weekNumber]);
  }

  /**
   * Find active shipments (not archived)
   */
  async findActive(): Promise<Shipment[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE archived_at IS NULL
      ORDER BY created_at DESC
    `;

    return queryAll<Shipment>(sql);
  }

  /**
   * Find archived shipments
   */
  async findArchived(): Promise<Shipment[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE archived_at IS NOT NULL
      ORDER BY archived_at DESC
    `;

    return queryAll<Shipment>(sql);
  }

  /**
   * Find shipment by order reference
   */
  async findByOrderRef(orderRef: string): Promise<Shipment | null> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE order_ref = $1
    `;

    return queryOne<Shipment>(sql, [orderRef]);
  }

  /**
   * Count shipments by status
   */
  async countByStatus(status: ShipmentStatus): Promise<number> {
    return this.count({ latest_status: status });
  }

  /**
   * Update shipment status
   */
  async updateStatus(id: string, status: ShipmentStatus, notes?: string): Promise<Shipment> {
    const sql = `
      UPDATE ${this.tableName}
      SET latest_status = $1, updated_at = NOW()${notes ? ', notes = $3' : ''}
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const params = notes ? [status, id, notes] : [status, id];
    const result = await queryOne<Shipment>(sql, params);

    if (!result) {
      throw new Error('Shipment not found');
    }

    return result;
  }

  /**
   * Archive shipment
   */
  async archive(id: string): Promise<Shipment> {
    const sql = `
      UPDATE ${this.tableName}
      SET archived_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<Shipment>(sql, [id]);

    if (!result) {
      throw new Error('Shipment not found');
    }

    return result;
  }

  /**
   * Unarchive shipment
   */
  async unarchive(id: string): Promise<Shipment> {
    const sql = `
      UPDATE ${this.tableName}
      SET archived_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<Shipment>(sql, [id]);

    if (!result) {
      throw new Error('Shipment not found');
    }

    return result;
  }

  /**
   * Get shipment statistics
   */
  async getStatistics() {
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN latest_status = 'stored' THEN 1 END) as stored,
        COUNT(CASE WHEN latest_status LIKE 'in_transit%' THEN 1 END) as in_transit,
        COUNT(CASE WHEN latest_status LIKE 'arrived%' THEN 1 END) as arrived,
        COUNT(CASE WHEN archived_at IS NOT NULL THEN 1 END) as archived
      FROM ${this.tableName}
    `;

    const result = await queryOne<{
      total: string;
      stored: string;
      in_transit: string;
      arrived: string;
      archived: string;
    }>(sql);

    return {
      total: parseInt(result?.total || '0', 10),
      stored: parseInt(result?.stored || '0', 10),
      inTransit: parseInt(result?.in_transit || '0', 10),
      arrived: parseInt(result?.arrived || '0', 10),
      archived: parseInt(result?.archived || '0', 10)
    };
  }

  /**
   * Search shipments
   */
  async search(query: string): Promise<Shipment[]> {
    const searchTerm = `%${query}%`;
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE order_ref ILIKE $1
        OR supplier ILIKE $1
        OR notes ILIKE $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return queryAll<Shipment>(sql, [searchTerm]);
  }
}

export default new ShipmentRepository();
