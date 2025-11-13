import React, { useMemo } from 'react';
import { ShipmentStatus } from '../types/shipment';

function Dashboard({ shipments }) {
  const getShipmentStats = () => {
    const stats = {
      total: shipments.length,
      planned: 0,
      inTransit: 0,
      arrived: 0,
      delayed: 0,
      cancelled: 0,
      byWarehouse: {},
      bySupplier: {},
      byWeek: {}
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

      // Track by warehouse
      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unassigned';
      stats.byWarehouse[warehouse] = (stats.byWarehouse[warehouse] || 0) + 1;

      // Track by supplier
      const supplier = shipment.supplier || 'Unknown';
      stats.bySupplier[supplier] = (stats.bySupplier[supplier] || 0) + 1;

      // Track by week
      const week = shipment.weekNumber || 'N/A';
      stats.byWeek[week] = (stats.byWeek[week] || 0) + 1;
    });

    return stats;
  };

  const stats = getShipmentStats();

  // Prepare chart data
  const statusChartData = useMemo(() => [
    { name: 'Planned', value: stats.planned, fill: '#3b82f6' },
    { name: 'In Transit', value: stats.inTransit, fill: '#f59e0b' },
    { name: 'Arrived', value: stats.arrived, fill: '#10b981' },
    { name: 'Delayed', value: stats.delayed, fill: '#ef4444' },
    { name: 'Cancelled', value: stats.cancelled, fill: '#6b7280' }
  ].filter(item => item.value > 0), [stats]);

  const warehouseChartData = useMemo(() =>
    Object.entries(stats.byWarehouse).map(([warehouse, count]) => ({
      name: warehouse,
      count
    })), [stats.byWarehouse]);

  const topSuppliersData = useMemo(() =>
    Object.entries(stats.bySupplier)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([supplier, count]) => ({
        name: supplier,
        count
      })), [stats.bySupplier]);

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

  // Helper function for warehouse colors
  const getColorForWarehouse = (index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  };

  // Helper function for ranking colors
  const getColorForRank = (index) => {
    const colors = ['#fbbf24', '#a3e635', '#60a5fa', '#34d399', '#f87171'];
    return colors[index % colors.length];
  };

  // Generate SVG pie chart
  const generatePieChart = (data, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    let currentAngle = -Math.PI / 2;
    const slices = [];

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      // Create arc path
      const startX = cx + radius * Math.cos(currentAngle);
      const startY = cy + radius * Math.sin(currentAngle);
      const endX = cx + radius * Math.cos(endAngle);
      const endY = cy + radius * Math.sin(endAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const path = `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;

      slices.push(
        <path key={index} d={path} fill={item.fill} />
      );

      currentAngle = endAngle;
    });

    return slices;
  };

  return (
    <div style={{ padding: '1rem' }}>
      {/* Stats Cards Row */}
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

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem',
        marginTop: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Status Distribution Pie Chart */}
        {statusChartData.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>📊 Shipment Status Distribution</h3>
            <div style={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '1rem' }}>
                  {statusChartData.map(item => (
                    <div key={item.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: item.fill
                      }}></div>
                      <span>{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
                <svg width="250" height="250" viewBox="0 0 250 250" style={{ margin: '0 auto' }}>
                  {generatePieChart(statusChartData, 250, 250)}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Warehouse Distribution Bar Chart */}
        {warehouseChartData.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>🏭 Shipments by Warehouse</h3>
            <div style={{ height: '300px', overflow: 'auto' }}>
              {warehouseChartData.map((warehouse, idx) => (
                <div key={warehouse.name} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: '500' }}>{warehouse.name}</span>
                    <span style={{ color: '#666' }}>{warehouse.count}</span>
                  </div>
                  <div style={{
                    height: '20px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(warehouse.count / Math.max(...warehouseChartData.map(w => w.count))) * 100}%`,
                      backgroundColor: getColorForWarehouse(idx),
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Suppliers */}
        {topSuppliersData.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>🏢 Top 5 Suppliers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topSuppliersData.map((supplier, idx) => (
                <div key={supplier.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${getColorForRank(idx)}`
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: '#333' }}>#{idx + 1} {supplier.name}</div>
                  </div>
                  <div style={{
                    backgroundColor: getColorForRank(idx),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }}>
                    {supplier.count} shipments
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Orders */}
      {upcomingOrders.length > 0 && (
        <div className="upload-section">
          <h3 style={{ marginBottom: '1rem', color: '#333' }}>📅 Upcoming Orders (Next 5)</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {upcomingOrders.map(shipment => (
              <div key={shipment.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                borderLeft: '4px solid #3b82f6',
                alignItems: 'center'
              }}>
                <div>
                  <strong style={{ color: '#333' }}>{shipment.orderRef}</strong> - {shipment.finalPod}
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {shipment.supplier}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Week {shipment.weekNumber}</div>
                  <div className={`status-badge status-${shipment.latestStatus}`} style={{ fontSize: '0.8rem' }}>
                    {shipment.latestStatus.replace(/_/g, ' ')}
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