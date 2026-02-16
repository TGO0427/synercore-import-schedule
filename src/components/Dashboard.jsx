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
  const getCurrentWeek = () => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((((now - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
  };

  const getShipmentStats = () => {
    const supplierOrderRefs = {};
    const warehouseOrderRefs = {};
    const weekOrderRefs = {};
    const currentWeek = getCurrentWeek();

    // Per-week status tracking for deltas
    const weekStatusRefs = { curr: { total: new Set(), planned: new Set(), inTransit: new Set(), arrived: new Set(), delayed: new Set() },
                             prev: { total: new Set(), planned: new Set(), inTransit: new Set(), arrived: new Set(), delayed: new Set() } };

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

      const wk = shipment.weekNumber;
      const weekBucket = wk === currentWeek ? 'curr' : wk === currentWeek - 1 ? 'prev' : null;

      let statusKey = null;
      switch (shipment.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          statusOrderRefs.planned.add(orderRef);
          statusKey = 'planned';
          break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
          statusOrderRefs.inTransit.add(orderRef);
          statusKey = 'inTransit';
          break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
          statusOrderRefs.arrived.add(orderRef);
          statusKey = 'arrived';
          break;
        case ShipmentStatus.DELAYED:
          statusOrderRefs.delayed.add(orderRef);
          statusKey = 'delayed';
          break;
        case ShipmentStatus.CANCELLED:
          statusOrderRefs.cancelled.add(orderRef);
          break;
        default:
          break;
      }

      // Track week deltas
      if (weekBucket) {
        weekStatusRefs[weekBucket].total.add(orderRef);
        if (statusKey) weekStatusRefs[weekBucket][statusKey].add(orderRef);
      }

      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unassigned';
      if (!warehouseOrderRefs[warehouse]) warehouseOrderRefs[warehouse] = new Set();
      warehouseOrderRefs[warehouse].add(orderRef);

      const supplier = shipment.supplier || 'Unknown';
      if (!supplierOrderRefs[supplier]) supplierOrderRefs[supplier] = new Set();
      supplierOrderRefs[supplier].add(orderRef);

      const week = shipment.weekNumber || 'N/A';
      if (!weekOrderRefs[week]) weekOrderRefs[week] = new Set();
      weekOrderRefs[week].add(orderRef);
    });

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
      byWeek: {},
      deltas: {
        total: weekStatusRefs.curr.total.size - weekStatusRefs.prev.total.size,
        planned: weekStatusRefs.curr.planned.size - weekStatusRefs.prev.planned.size,
        inTransit: weekStatusRefs.curr.inTransit.size - weekStatusRefs.prev.inTransit.size,
        arrived: weekStatusRefs.curr.arrived.size - weekStatusRefs.prev.arrived.size,
        delayed: weekStatusRefs.curr.delayed.size - weekStatusRefs.prev.delayed.size,
      }
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

  const statusTotal = useMemo(() => statusChartData.reduce((s, i) => s + i.value, 0), [statusChartData]);

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

  const supplierTotal = useMemo(() => topSuppliersData.reduce((s, i) => s + i.count, 0), [topSuppliersData]);

  const weeklyTrendData = useMemo(() => {
    const currentWeek = getCurrentWeek();
    const maxWeek = currentWeek + 2;
    const entries = Object.entries(stats.byWeek)
      .filter(([w]) => w !== 'N/A')
      .map(([w, c]) => [Number(w), c])
      .filter(([w]) => w <= maxWeek)
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

  const upcomingOrders = getUpcomingOrders();

  const getColorForWarehouse = (index) => {
    const colors = ['var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  };

  const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32', '#64748b', '#64748b'];

  // Color map for SVG (CSS vars don't work in SVG)
  const colorMap = { 'var(--warning)': '#f59e0b', 'var(--info)': '#3b82f6', 'var(--success)': '#10b981', 'var(--danger)': '#ef4444' };

  // Generate SVG pie chart (donut style)
  const generatePieChart = (data, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const innerRadius = radius * 0.55;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    let currentAngle = -Math.PI / 2;
    const slices = [];

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
        <path key={index} d={path} fill={fillColor} />
      );

      currentAngle = endAngle;
    });

    return slices;
  };

  // KPI card config with deltas
  const kpiCards = [
    { key: 'total', value: stats.total, label: 'Total Shipments', icon: '📦', ring: 'ring-accent', tint: 'rgba(5,150,105,0.1)', filter: null, delta: stats.deltas.total },
    { key: 'transit', value: stats.inTransit, label: 'In Transit', icon: '🚢', ring: 'ring-info', tint: 'rgba(59,130,246,0.1)', filter: 'in_transit', delta: stats.deltas.inTransit },
    { key: 'arrived', value: stats.arrived, label: 'Arrived', icon: '✅', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)', filter: 'arrived', delta: stats.deltas.arrived },
    { key: 'delayed', value: stats.delayed, label: 'Delayed', icon: '⚠️', ring: 'ring-danger', tint: 'rgba(239,68,68,0.1)', filter: 'delayed', delta: stats.deltas.delayed },
    { key: 'planned', value: stats.planned, label: 'Planned', icon: '📅', ring: 'ring-warning', tint: 'rgba(245,158,11,0.1)', filter: 'planned', delta: stats.deltas.planned },
  ];

  // Delta display helper
  const renderDelta = (delta) => {
    if (delta > 0) return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>↑ {delta} vs last week</span>;
    if (delta < 0) return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>↓ {Math.abs(delta)} vs last week</span>;
    return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-500)', opacity: 0.6 }}>— vs last week</span>;
  };

  // Panel header helper
  const PanelHeader = ({ icon, title, subtitle }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-900)' }}>{title}</h4>
        {subtitle && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-500)' }}>{subtitle}</p>}
      </div>
    </div>
  );

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
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: '0 0 4px' }}>
              {card.label}
            </p>
            {renderDelta(card.delta)}
          </div>
        ))}
      </div>

      {/* Charts Grid — 2×2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1.25rem',
        marginTop: '1.5rem',
      }}>
        {/* Weekly Trend Sparkline */}
        {weeklyTrendData.values.length > 1 && (
          <div className="dash-panel">
            <PanelHeader icon="📈" title="Weekly Trend" subtitle="Last 12 weeks" />
            <div style={{ height: 160 }}>
              <Line data={sparklineConfig.data} options={sparklineConfig.options} />
            </div>
          </div>
        )}

        {/* Status Distribution (donut) */}
        {statusChartData.length > 0 && (
          <div className="dash-panel">
            <PanelHeader icon="📊" title="Status Distribution" subtitle="By current status" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <svg width="150" height="150" viewBox="0 0 150 150">
                  {generatePieChart(statusChartData, 150, 150)}
                </svg>
                {/* Center total */}
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy-900)' }}>{statusTotal}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-500)' }}>total</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusChartData.map(item => {
                  const pct = statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0;
                  return (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        backgroundColor: colorMap[item.fill] || item.fill, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, color: 'var(--text-700)', minWidth: 70 }}>{item.name}</span>
                      <strong style={{ fontSize: 13, color: 'var(--text-900)' }}>{item.value}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-500)' }}>({pct}%)</span>
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
            <PanelHeader icon="🏭" title="By Warehouse" subtitle={`${warehouseChartData.length} location${warehouseChartData.length !== 1 ? 's' : ''}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {warehouseChartData.map((warehouse, idx) => (
                <div key={warehouse.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-700)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{warehouse.name}</span>
                    <strong style={{ fontSize: 13, color: 'var(--text-900)' }}>{warehouse.count}</strong>
                  </div>
                  <div style={{
                    height: 10, backgroundColor: 'var(--border)',
                    borderRadius: 5, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(warehouse.count / Math.max(...warehouseChartData.map(w => w.count))) * 100}%`,
                      backgroundColor: getColorForWarehouse(idx),
                      borderRadius: 5,
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
            <PanelHeader icon="🏆" title="Top Suppliers" subtitle="By shipment volume" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topSuppliersData.map((supplier, idx) => (
                <div key={supplier.name} style={{
                  padding: '10px 12px', backgroundColor: 'var(--surface-2)',
                  borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      color: '#fff', backgroundColor: RANK_COLORS[idx] || '#64748b', flexShrink: 0,
                    }}>{idx + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-900)', flex: 1 }}>{supplier.name}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text-700)',
                      backgroundColor: 'var(--surface)', padding: '3px 10px',
                      borderRadius: 12, border: '1px solid var(--border)',
                    }}>
                      {supplier.count}
                    </span>
                  </div>
                  {/* Proportion bar */}
                  <div style={{ height: 4, backgroundColor: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${supplierTotal > 0 ? (supplier.count / supplierTotal) * 100 : 0}%`,
                      backgroundColor: RANK_COLORS[idx] || '#64748b',
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                      opacity: 0.6,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Orders */}
      {upcomingOrders.length > 0 && (
        <div className="dash-panel" style={{ marginTop: '1.5rem' }}>
          <PanelHeader icon="📋" title="Upcoming Orders" subtitle={`Next ${upcomingOrders.length} due`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingOrders.map(shipment => (
              <div key={shipment.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', backgroundColor: 'var(--surface-2)',
                borderRadius: 8, borderLeft: '3px solid var(--info)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
                onClick={() => onNavigate('shipping', { statusFilter: shipment.latestStatus })}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
              >
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
          paddingTop: '1.5rem', borderTop: '1px solid var(--border)',
        }}>
          <button className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('shipping')}>
            📋 Shipping Schedule
          </button>
          <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('reports')}>
            📊 Reports
          </button>
          <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('capacity')}>
            🏭 Warehouse Capacity
          </button>
          {onOpenLiveBoard && (
            <button className="btn" style={{
              padding: '10px 20px', fontSize: 13,
              background: 'var(--navy-900)', color: 'white', border: 'none',
            }}
              onClick={onOpenLiveBoard}>
              📺 Live Board
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
