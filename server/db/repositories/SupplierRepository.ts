/**
 * Supplier repository
 * Handles all supplier-related database operations
 */

import type { Supplier } from '../../types/index.js';
import BaseRepository from './BaseRepository.js';
import { queryAll, queryOne } from '../connection.js';

/**
 * Supplier filter options
 */
export interface SupplierFilter {
  country?: string;
  name?: string;
}

/**
 * Supplier repository class
 */
export class SupplierRepository extends BaseRepository<Supplier> {
  protected tableName = 'suppliers';
  protected columns = [
    'id',
    'name',
    'email',
    'phone',
    'country',
    'contact_person',
    'payment_terms',
    'performance_rating',
    'created_at',
    'updated_at'
  ];

  /**
   * Find supplier by name
   */
  async findByName(name: string): Promise<Supplier | null> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE name = $1
    `;

    return queryOne<Supplier>(sql, [name]);
  }

  /**
   * Find suppliers by country
   */
  async findByCountry(country: string): Promise<Supplier[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE country = $1
      ORDER BY name ASC
    `;

    return queryAll<Supplier>(sql, [country]);
  }

  /**
   * Find supplier by email
   */
  async findByEmail(email: string): Promise<Supplier | null> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE email = $1
    `;

    return queryOne<Supplier>(sql, [email]);
  }

  /**
   * Get all suppliers sorted by name
   */
  async findAllSorted(): Promise<Supplier[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      ORDER BY name ASC
    `;

    return queryAll<Supplier>(sql);
  }

  /**
   * Search suppliers by name or country
   */
  async search(query: string): Promise<Supplier[]> {
    const searchTerm = `%${query}%`;
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE name ILIKE $1
        OR country ILIKE $1
        OR contact_person ILIKE $1
      ORDER BY name ASC
      LIMIT 50
    `;

    return queryAll<Supplier>(sql, [searchTerm]);
  }

  /**
   * Update performance rating
   */
  async updateRating(id: string, rating: number): Promise<Supplier> {
    const sql = `
      UPDATE ${this.tableName}
      SET performance_rating = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<Supplier>(sql, [rating, id]);

    if (!result) {
      throw new Error('Supplier not found');
    }

    return result;
  }

  /**
   * Get supplier statistics
   */
  async getStatistics() {
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN country = 'China' THEN 1 END) as from_china,
        COUNT(CASE WHEN performance_rating IS NOT NULL THEN 1 END) as rated,
        AVG(performance_rating) as avg_rating
      FROM ${this.tableName}
    `;

    const result = await queryOne<{
      total: string;
      from_china: string;
      rated: string;
      avg_rating: string | null;
    }>(sql);

    return {
      total: parseInt(result?.total || '0', 10),
      fromChina: parseInt(result?.from_china || '0', 10),
      rated: parseInt(result?.rated || '0', 10),
      avgRating: result?.avg_rating ? parseFloat(result.avg_rating) : null
    };
  }

  /**
   * Get supplier with shipment count
   */
  async getWithShipmentCount(id: string) {
    const sql = `
      SELECT
        s.*,
        COUNT(sh.id) as shipment_count
      FROM ${this.tableName} s
      LEFT JOIN shipments sh ON s.id = sh.supplier_id
      WHERE s.id = $1
      GROUP BY s.id
    `;

    return queryOne<Supplier & { shipment_count: string }>(sql, [id]);
  }

  /**
   * Get all suppliers with shipment counts
   */
  async getAllWithShipmentCounts() {
    const sql = `
      SELECT
        s.*,
        COUNT(sh.id) as shipment_count
      FROM ${this.tableName} s
      LEFT JOIN shipments sh ON s.id = sh.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `;

    return queryAll<Supplier & { shipment_count: string }>(sql);
  }
}

export default new SupplierRepository();
