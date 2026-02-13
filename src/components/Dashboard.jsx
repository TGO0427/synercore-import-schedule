import React, { useMemo } from 'react';
import { ShipmentStatus } from '../types/shipment';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

function Dashboard({ shipments, onNavigate, onOpenLiveBoard }) {
  const getShipmentStats = () => {
    // Track unique ORDER/REF per supplier
    const supplierOrderRefs = {};
    const warehouseOrderRefs = {};
    const weekOrderRefs = {};
    const statusOrderRefs = {
      planned: new Set(),
      inTransit: new Set(),
      arrived: new Set(),
      delayed: new Set(),
      cancelled: new Set()
    };

    shipments.forEach(shipment => {
      const orderRef = shipment.orderRef;
      if (!orderRef) return;

      // Track status by unique orderRef
      switch (shipment.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          statusOrderRefs.planned.add(orderRef);
          break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
          statusOrderRefs.inTransit.add(orderRef);
          break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
          statusOrderRefs.arrived.add(orderRef);
          break;
        case ShipmentStatus.DELAYED:
          statusOrderRefs.delayed.add(orderRef);
          break;
        case ShipmentStatus.CANCELLED:
          statusOrderRefs.cancelled.add(orderRef);
          break;
        default:
          break;
      }

      // Track unique orderRefs by warehouse
      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unassigned';
      if (!warehouseOrderRefs[warehouse]) warehouseOrderRefs[warehouse] = new Set();
      warehouseOrderRefs[warehouse].add(orderRef);

      // Track unique orderRefs by supplier
      const supplier = shipment.supplier || 'Unknown';
      if (!supplierOrderRefs[supplier]) supplierOrderRefs[supplier] = new Set();
      supplierOrderRefs[supplier].add(orderRef);

      // Track unique orderRefs by week
      const week = shipment.weekNumber || 'N/A';
      if (!weekOrderRefs[week]) weekOrderRefs[week] = new Set();
      weekOrderRefs[week].add(orderRef);
    });

    // Convert Sets to counts
    const uniqueOrderRefs = new Set(shipments.map(s => s.orderRef).filter(Boolean));

    const stats = {
      total: uniqueOrderRefs.size,
      planned: statusOrderRefs.planned.size,
      inTransit: statusOrderRefs.inTransit.size,
      arrived: statusOrderRefs.arrived.size,
      delayed: statusOrderRefs.delayed.size,
      cancelled: statusOrderRefs.cancelled.size,
      byWarehouse: {},
      bySupplier: {},
      byWeek: {}
    };

    Object.keys(warehouseOrderRefs).forEach(warehouse => {
      stats.byWarehouse[warehouse] = warehouseOrderRefs[warehouse].size;
    });
    Object.keys(supplierOrderRefs).forEach(supplier => {
      stats.bySupplier[supplier] = supplierOrderRefs[supplier].size;
    });
    Object.keys(weekOrderRefs).forEach(week => {
      stats.byWeek[week] = weekOrderRefs[week].size;
    });

    return stats;
  };

  const stats = getShipmentStats();

  // Prepare chart data
  const statusChartData = useMemo(() => [
    { name: 'Planned', value: stats.planned, fill: 'var(--warning)' },
    { name: 'In Transit', value: stats.inTransit, fill: 'var(--info)' },
    { name: 'Arrived', value: stats.arrived, fill: 'var(--success)' },
    { name: 'Delayed', value: stats.delayed, fill: 'var(--danger)' },
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

  // Sparkline data — last 12 weeks sorted
  const weeklyTrendData = useMemo(() => {
    const entries = Object.entries(stats.byWeek)
      .filter(([w]) => w !== 'N/A')
      .map(([w, c]) => [Number(w), c])
      .sort(([a], [b]) => a - b)
      .slice(-12);
    return {
      labels: entries.map(([w]) => `W${w}`),
      values: entries.map(([, c]) => c),
    };
  }, [stats.byWeek]);

  const getUpcomingOrders = () => {
    const currentWeek = getCurrentWeek();
    return shipments
      .filter(shipment =>
        shipment.weekNumber && shipment.weekNumber >= currentWeek &&
        shipment.latestStatus !== ShipmentStatus.ARRIVED_PTA &&
        shipment.latestStatus !== ShipmentStatus.ARRIVED_KLM &&
        shipment.latestStatus !== ShipmentStatus.CANCELLED
      )
      .sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0))
      .slice(0, 5);
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((((now - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
  };

  const upcomingOrders = getUpcomingOrders();

  const getColorForWarehouse = (index) => {
    const colors = ['var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  };

  // Generate SVG pie chart (donut style)
  const generatePieChart = (data, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const innerRadius = radius * 0.55;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    let currentAngle = -Math.PI / 2;
    const slices = [];

    // Need raw color values for SVG fill (CSS vars don't work in SVG)
    const colorMap = {
      'var(--warning)': '#f59e0b',
      'var(--info)': '#3b82f6',
      'var(--success)': '#10b981',
      'var(--danger)': '#ef4444',
    };

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      const outerStartX = cx + radius * Math.cos(currentAngle);
      const outerStartY = cy + radius * Math.sin(currentAngle);
      const outerEndX = cx + radius * Math.cos(endAngle);
      const outerEndY = cy + radius * Math.sin(endAngle);
      const innerStartX = cx + innerRadius * Math.cos(endAngle);
      const innerStartY = cy + innerRadius * Math.sin(endAngle);
      const innerEndX = cx + innerRadius * Math.cos(currentAngle);
      const innerEndY = cy + innerRadius * Math.sin(currentAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const fillColor = colorMap[item.fill] || item.fill;

      const path = `M ${outerStartX} ${outerStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerStartX} ${innerStartY} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEndX} ${innerEndY} Z`;

      slices.push(
        <path key={index} d={path} fill={fillColor} opacity="0.85" />
      );

      currentAngle = endAngle;
    });

    return slices;
  };

  // KPI card config
  const kpiCards = [
    { key: 'total', value: stats.total, label: 'Total Shipments', icon: '📦', ring: 'ring-accent', tint: 'rgba(5,150,105,0.1)', filter: null },
    { key: 'transit', value: stats.inTransit, label: 'In Transit', icon: '🚢', ring: 'ring-info', tint: 'rgba(59,130,246,0.1)', filter: 'in_transit' },
    { key: 'arrived', value: stats.arrived, label: 'Arrived', icon: '✅', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)', filter: 'arrived' },
    { key: 'delayed', value: stats.delayed, label: 'Delayed', icon: '⚠️', ring: 'ring-danger', tint: 'rgba(239,68,68,0.1)', filter: 'delayed' },
    { key: 'planned', value: stats.planned, label: 'Planned', icon: '📅', ring: 'ring-warning', tint: 'rgba(245,158,11,0.1)', filter: 'planned' },
  ];

  // Sparkline chart config
  const sparklineConfig = useMemo(() => ({
    data: {
      labels: weeklyTrendData.labels,
      datasets: [{
        data: weeklyTrendData.values,
        borderColor: '#059669',
        backgroundColor: 'rgba(5,150,105,0.08)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#059669',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${item.raw} shipments`,
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } },
          border: { display: false },
        },
        y: {
          display: false,
        },
      },
    },
  }), [weeklyTrendData]);

  return (
    <div style={{ padding: '1rem' }}>
      {/* Brand focus strip */}
      <div className="brand-strip" />

      {/* KPI Cards */}
      <div className="stats-grid">
        {kpiCards.map(card => (
          <div key={card.key} className={`stat-card ${card.ring} clickable`}
            onClick={() => onNavigate('shipping', { statusFilter: card.filter })}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18,
              backgroundColor: card.tint, marginBottom: 10,
            }}>
              {card.icon}
            </div>
            <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{card.value}</h3>
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>
              {card.label}
            </p>
            <span style={{ fontSize: 11, color: 'var(--text-500)', opacity: 0.7 }}>— vs last week</span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.25rem',
        marginTop: '1.5rem',
      }}>
        {/* Weekly Trend Sparkline */}
        {weeklyTrendData.values.length > 1 && (
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-700)' }}>Weekly Trend</h4>
            <div style={{ height: 200 }}>
              <Line data={sparklineConfig.data} options={sparklineConfig.options} />
            </div>
          </div>
        )}

        {/* Status Distribution (donut) */}
        {statusChartData.length > 0 && (
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-700)' }}>Status Distribution</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
                {generatePieChart(statusChartData, 160, 160)}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {statusChartData.map(item => {
                  const colorMap = { 'var(--warning)': '#f59e0b', 'var(--info)': '#3b82f6', 'var(--success)': '#10b981', 'var(--danger)': '#ef4444' };
                  return (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        backgroundColor: colorMap[item.fill] || item.fill,
                      }} />
                      <span style={{ fontSize: 13, color: 'var(--text-700)' }}>{item.name}</span>
                      <strong style={{ fontSize: 13, color: 'var(--text-900)', marginLeft: 'auto' }}>{item.value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Warehouse Distribution */}
        {warehouseChartData.length > 0 && (
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-700)' }}>Shipments by Warehouse</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {warehouseChartData.map((warehouse, idx) => (
                <div key={warehouse.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-700)' }}>{warehouse.name}</span>
                    <span style={{ color: 'var(--text-500)' }}>{warehouse.count}</span>
                  </div>
                  <div style={{
                    height: 8, backgroundColor: 'var(--surface-2)',
                    borderRadius: 4, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(warehouse.count / Math.max(...warehouseChartData.map(w => w.count))) * 100}%`,
                      backgroundColor: getColorForWarehouse(idx),
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Suppliers */}
        {topSuppliersData.length > 0 && (
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-700)' }}>Top 5 Suppliers</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topSuppliersData.map((supplier, idx) => (
                <div key={supplier.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', backgroundColor: 'var(--surface-2)',
                  borderRadius: 8, borderLeft: `3px solid ${getColorForWarehouse(idx)}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-900)' }}>
                    <span style={{ color: 'var(--text-500)', marginRight: 6 }}>#{idx + 1}</span>
                    {supplier.name}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text-700)',
                    backgroundColor: 'var(--surface)', padding: '3px 10px',
                    borderRadius: 12, border: '1px solid var(--border)',
                  }}>
                    {supplier.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Orders */}
      {upcomingOrders.length > 0 && (
        <div className="dash-panel" style={{ marginTop: '1.25rem' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-700)' }}>Upcoming Orders</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingOrders.map(shipment => (
              <div key={shipment.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', backgroundColor: 'var(--surface-2)',
                borderRadius: 8, borderLeft: '3px solid var(--info)',
              }}>
                <div>
                  <strong style={{ color: 'var(--text-900)', fontSize: 13 }}>{shipment.orderRef}</strong>
                  <span style={{ color: 'var(--text-500)', fontSize: 13 }}> — {shipment.finalPod}</span>
                  <div style={{ fontSize: 12, color: 'var(--text-500)', marginTop: 2 }}>{shipment.supplier}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-700)' }}>Week {shipment.weekNumber}</div>
                  <div className={`status-badge status-${shipment.latestStatus}`} style={{ fontSize: 11 }}>
                    {shipment.latestStatus.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {onNavigate && (
        <div style={{
          display: 'flex', gap: 12, marginTop: '1.5rem', flexWrap: 'wrap',
        }}>
          <button className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('shipping')}>
            View Shipping Schedule
          </button>
          <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('reports')}>
            View Reports
          </button>
          <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('capacity')}>
            Warehouse Capacity
          </button>
          {onOpenLiveBoard && (
            <button className="btn" style={{
              padding: '10px 20px', fontSize: 13,
              background: 'var(--navy-900)', color: 'white', border: 'none',
            }}
              onClick={onOpenLiveBoard}>
              Live Board
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
