import React from 'react';
import { ShipmentStatus } from '../types/shipment';

function Dashboard({ shipments }) {
  const getShipmentStats = () => {
    const stats = {
      total: shipments.length,
      planned: 0,
      inTransit: 0,
      arrived: 0,
      delayed: 0,
      cancelled: 0
    };

    const now = new Date();
    
    shipments.forEach(shipment => {
      switch (shipment.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          stats.planned++;
          break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
          stats.inTransit++;
          break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
          stats.arrived++;
          break;
        case ShipmentStatus.DELAYED:
          stats.delayed++;
          break;
        case ShipmentStatus.CANCELLED:
          stats.cancelled++;
          break;
        default:
          break;
      }
    });

    return stats;
  };

  const stats = getShipmentStats();

  const getUpcomingOrders = () => {
    const currentWeek = getCurrentWeek();
    
    return shipments
      .filter(shipment => {
        return shipment.weekNumber && shipment.weekNumber >= currentWeek && 
               shipment.latestStatus !== ShipmentStatus.ARRIVED_PTA &&
               shipment.latestStatus !== ShipmentStatus.ARRIVED_KLM &&
               shipment.latestStatus !== ShipmentStatus.CANCELLED;
      })
      .sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0))
      .slice(0, 5);
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((((now - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
  };

  const upcomingOrders = getUpcomingOrders();

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{stats.total}</h3>
          <p>Total Shipments</p>
        </div>
        <div className="stat-card">
          <h3>{stats.inTransit}</h3>
          <p>In Transit</p>
        </div>
        <div className="stat-card">
          <h3>{stats.arrived}</h3>
          <p>Arrived</p>
        </div>
        <div className="stat-card">
          <h3>{stats.delayed}</h3>
          <p>Delayed</p>
        </div>
        <div className="stat-card">
          <h3>{stats.planned}</h3>
          <p>Planned</p>
        </div>
      </div>

      {upcomingOrders.length > 0 && (
        <div className="upload-section">
          <h3 style={{ marginBottom: '1rem', color: '#333' }}>Upcoming Orders</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {upcomingOrders.map(shipment => (
              <div key={shipment.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0',
                borderBottom: '1px solid #eee'
              }}>
                <div>
                  <strong>{shipment.orderRef}</strong> - {shipment.finalPod}
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {shipment.supplier}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>Week {shipment.weekNumber}</div>
                  <div className={`status-badge status-${shipment.latestStatus}`}>
                    {shipment.latestStatus.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;