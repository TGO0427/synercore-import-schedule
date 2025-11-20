/**
 * Quote repository
 * Handles all quote-related database operations
 */

import type { Quote } from '../../types/index.js';
import BaseRepository from './BaseRepository.js';
import { queryAll, queryOne } from '../connection.js';

/**
 * Quote filter options
 */
export interface QuoteFilter {
  supplier_id?: string;
  product_name?: string;
}

/**
 * Quote repository class
 */
export class QuoteRepository extends BaseRepository<Quote> {
  protected tableName = 'quotes';
  protected columns = [
    'id',
    'supplier_id',
    'product_name',
    'quantity',
    'price',
    'currency',
    'valid_until',
    'created_at',
    'updated_at'
  ];

  /**
   * Find quotes by supplier ID
   */
  async findBySupplier(supplierId: string): Promise<Quote[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE supplier_id = $1
      ORDER BY created_at DESC
    `;

    return queryAll<Quote>(sql, [supplierId]);
  }

  /**
   * Find quotes by product name
   */
  async findByProduct(productName: string): Promise<Quote[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE product_name ILIKE $1
      ORDER BY created_at DESC
    `;

    return queryAll<Quote>(sql, [`%${productName}%`]);
  }

  /**
   * Find active quotes (not expired)
   */
  async findActive(): Promise<Quote[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE valid_until IS NULL OR valid_until > NOW()
      ORDER BY created_at DESC
    `;

    return queryAll<Quote>(sql);
  }

  /**
   * Find expired quotes
   */
  async findExpired(): Promise<Quote[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE valid_until IS NOT NULL AND valid_until <= NOW()
      ORDER BY valid_until DESC
    `;

    return queryAll<Quote>(sql);
  }

  /**
   * Search quotes by supplier or product
   */
  async search(query: string): Promise<Quote[]> {
    const searchTerm = `%${query}%`;
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE product_name ILIKE $1
        OR supplier_id ILIKE $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return queryAll<Quote>(sql, [searchTerm]);
  }

  /**
   * Get quote statistics
   */
  async getStatistics() {
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN valid_until IS NULL OR valid_until > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN valid_until IS NOT NULL AND valid_until <= NOW() THEN 1 END) as expired,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM ${this.tableName}
    `;

    const result = await queryOne<{
      total: string;
      active: string;
      expired: string;
      avg_price: string | null;
      min_price: string | null;
      max_price: string | null;
    }>(sql);

    return {
      total: parseInt(result?.total || '0', 10),
      active: parseInt(result?.active || '0', 10),
      expired: parseInt(result?.expired || '0', 10),
      avgPrice: result?.avg_price ? parseFloat(result.avg_price) : null,
      minPrice: result?.min_price ? parseFloat(result.min_price) : null,
      maxPrice: result?.max_price ? parseFloat(result.max_price) : null
    };
  }

  /**
   * Get quotes by date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Quote[]> {
    const sql = `
      SELECT ${this.columns.join(', ')}
      FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at DESC
    `;

    return queryAll<Quote>(sql, [startDate, endDate]);
  }

  /**
   * Update quote status (extend validity)
   */
  async updateValidity(id: string, newValidUntil: Date): Promise<Quote> {
    const sql = `
      UPDATE ${this.tableName}
      SET valid_until = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${this.columns.join(', ')}
    `;

    const result = await queryOne<Quote>(sql, [newValidUntil, id]);

    if (!result) {
      throw new Error('Quote not found');
    }

    return result;
  }

  /**
   * Get quotes with supplier info
   */
  async getWithSupplierInfo(id: string) {
    const sql = `
      SELECT
        q.*,
        s.name as supplier_name,
        s.email as supplier_email
      FROM ${this.tableName} q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.id = $1
    `;

    return queryOne<Quote & { supplier_name: string; supplier_email: string }>(sql, [id]);
  }

  /**
   * Get all quotes with supplier info
   */
  async getAllWithSupplierInfo() {
    const sql = `
      SELECT
        q.*,
        s.name as supplier_name,
        s.email as supplier_email
      FROM ${this.tableName} q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      ORDER BY q.created_at DESC
    `;

    return queryAll<Quote & { supplier_name: string; supplier_email: string }>(sql);
  }
}

export default new QuoteRepository();
