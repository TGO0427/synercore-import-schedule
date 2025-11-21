/**
 * Supplier Controller
 * Handles all supplier-related business logic
 */

import type { Supplier } from '../types/index.js';
import { AppError } from '../utils/AppError.ts';
import { supplierRepository } from '../db/repositories/index.js';

/**
 * Create supplier request body
 */
export interface CreateSupplierRequest {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  contactPerson?: string;
  paymentTerms?: string;
}

/**
 * Update supplier request body
 */
export interface UpdateSupplierRequest {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  contactPerson?: string;
  paymentTerms?: string;
  performanceRating?: number;
}

/**
 * Supplier filter parameters
 */
export interface SupplierFilterParams {
  country?: string;
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}

/**
 * Supplier Controller Class
 */
export class SupplierController {
  /**
   * Get all suppliers with filtering and pagination
   */
  static async getSuppliers(params: SupplierFilterParams): Promise<{
    suppliers: Supplier[];
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
      const results = await supplierRepository.search(params.search);
      return {
        suppliers: results.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total: results.length,
          pages: Math.ceil(results.length / limit)
        }
      };
    }

    // Handle country filter
    if (params.country) {
      const results = await supplierRepository.findByCountry(params.country);
      return {
        suppliers: results.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total: results.length,
          pages: Math.ceil(results.length / limit)
        }
      };
    }

    // Get all sorted suppliers
    const suppliers = await supplierRepository.findAllSorted();
    const total = suppliers.length;

    return {
      suppliers: suppliers.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single supplier by ID
   */
  static async getSupplier(id: string): Promise<Supplier> {
    const supplier = await supplierRepository.findById(id);

    if (!supplier) {
      throw AppError.notFound(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  /**
   * Get supplier by name
   */
  static async getSupplierByName(name: string): Promise<Supplier> {
    const supplier = await supplierRepository.findByName(name);

    if (!supplier) {
      throw AppError.notFound(`Supplier with name ${name} not found`);
    }

    return supplier;
  }

  /**
   * Create new supplier
   */
  static async createSupplier(data: CreateSupplierRequest): Promise<Supplier> {
    // Check if email already exists
    const existing = await supplierRepository.findByEmail(data.email);
    if (existing) {
      throw AppError.conflict(`Supplier with email ${data.email} already exists`);
    }

    // Create supplier
    const supplier = await supplierRepository.create({
      id: `supp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      country: data.country,
      contact_person: data.contactPerson,
      payment_terms: data.paymentTerms,
      created_at: new Date(),
      updated_at: new Date()
    } as Partial<Supplier>);

    return supplier;
  }

  /**
   * Update supplier
   */
  static async updateSupplier(id: string, data: UpdateSupplierRequest): Promise<Supplier> {
    // Verify supplier exists
    await this.getSupplier(id);

    // Check if new email is unique
    if (data.email) {
      const existing = await supplierRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw AppError.conflict(`Email ${data.email} is already in use`);
      }
    }

    // Update supplier
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.phone) updateData.phone = data.phone;
    if (data.country) updateData.country = data.country;
    if (data.contactPerson) updateData.contact_person = data.contactPerson;
    if (data.paymentTerms) updateData.payment_terms = data.paymentTerms;
    if (data.performanceRating !== undefined) updateData.performance_rating = data.performanceRating;

    const supplier = await supplierRepository.update(id, updateData as Partial<Supplier>);

    return supplier;
  }

  /**
   * Delete supplier
   */
  static async deleteSupplier(id: string): Promise<void> {
    // Verify supplier exists
    await this.getSupplier(id);

    // Delete supplier
    const deleted = await supplierRepository.delete(id);

    if (!deleted) {
      throw AppError.internal('Failed to delete supplier');
    }
  }

  /**
   * Get supplier statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    fromChina: number;
    rated: number;
    avgRating: number | null;
  }> {
    return supplierRepository.getStatistics();
  }

  /**
   * Get suppliers by country
   */
  static async getSuppliersByCountry(country: string): Promise<Supplier[]> {
    return supplierRepository.findByCountry(country);
  }

  /**
   * Update supplier rating
   */
  static async updateRating(id: string, rating: number): Promise<Supplier> {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw AppError.badRequest('Rating must be between 1 and 5');
    }

    // Verify supplier exists
    await this.getSupplier(id);

    return supplierRepository.updateRating(id, rating);
  }

  /**
   * Get all suppliers with shipment counts
   */
  static async getSuppliersWithShipmentCounts(): Promise<
    Array<Supplier & { shipment_count: string }>
  > {
    return supplierRepository.getAllWithShipmentCounts();
  }

  /**
   * Search suppliers
   */
  static async searchSuppliers(query: string): Promise<Supplier[]> {
    return supplierRepository.search(query);
  }
}

export default SupplierController;
