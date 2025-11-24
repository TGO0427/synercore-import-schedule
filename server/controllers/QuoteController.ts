/**
 * Quote Controller
 * Handles all quote-related business logic
 */

import type { Quote } from '../types/index.js';
import { AppError } from '../utils/AppError.ts';
import { quoteRepository } from '../db/repositories/index.js';

/**
 * Create quote request body
 */
export interface CreateQuoteRequest {
  supplierId: string;
  productName: string;
  quantity: number;
  price: number;
  currency?: string;
  validUntil?: Date;
}

/**
 * Update quote request body
 */
export interface UpdateQuoteRequest {
  productName?: string;
  quantity?: number;
  price?: number;
  currency?: string;
  validUntil?: Date;
}

/**
 * Quote filter parameters
 */
export interface QuoteFilterParams {
  supplierId?: string;
  productName?: string;
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}

/**
 * Quote Controller Class
 */
export class QuoteController {
  /**
   * Get all quotes with filtering and pagination
   */
  static async getQuotes(params: QuoteFilterParams): Promise<{
    quotes: Quote[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Handle search
    if (params.search) {
      const results = await quoteRepository.search(params.search);
      return {
        quotes: results.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total: results.length,
          pages: Math.ceil(results.length / limit)
        }
      };
    }

    // Get all quotes
    let quotes = await quoteRepository.findAll({ pagination: { page, limit } });

    // Filter by active status if requested
    if (params.active !== undefined) {
      if (params.active) {
        quotes = await quoteRepository.findActive();
      } else {
        quotes = await quoteRepository.findExpired();
      }
      const total = quotes.length;
      return {
        quotes: quotes.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    }

    const total = await quoteRepository.count({});

    return {
      quotes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single quote by ID
   */
  static async getQuote(id: string): Promise<Quote> {
    const quote = await quoteRepository.findById(id);

    if (!quote) {
      throw AppError.notFound(`Quote with ID ${id} not found`);
    }

    return quote;
  }

  /**
   * Get quote with supplier info
   */
  static async getQuoteWithSupplier(id: string) {
    const quote = await quoteRepository.getWithSupplierInfo(id);

    if (!quote) {
      throw AppError.notFound(`Quote with ID ${id} not found`);
    }

    return quote;
  }

  /**
   * Create new quote
   */
  static async createQuote(data: CreateQuoteRequest): Promise<Quote> {
    // Create quote
    const quote = await quoteRepository.create({
      id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      supplier_id: data.supplierId,
      product_name: data.productName,
      quantity: data.quantity,
      price: data.price,
      currency: data.currency || 'USD',
      valid_until: data.validUntil,
      created_at: new Date(),
      updated_at: new Date()
    } as Partial<Quote>);

    return quote;
  }

  /**
   * Update quote
   */
  static async updateQuote(id: string, data: UpdateQuoteRequest): Promise<Quote> {
    // Verify quote exists
    await this.getQuote(id);

    // Update quote
    const quote = await quoteRepository.update(id, {
      ...data,
      updated_at: new Date()
    } as Partial<Quote>);

    return quote;
  }

  /**
   * Delete quote
   */
  static async deleteQuote(id: string): Promise<void> {
    // Verify quote exists
    await this.getQuote(id);

    // Delete quote
    const deleted = await quoteRepository.delete(id);

    if (!deleted) {
      throw AppError.internal('Failed to delete quote');
    }
  }

  /**
   * Get quote statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    active: number;
    expired: number;
    avgPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
  }> {
    return quoteRepository.getStatistics();
  }

  /**
   * Get quotes by supplier
   */
  static async getQuotesBySupplier(supplierId: string): Promise<Quote[]> {
    return quoteRepository.findBySupplier(supplierId);
  }

  /**
   * Get quotes by product
   */
  static async getQuotesByProduct(productName: string): Promise<Quote[]> {
    return quoteRepository.findByProduct(productName);
  }

  /**
   * Get active quotes
   */
  static async getActiveQuotes(): Promise<Quote[]> {
    return quoteRepository.findActive();
  }

  /**
   * Get expired quotes
   */
  static async getExpiredQuotes(): Promise<Quote[]> {
    return quoteRepository.findExpired();
  }

  /**
   * Update quote validity
   */
  static async updateValidity(id: string, newValidUntil: Date): Promise<Quote> {
    // Verify quote exists
    await this.getQuote(id);

    return quoteRepository.updateValidity(id, newValidUntil);
  }

  /**
   * Get all quotes with supplier info
   */
  static async getAllWithSupplierInfo() {
    return quoteRepository.getAllWithSupplierInfo();
  }
}

export default QuoteController;
