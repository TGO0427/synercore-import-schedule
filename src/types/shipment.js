export const ShipmentStatus = {
  PLANNED_AIRFREIGHT: 'planned_airfreight',
  PLANNED_SEAFREIGHT: 'planned_seafreight',
  IN_TRANSIT_AIRFREIGHT: 'in_transit_airfreight',
  IN_TRANSIT_ROADWAY: 'in_transit_roadway',
  IN_TRANSIT_SEAWAY: 'in_transit_seaway',
  MOORED: 'moored',
  BERTH_WORKING: 'berth_working',
  BERTH_COMPLETE: 'berth_complete',
  ARRIVED_PTA: 'arrived_pta',
  ARRIVED_KLM: 'arrived_klm',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
  // Post-arrival workflow states
  UNLOADING: 'unloading',
  INSPECTION_PENDING: 'inspection_pending',
  INSPECTING: 'inspecting',
  INSPECTION_FAILED: 'inspection_failed',
  INSPECTION_PASSED: 'inspection_passed',
  RECEIVING: 'receiving',
  RECEIVED: 'received',
  STORED: 'stored'
};

export const InspectionStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PASSED: 'passed',
  FAILED: 'failed',
  REQUIRES_REVIEW: 'requires_review'
};

export const ReceivingStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PARTIAL: 'partial',
  COMPLETED: 'completed',
  DISCREPANCY: 'discrepancy'
};

export const ShipmentPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

export const Incoterms = {
  EXW: 'EXW', // Ex Works
  FCA: 'FCA', // Free Carrier
  CPT: 'CPT', // Carriage Paid To
  CIP: 'CIP', // Carriage and Insurance Paid To
  DAP: 'DAP', // Delivered At Place
  DPU: 'DPU', // Delivered At Place Unloaded
  DDP: 'DDP', // Delivered Duty Paid
  FAS: 'FAS', // Free Alongside Ship
  FOB: 'FOB', // Free On Board
  CFR: 'CFR', // Cost and Freight
  CIF: 'CIF'  // Cost, Insurance and Freight
};

export class Shipment {
  constructor({
    id,
    supplier,
    orderRef,
    finalPod,
    latestStatus = ShipmentStatus.PLANNED_AIRFREIGHT,
    weekNumber,
    productName,
    quantity,
    palletQty = 0,
    receivingWarehouse,
    forwardingAgent = '',
    vesselName = '',
    incoterm = '',
    priority = ShipmentPriority.MEDIUM,
    notes = '',
    // Post-arrival workflow fields
    inspectionStatus = InspectionStatus.NOT_STARTED,
    receivingStatus = ReceivingStatus.NOT_STARTED,
    inspectionNotes = '',
    receivingNotes = '',
    inspectedBy = '',
    receivedBy = '',
    inspectionDate = null,
    receivingDate = null,
    receivedQuantity = null,
    discrepancies = [],
    unloadingStartDate = null,
    unloadingCompletedDate = null
  }) {
    this.id = id;
    this.supplier = supplier;
    this.orderRef = orderRef;
    this.finalPod = finalPod;
    this.latestStatus = latestStatus;
    this.weekNumber = weekNumber;
    this.productName = productName;
    this.quantity = quantity;
    this.palletQty = palletQty;
    this.receivingWarehouse = receivingWarehouse;
    this.forwardingAgent = forwardingAgent;
    this.vesselName = vesselName;
    this.incoterm = incoterm;
    this.priority = priority;
    this.notes = notes;

    // Post-arrival workflow fields
    this.inspectionStatus = inspectionStatus;
    this.receivingStatus = receivingStatus;
    this.inspectionNotes = inspectionNotes;
    this.receivingNotes = receivingNotes;
    this.inspectedBy = inspectedBy;
    this.receivedBy = receivedBy;
    this.inspectionDate = inspectionDate;
    this.receivingDate = receivingDate;
    this.receivedQuantity = receivedQuantity;
    this.discrepancies = discrepancies;
    this.unloadingStartDate = unloadingStartDate;
    this.unloadingCompletedDate = unloadingCompletedDate;

    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  updateStatus(newStatus) {
    this.latestStatus = newStatus;
    this.updatedAt = new Date();
  }

  isDelayed() {
    return this.latestStatus === ShipmentStatus.DELAYED;
  }

  isArrived() {
    return this.latestStatus === ShipmentStatus.ARRIVED_PTA || this.latestStatus === ShipmentStatus.ARRIVED_KLM;
  }

  isInPostArrivalWorkflow() {
    const postArrivalStates = [
      ShipmentStatus.UNLOADING,
      ShipmentStatus.INSPECTION_PENDING,
      ShipmentStatus.INSPECTING,
      ShipmentStatus.INSPECTION_FAILED,
      ShipmentStatus.INSPECTION_PASSED,
      ShipmentStatus.RECEIVING,
      ShipmentStatus.RECEIVED,
      ShipmentStatus.STORED
    ];
    return postArrivalStates.includes(this.latestStatus);
  }

  startUnloading() {
    this.latestStatus = ShipmentStatus.UNLOADING;
    this.unloadingStartDate = new Date();
    this.updatedAt = new Date();
  }

  completeUnloading() {
    this.latestStatus = ShipmentStatus.INSPECTION_PENDING;
    this.unloadingCompletedDate = new Date();
    this.updatedAt = new Date();
  }

  startInspection(inspectedBy = '') {
    this.latestStatus = ShipmentStatus.INSPECTING;
    this.inspectionStatus = InspectionStatus.IN_PROGRESS;
    this.inspectedBy = inspectedBy;
    this.inspectionDate = new Date();
    this.updatedAt = new Date();
  }

  completeInspection(passed = true, notes = '', inspectedBy = '') {
    this.inspectionStatus = passed ? InspectionStatus.PASSED : InspectionStatus.FAILED;
    this.latestStatus = passed ? ShipmentStatus.INSPECTION_PASSED : ShipmentStatus.INSPECTION_FAILED;
    this.inspectionNotes = notes;
    if (inspectedBy) this.inspectedBy = inspectedBy;
    this.updatedAt = new Date();
  }

  startReceiving(receivedBy = '') {
    this.latestStatus = ShipmentStatus.RECEIVING;
    this.receivingStatus = ReceivingStatus.IN_PROGRESS;
    this.receivedBy = receivedBy;
    this.receivingDate = new Date();
    this.updatedAt = new Date();
  }

  completeReceiving(receivedQuantity, notes = '', receivedBy = '', discrepancies = []) {
    this.receivedQuantity = receivedQuantity;
    this.receivingNotes = notes;
    this.discrepancies = discrepancies;
    if (receivedBy) this.receivedBy = receivedBy;

    if (discrepancies.length > 0) {
      this.receivingStatus = ReceivingStatus.DISCREPANCY;
    } else if (receivedQuantity < this.quantity) {
      this.receivingStatus = ReceivingStatus.PARTIAL;
    } else {
      this.receivingStatus = ReceivingStatus.COMPLETED;
      this.latestStatus = ShipmentStatus.RECEIVED;
    }
    this.updatedAt = new Date();
  }

  markAsStored() {
    this.latestStatus = ShipmentStatus.STORED;
    this.updatedAt = new Date();
  }

  getCurrentWeek() {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((now - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
    return weekNumber;
  }

  getWorkflowProgress() {
    const states = [
      ShipmentStatus.ARRIVED_PTA,
      ShipmentStatus.ARRIVED_KLM,
      ShipmentStatus.UNLOADING,
      ShipmentStatus.INSPECTION_PENDING,
      ShipmentStatus.INSPECTING,
      ShipmentStatus.INSPECTION_PASSED,
      ShipmentStatus.RECEIVING,
      ShipmentStatus.RECEIVED,
      ShipmentStatus.STORED
    ];

    const currentIndex = states.indexOf(this.latestStatus);
    return {
      currentStep: currentIndex + 1,
      totalSteps: states.length,
      percentage: Math.round(((currentIndex + 1) / states.length) * 100)
    };
  }
}