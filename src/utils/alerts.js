// src/utils/alerts.js
export function computeShipmentAlerts(shipments) {
  const alerts = [];
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  const endOfToday = new Date();
  endOfToday.setHours(23,59,59,999);

  // Get start of next week for early arrival warnings
  const startOfNextWeek = new Date();
  startOfNextWeek.setDate(startOfNextWeek.getDate() + (7 - startOfNextWeek.getDay()));
  startOfNextWeek.setHours(0,0,0,0);

  for (const s of shipments) {
    const base = {
      id: `ship-${s.id}-${s.latestStatus}-${s.weekNumber || 'no-week'}`,
      ts: now,
      read: false,
      meta: {
        supplier: s.supplier,
        product: s.productName,
        orderRef: s.orderRef,
        status: s.latestStatus,
        week: s.weekNumber,
        palletQty: s.palletQty || s.cbm,
        finalPod: s.finalPod
      }
    };

    // Critical alerts - require immediate attention
    if (s.latestStatus === 'delayed') {
      alerts.push({
        ...base,
        severity: 'critical',
        title: 'Delayed Shipment',
        description: `${s.supplier} - ${s.productName || s.orderRef} is delayed and requires attention.`
      });
    }

    if (s.latestStatus === 'cancelled') {
      alerts.push({
        ...base,
        severity: 'critical',
        title: 'Cancelled Shipment',
        description: `${s.supplier} - ${s.productName || s.orderRef} has been cancelled.`
      });
    }

    // Warning alerts - important but not critical
    if (s.latestStatus === 'inspection_failed') {
      alerts.push({
        ...base,
        severity: 'warning',
        title: 'Inspection Failed',
        description: `${s.productName || s.orderRef} failed inspection and needs review.`
      });
    }

    if (s.latestStatus === 'inspection_pending') {
      alerts.push({
        ...base,
        severity: 'warning',
        title: 'Inspection Pending',
        description: `${s.productName || s.orderRef} is awaiting inspection.`
      });
    }

    // Info alerts - general notifications
    if (s.latestStatus === 'arrived_pta' || s.latestStatus === 'arrived_klm' || s.latestStatus === 'arrived_offsite') {
      const arrivalLocation = s.latestStatus === 'arrived_pta' ? 'PTA' : s.latestStatus === 'arrived_klm' ? 'KLM' : 'OFFSITE';
      alerts.push({
        ...base,
        severity: 'info',
        title: 'Shipment Arrived',
        description: `${s.supplier} - ${s.productName || s.orderRef} has arrived at ${arrivalLocation}.`
      });
    }

    if (s.latestStatus === 'unloading') {
      alerts.push({
        ...base,
        severity: 'info',
        title: 'Unloading in Progress',
        description: `${s.productName || s.orderRef} is currently being unloaded.`
      });
    }

    if (s.latestStatus === 'inspection_passed') {
      alerts.push({
        ...base,
        severity: 'info',
        title: 'Inspection Passed',
        description: `${s.productName || s.orderRef} has passed inspection and is ready for processing.`
      });
    }

    // Weekly schedule alerts based on current week
    const currentWeek = getCurrentWeekNumber();
    if (s.weekNumber) {
      const shipmentWeek = parseInt(s.weekNumber);

      // Current week arrivals - show ALL shipments regardless of status
      if (shipmentWeek === currentWeek) {
        alerts.push({
          ...base,
          id: `ship-${s.id}-week-current`,
          severity: 'info',
          title: 'Arrival This Week',
          description: `${s.supplier} - ${s.productName || s.orderRef} (Week ${shipmentWeek}) - Status: ${s.latestStatus}`
        });
      }

      // Next week arrivals - show ALL shipments regardless of status
      if (shipmentWeek === currentWeek + 1) {
        alerts.push({
          ...base,
          id: `ship-${s.id}-week-next`,
          severity: 'info',
          title: 'Arrival Next Week',
          description: `${s.supplier} - ${s.productName || s.orderRef} (Week ${shipmentWeek}) - Status: ${s.latestStatus}`
        });
      }

      // Overdue shipments (past scheduled date and not arrived)
      // Only flag as overdue if selectedWeekDate exists and is in the past
      let isOverdue = false;
      if (s.selectedWeekDate) {
        const scheduledDate = new Date(s.selectedWeekDate);
        const currentDate = new Date();
        // Consider overdue if scheduled date was more than a week ago
        isOverdue = scheduledDate < currentDate && (currentDate - scheduledDate) > (7 * 24 * 60 * 60 * 1000);
      } else {
        // Fallback to week number comparison only for current year
        const currentYear = new Date().getFullYear();
        // Only compare weeks if we're in the same year context
        isOverdue = shipmentWeek < currentWeek;
      }

      if (isOverdue && !['arrived_pta', 'arrived_klm', 'arrived_offsite', 'unloading', 'inspection_pending', 'inspecting', 'inspection_failed', 'inspection_passed', 'receiving', 'received', 'stored', 'delayed', 'cancelled'].includes(s.latestStatus)) {
        alerts.push({
          ...base,
          id: `ship-${s.id}-overdue`,
          severity: 'warning',
          title: 'Overdue Shipment',
          description: `${s.supplier} - ${s.productName || s.orderRef} was scheduled for week ${shipmentWeek} but hasn't arrived yet.`
        });
      }
    }

    // High value shipments (based on pallet quantity)
    const palletQty = s.palletQty || s.cbm;
    if (palletQty && parseFloat(palletQty) > 50) {
      if (s.latestStatus === 'planned_airfreight' || s.latestStatus === 'planned_seafreight') {
        alerts.push({
          ...base,
          id: `ship-${s.id}-high-value`,
          severity: 'info',
          title: 'High Volume Shipment',
          description: `Large shipment (${palletQty} pallets) from ${s.supplier} requires tracking.`
        });
      }
    }
  }

  // Remove duplicates based on id and return sorted by severity and timestamp
  const map = new Map();
  for (const a of alerts) {
    map.set(a.id, a);
  }

  return Array.from(map.values()).sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity] || b.ts - a.ts;
  });
}

// Helper function to get current week number (simple calendar week)
function getCurrentWeekNumber() {
  const now = new Date();
  // Get January 1st of current year
  const yearStart = new Date(now.getFullYear(), 0, 1);
  // Calculate days since start of year
  const daysSinceStart = Math.floor((now - yearStart) / (24 * 60 * 60 * 1000));
  // Calculate week number (1-based)
  const weekNumber = Math.ceil((daysSinceStart + yearStart.getDay() + 1) / 7);

  // Ensure we don't exceed reasonable week range (1-52)
  return Math.min(Math.max(weekNumber, 1), 52);
}

// Helper function to create custom alerts
export function createCustomAlert(severity = 'info', title, description, meta = {}) {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ts: Date.now(),
    read: false,
    severity,
    title,
    description,
    meta
  };
}