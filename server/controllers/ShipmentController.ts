/**
 * Shipment Controller
 * Handles all shipment-related business logic
 */

import type { Shipment, ShipmentStatus } from '../types/index.js';
import { AppError } from '../utils/AppError.js';
import { shipmentRepository } from '../db/repositories/index.js';

/**
 * Create shipment request body
 */
export interface CreateShipmentRequest {
  orderRef: string;
  supplier: string;
  quantity: number;
  weekNumber?: number;
  notes?: string;
}

/**
 * Update shipment request body
 */
export interface UpdateShipmentRequest {
  latestStatus?: ShipmentStatus;
  notes?: string;
  quantity?: number;
}

/**
 * Shipment filter parameters
 */
export interface ShipmentFilterParams {
  status?: ShipmentStatus;
  supplier?: string;
  weekNumber?: number;
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

/**
 * Shipment Controller Class
 */
export class ShipmentController {
  /**
   * Get all shipments with filtering and pagination
   */
  static async getShipments(params: ShipmentFilterParams): Promise<{
    shipments: Shipment[];
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
      const results = await shipmentRepository.search(params.search);
      return {
        shipments: results.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total: results.length,
          pages: Math.ceil(results.length / limit)
        }
      };
    }

    // Get filtered shipments
    const filter: Record<string, any> = {};
    if (params.status) filter.latest_status = params.status;
    if (params.supplier) filter.supplier = params.supplier;
    if (params.weekNumber) filter.week_number = params.weekNumber;

    const shipments = await shipmentRepository.findAll({
      filter,
      pagination: { page, limit }
    });

    const total = await shipmentRepository.count(filter);

    return {
      shipments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single shipment by ID
   */
  static async getShipment(id: string): Promise<Shipment> {
    const shipment = await shipmentRepository.findById(id);

    if (!shipment) {
      throw AppError.notFound(`Shipment with ID ${id} not found`);
    }

    return shipment;
  }

  /**
   * Create new shipment
   */
  static async createShipment(data: CreateShipmentRequest): Promise<Shipment> {
    // Validate order reference doesn't already exist
    const existing = await shipmentRepository.findByOrderRef(data.orderRef);
    if (existing) {
      throw AppError.conflict(`Shipment with order reference ${data.orderRef} already exists`);
    }

    // Create shipment
    const shipment = await shipmentRepository.create({
      id: `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order_ref: data.orderRef,
      supplier: data.supplier,
      quantity: data.quantity,
      latest_status: 'planned_airfreight' as ShipmentStatus,
      week_number: data.weekNumber,
      notes: data.notes,
      created_at: new Date(),
      updated_at: new Date()
    } as Partial<Shipment>);

    return shipment;
  }

  /**
   * Update shipment
   */
  static async updateShipment(id: string, data: UpdateShipmentRequest): Promise<Shipment> {
    // Verify shipment exists
    await this.getShipment(id);

    // Update shipment
    const shipment = await shipmentRepository.update(id, {
      ...data,
      updated_at: new Date()
    } as Partial<Shipment>);

    return shipment;
  }

  /**
   * Update shipment status
   */
  static async updateShipmentStatus(
    id: string,
    status: ShipmentStatus,
    notes?: string
  ): Promise<Shipment> {
    // Verify shipment exists
    await this.getShipment(id);

    // Update status
    const shipment = await shipmentRepository.updateStatus(id, status, notes);

    return shipment;
  }

  /**
   * Delete shipment
   */
  static async deleteShipment(id: string): Promise<void> {
    // Verify shipment exists
    await this.getShipment(id);

    // Delete shipment
    const deleted = await shipmentRepository.delete(id);

    if (!deleted) {
      throw AppError.internal('Failed to delete shipment');
    }
  }

  /**
   * Archive shipment
   */
  static async archiveShipment(id: string): Promise<Shipment> {
    // Verify shipment exists
    await this.getShipment(id);

    return shipmentRepository.archive(id);
  }

  /**
   * Unarchive shipment
   */
  static async unarchiveShipment(id: string): Promise<Shipment> {
    // Verify shipment exists
    await this.getShipment(id);

    return shipmentRepository.unarchive(id);
  }

  /**
   * Get shipment statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    stored: number;
    inTransit: number;
    arrived: number;
    archived: number;
  }> {
    return shipmentRepository.getStatistics();
  }

  /**
   * Get shipments by status
   */
  static async getShipmentsByStatus(status: ShipmentStatus): Promise<Shipment[]> {
    return shipmentRepository.findByStatus(status);
  }

  /**
   * Get shipments by supplier
   */
  static async getShipmentsBySupplier(supplier: string): Promise<Shipment[]> {
    return shipmentRepository.findBySupplier(supplier);
  }

  /**
   * Get shipments by week
   */
  static async getShipmentsByWeek(weekNumber: number): Promise<Shipment[]> {
    return shipmentRepository.findByWeek(weekNumber);
  }
}

export default ShipmentController;
