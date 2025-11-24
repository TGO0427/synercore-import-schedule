// server/websocket/shipmentEvents.ts
import socketManager from './socketManager.js';
import type { Shipment } from '../types/index.js';

/**
 * Emit shipment status change event
 * @param shipmentId - Shipment ID
 * @param shipment - Full shipment object with new status
 * @param changedBy - User/system that changed the status
 */
export function emitShipmentStatusChange(
  shipmentId: string,
  shipment: any,
  changedBy: string = 'system'
): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.broadcastShipmentUpdate(shipmentId, {
    shipmentId,
    status: shipment.status,
    statusChangedAt: shipment.status_changed_at,
    changedBy,
    shipment: {
      id: shipment.id,
      poNumber: shipment.po_number,
      status: shipment.status,
      eta: shipment.eta,
      inspectionStatus: shipment.inspection_status,
      expectedArrivalDate: shipment.expected_arrival_date,
      actualArrivalDate: shipment.actual_arrival_date,
    }
  });
}

/**
 * Emit document upload event
 * @param shipmentId - Shipment ID
 * @param document - Document object
 * @param uploadedBy - User that uploaded the document
 */
export function emitDocumentUploaded(
  shipmentId: string,
  document: any,
  uploadedBy: string = 'system'
): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.broadcastDocumentUpload(shipmentId, {
    id: document.id,
    fileName: document.file_name || document.fileName,
    documentType: document.document_type || document.documentType,
    fileSize: document.file_size || document.fileSize,
    uploadedAt: document.uploaded_at || document.uploadedAt,
    uploadedBy,
    isVerified: document.is_verified || document.isVerified || false
  });
}

/**
 * Emit warehouse capacity change
 * @param capacityData - Warehouse capacity data
 */
export function emitWarehouseCapacityChange(capacityData: any): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.getIO()!.emit('warehouse:capacity_updated', {
    ...capacityData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit inspection status change
 * @param shipmentId - Shipment ID
 * @param inspection - Inspection object with status
 */
export function emitInspectionStatusChange(
  shipmentId: string,
  inspection: any
): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.broadcastShipmentUpdate(shipmentId, {
    shipmentId,
    inspectionStatus: inspection.status,
    inspectionUpdatedAt: inspection.updated_at,
    inspection: {
      status: inspection.status,
      notes: inspection.notes,
      result: inspection.result,
      inspectorId: inspection.inspector_id,
    }
  });
}

/**
 * Emit shipment rejection
 * @param shipmentId - Shipment ID
 * @param rejection - Rejection object
 */
export function emitShipmentRejection(
  shipmentId: string,
  rejection: any
): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.broadcastShipmentUpdate(shipmentId, {
    shipmentId,
    status: 'rejected',
    rejectionReason: rejection.reason,
    rejectionDetails: rejection.details,
    rejectedAt: rejection.created_at,
    rejectionImageUrl: rejection.image_url
  });
}

/**
 * Emit inventory update
 * @param shipmentId - Shipment ID
 * @param inventory - Updated inventory data
 */
export function emitInventoryUpdate(
  shipmentId: string,
  inventory: any
): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.broadcastShipmentUpdate(shipmentId, {
    shipmentId,
    inventory: {
      pallets: inventory.num_pallets,
      cartons: inventory.num_cartons,
      items: inventory.num_items,
      weight: inventory.total_weight,
      warehouseLocation: inventory.warehouse_location
    }
  });
}

/**
 * Emit supplier portal document upload
 * @param shipmentId - Shipment ID
 * @param document - Supplier-uploaded document
 */
export function emitSupplierDocumentUpload(
  shipmentId: string,
  document: any
): void {
  if (!socketManager.getIO()) return; // WebSocket not initialized

  socketManager.broadcastDocumentUpload(shipmentId, {
    id: document.id,
    fileName: document.file_name,
    documentType: document.document_type,
    uploadedBy: document.uploaded_by || 'supplier',
    uploadedAt: document.uploaded_at,
    isVerified: document.is_verified || false,
    uploadedBySupplier: true
  });
}
