/**
 * Shipment Controller
 * Handles all shipment-related business logic
 */

import type { Shipment, ShipmentStatus } from '../types/index.js';
import { AppError } from '../utils/AppError.ts';
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
  supplier?: string;
  orderRef?: string;
  finalPod?: string;
  cbm?: number;
  palletQty?: number;
  weekNumber?: number;
  productName?: string;
  receivingWarehouse?: string;
  forwardingAgent?: string;
  vesselName?: string;
  incoterm?: string;
  selectedWeekDate?: string;
  updatedAt?: string;
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

    // Convert camelCase to snake_case for database
    const dbData: Record<string, any> = {
      updated_at: new Date()
    };

    if (data.latestStatus !== undefined) {
      dbData.latest_status = data.latestStatus;
    }
    if (data.quantity !== undefined) {
      dbData.quantity = data.quantity;
    }
    if (data.notes !== undefined) {
      dbData.notes = data.notes;
    }
    if (data.supplier !== undefined) {
      dbData.supplier = data.supplier;
    }
    if (data.orderRef !== undefined) {
      dbData.order_ref = data.orderRef;
    }
    if (data.finalPod !== undefined) {
      dbData.final_pod = data.finalPod;
    }
    if (data.cbm !== undefined) {
      dbData.cbm = data.cbm;
    }
    if (data.palletQty !== undefined) {
      dbData.pallet_qty = data.palletQty;
    }
    if (data.weekNumber !== undefined) {
      dbData.week_number = data.weekNumber;
    }
    if (data.productName !== undefined) {
      dbData.product_name = data.productName;
    }
    if (data.receivingWarehouse !== undefined) {
      dbData.receiving_warehouse = data.receivingWarehouse;
    }
    if (data.forwardingAgent !== undefined) {
      dbData.forwarding_agent = data.forwardingAgent;
    }
    if (data.vesselName !== undefined) {
      dbData.vessel_name = data.vesselName;
    }
    if (data.incoterm !== undefined) {
      dbData.incoterm = data.incoterm;
    }
    if (data.selectedWeekDate !== undefined) {
      dbData.selected_week_date = data.selectedWeekDate;
    }

    // Update shipment
    const shipment = await shipmentRepository.update(id, dbData as Partial<Shipment>);

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

  /**
   * Get post-arrival shipments (shipments that have arrived and are in workflow)
   */
  static async getPostArrivalShipments(): Promise<Shipment[]> {
    const postArrivalStates = [
      'arrived_pta',
      'arrived_klm',
      'arrived_offsite',
      'unloading',
      'inspection_pending',
      'inspecting',
      'inspection_failed',
      'inspection_passed',
      'receiving',
      'received'
    ] as ShipmentStatus[];

    const shipments: Shipment[] = [];
    for (const status of postArrivalStates) {
      const statusShipments = await shipmentRepository.findByStatus(status);
      shipments.push(...statusShipments);
    }
    return shipments;
  }

  /**
   * Get archived shipments
   */
  static async getArchives(): Promise<Shipment[]> {
    return shipmentRepository.findArchived();
  }

  /**
   * Start unloading workflow
   */
  static async startUnloading(id: string): Promise<Shipment> {
    // Verify shipment exists
    const shipment = await this.getShipment(id);

    // Verify shipment is in a valid arrival state
    const validStates = ['arrived_pta', 'arrived_klm', 'arrived_offsite'];
    if (!validStates.includes(shipment.latest_status)) {
      throw AppError.conflict(
        `Shipment must be in one of these states to start unloading: ${validStates.join(', ')}`
      );
    }

    // Update status to unloading
    const updated = await shipmentRepository.update(id, {
      latest_status: 'unloading' as ShipmentStatus,
      unloading_start_date: new Date(),
      updated_at: new Date()
    } as Partial<Shipment>);

    return updated;
  }

  /**
   * Complete unloading workflow
   */
  static async completeUnloading(id: string): Promise<Shipment> {
    // Verify shipment exists
    const shipment = await this.getShipment(id);

    // Verify shipment is in unloading state
    if (shipment.latest_status !== 'unloading') {
      throw AppError.conflict('Shipment must be in unloading state to complete unloading');
    }

    // Update status to inspection_pending
    const updated = await shipmentRepository.update(id, {
      latest_status: 'inspection_pending' as ShipmentStatus,
      unloading_completed_date: new Date(),
      updated_at: new Date()
    } as Partial<Shipment>);

    return updated;
  }

  /**
   * Start inspection workflow
   */
  static async startInspection(
    id: string,
    inspectedBy?: string
  ): Promise<Shipment> {
    // Verify shipment exists
    const shipment = await this.getShipment(id);

    // Verify shipment is in inspection_pending state
    if (shipment.latest_status !== 'inspection_pending') {
      throw AppError.conflict('Shipment must be in inspection_pending state to start inspection');
    }

    // Update status to inspecting
    const updated = await shipmentRepository.update(id, {
      latest_status: 'inspecting' as ShipmentStatus,
      inspection_status: 'in_progress',
      inspected_by: inspectedBy || '',
      inspection_date: new Date(),
      updated_at: new Date()
    } as Partial<Shipment>);

    return updated;
  }

  /**
   * Complete inspection workflow
   */
  static async completeInspection(
    id: string,
    passed: boolean,
    notes?: string,
    inspectedBy?: string
  ): Promise<Shipment> {
    // Verify shipment exists
    const shipment = await this.getShipment(id);

    // Verify shipment is in inspecting state
    if (shipment.latest_status !== 'inspecting') {
      throw AppError.conflict('Shipment must be in inspecting state to complete inspection');
    }

    // Update status based on inspection result
    const updated = await shipmentRepository.update(id, {
      latest_status: (passed ? 'inspection_passed' : 'inspection_failed') as ShipmentStatus,
      inspection_status: passed ? 'passed' : 'failed',
      inspection_notes: notes || '',
      inspected_by: inspectedBy || shipment.inspected_by || '',
      updated_at: new Date()
    } as Partial<Shipment>);

    return updated;
  }

  /**
   * Start receiving workflow
   */
  static async startReceiving(
    id: string,
    receivedBy?: string
  ): Promise<Shipment> {
    // Verify shipment exists
    const shipment = await this.getShipment(id);

    // Verify shipment is in inspection_passed state
    if (shipment.latest_status !== 'inspection_passed') {
      throw AppError.conflict('Shipment must have passed inspection to start receiving');
    }

    // Update status to receiving
    const updated = await shipmentRepository.update(id, {
      latest_status: 'receiving' as ShipmentStatus,
      receiving_status: 'in_progress',
      received_by: receivedBy || '',
      receiving_date: new Date(),
      updated_at: new Date()
    } as Partial<Shipment>);

    return updated;
  }

  /**
   * Complete receiving workflow
   */
  static async completeReceiving(
    id: string,
    receivedQuantity?: number,
    receivedBy?: string
  ): Promise<Shipment> {
    // Verify shipment exists
    const shipment = await this.getShipment(id);

    // Verify shipment is in receiving state
    if (shipment.latest_status !== 'receiving') {
      throw AppError.conflict('Shipment must be in receiving state to complete receiving');
    }

    // Update status to received
    const updated = await shipmentRepository.update(id, {
      latest_status: 'received' as ShipmentStatus,
      receiving_status: 'completed',
      received_quantity: receivedQuantity,
      received_by: receivedBy || shipment.received_by || '',
      updated_at: new Date()
    } as Partial<Shipment>);

    return updated;
  }
}

export default ShipmentController;
