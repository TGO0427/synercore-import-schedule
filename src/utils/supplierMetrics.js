import { ShipmentStatus, InspectionStatus } from '../types/shipment';

/**
 * Calculate supplier KPI metrics
 * Returns on-time delivery %, inspection pass rate %, avg lead time, and supplier grade
 */

export class SupplierMetrics {
  /**
   * Helper: Filter shipments by supplier name
   * Handles case-insensitive matching
   */
  static getSupplierShipments(shipments, supplierName) {
    if (!supplierName) return [];

    const normalizedName = supplierName.toLowerCase().trim();
    return shipments.filter(s => {
      const shipmentSupplier = s.supplier?.toLowerCase().trim();
      return shipmentSupplier === normalizedName;
    });
  }

  /**
   * Calculate on-time delivery percentage for a supplier
   * On-time = shipments that arrived in or before their scheduled week
   */
  static calculateOnTimeDelivery(shipments, supplierName) {
    const supplierShipments = this.getSupplierShipments(shipments, supplierName);

    if (supplierShipments.length === 0) return 0;

    // Count shipments that arrived on time
    const arrivedShipments = supplierShipments.filter(s => {
      const isArrived = [
        ShipmentStatus.ARRIVED_PTA,
        ShipmentStatus.ARRIVED_KLM,
        ShipmentStatus.ARRIVED_OFFSITE,
        ShipmentStatus.STORED,
        ShipmentStatus.RECEIVED
      ].includes(s.latestStatus);

      if (!isArrived) return false;

      // Check if arrived on time
      // If no selectedWeekDate, use estimatedArrival
      const arrivedDate = s.receivingDate || s.updatedAt;
      if (!arrivedDate || !s.weekNumber) return true; // Assume on-time if missing data

      const scheduledDate = s.selectedWeekDate || this.estimateDateFromWeek(s.weekNumber);
      const actualDate = new Date(arrivedDate);

      return actualDate <= new Date(scheduledDate);
    });

    return Math.round((arrivedShipments.length / supplierShipments.length) * 100);
  }

  /**
   * Calculate inspection pass rate for a supplier
   */
  static calculateInspectionPassRate(shipments, supplierName) {
    const supplierShipments = this.getSupplierShipments(shipments, supplierName)
      .filter(s => s.inspectionDate);

    if (supplierShipments.length === 0) return null; // No inspections yet

    const passedShipments = supplierShipments.filter(
      s => s.inspectionStatus === InspectionStatus.PASSED || s.inspectionStatus === 'passed'
    );

    return Math.round((passedShipments.length / supplierShipments.length) * 100);
  }

  /**
   * Calculate average lead time in days
   * Lead time = actual arrival date - scheduled week date
   */
  static calculateAverageLeadTime(shipments, supplierName) {
    const supplierShipments = this.getSupplierShipments(shipments, supplierName)
      .filter(s => s.receivingDate && s.weekNumber);

    if (supplierShipments.length === 0) return null;

    const leadTimes = supplierShipments.map(s => {
      const scheduledDate = new Date(s.selectedWeekDate || this.estimateDateFromWeek(s.weekNumber));
      const actualDate = new Date(s.receivingDate);
      const diffMs = actualDate - scheduledDate;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays;
    });

    const avgLeadTime = Math.round(
      leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
    );

    return avgLeadTime;
  }

  /**
   * Get 90-day trend for a metric
   * Returns array of values over last 90 days
   */
  static calculateMetricTrend(shipments, supplierName, metric = 'onTime', days = 90) {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const supplierShipments = this.getSupplierShipments(shipments, supplierName);

    // Group shipments by week
    const weeklyData = {};
    supplierShipments.forEach(s => {
      const shipmentDate = new Date(s.receivingDate || s.updatedAt || s.createdAt);
      if (shipmentDate < startDate) return;

      const weekKey = this.getWeekKey(shipmentDate);
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          total: 0,
          passed: 0,
          onTime: 0,
          date: shipmentDate
        };
      }

      weeklyData[weekKey].total++;

      if (metric === 'inspection') {
        if (s.inspectionStatus === InspectionStatus.PASSED || s.inspectionStatus === 'passed') {
          weeklyData[weekKey].passed++;
        }
      } else if (metric === 'onTime') {
        const isOnTime = this.isShipmentOnTime(s);
        if (isOnTime) {
          weeklyData[weekKey].onTime++;
        }
      }
    });

    // Convert to trend array
    const trend = Object.values(weeklyData)
      .sort((a, b) => a.date - b.date)
      .map(week => {
        if (metric === 'inspection') {
          return week.total > 0 ? Math.round((week.passed / week.total) * 100) : 0;
        } else {
          return week.total > 0 ? Math.round((week.onTime / week.total) * 100) : 0;
        }
      });

    return trend;
  }

  /**
   * Grade supplier based on KPI metrics
   */
  static getSupplierGrade(onTimePercent, passRatePercent) {
    if (onTimePercent >= 85 && (passRatePercent === null || passRatePercent >= 90)) {
      return { grade: 'A', label: 'Excellent', color: '#28a745' };
    } else if (onTimePercent >= 70 && (passRatePercent === null || passRatePercent >= 80)) {
      return { grade: 'B', label: 'Good', color: '#ffc107' };
    } else {
      return { grade: 'C', label: 'Needs Improvement', color: '#dc3545' };
    }
  }

  /**
   * Get total number of shipments from supplier
   */
  static getTotalShipments(shipments, supplierName) {
    return this.getSupplierShipments(shipments, supplierName).length;
  }

  /**
   * Helper: Check if shipment was on time
   */
  static isShipmentOnTime(shipment) {
    const isArrived = [
      ShipmentStatus.ARRIVED_PTA,
      ShipmentStatus.ARRIVED_KLM,
      ShipmentStatus.ARRIVED_OFFSITE,
      ShipmentStatus.STORED,
      ShipmentStatus.RECEIVED
    ].includes(shipment.latestStatus);

    if (!isArrived) return false;

    const arrivedDate = shipment.receivingDate || shipment.updatedAt;
    if (!arrivedDate || !shipment.weekNumber) return true;

    const scheduledDate = shipment.selectedWeekDate || this.estimateDateFromWeek(shipment.weekNumber);
    return new Date(arrivedDate) <= new Date(scheduledDate);
  }

  /**
   * Helper: Estimate date from week number
   */
  static estimateDateFromWeek(weekNumber) {
    const year = new Date().getFullYear();
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    return simple.toISOString().split('T')[0];
  }

  /**
   * Helper: Get week key for grouping
   */
  static getWeekKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const week = this.getWeekNumber(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * Helper: Get ISO week number
   */
  static getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Calculate all metrics for a supplier
   */
  static calculateAllMetrics(shipments, supplierName) {
    const onTimePercent = this.calculateOnTimeDelivery(shipments, supplierName);
    const passRatePercent = this.calculateInspectionPassRate(shipments, supplierName);
    const avgLeadTime = this.calculateAverageLeadTime(shipments, supplierName);
    const totalShipments = this.getTotalShipments(shipments, supplierName);
    const trend = this.calculateMetricTrend(shipments, supplierName, 'onTime');
    const grade = this.getSupplierGrade(onTimePercent, passRatePercent);

    return {
      supplierName,
      onTimePercent,
      passRatePercent,
      avgLeadTime,
      totalShipments,
      trend,
      grade
    };
  }
}
