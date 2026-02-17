import React, { useMemo } from 'react';
import { ShipmentStatus } from '../types/shipment';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';

// Reusable chart wrapper
const ChartCard = ({ title, subtitle, children, style }) => (
  <div className="dash-panel" style={style}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-900)' }}>{title}</h4>
      {subtitle && <span style={{ fontSize: 11, color: 'var(--text-500)' }}>{subtitle}</span>}
    </div>
    {children}
  </div>
);

const ChartEmpty = ({ label }) => (
  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-500)', fontSize: 13 }}>{label}</div>
);

const STATUS_COLORS = { Planned: '#f59e0b', 'In Transit': '#3b82f6', Arrived: '#10b981', Delayed: '#ef4444', Cancelled: '#6b7280' };
const WAREHOUSE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32', '#64748b', '#64748b'];

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

    const weekStatusRefs = {
      curr: { total: new Set(), planned: new Set(), inTransit: new Set(), arrived: new Set(), delayed: new Set() },
      prev: { total: new Set(), planned: new Set(), inTransit: new Set(), arrived: new Set(), delayed: new Set() },
    };

    const statusOrderRefs = { planned: new Set(), inTransit: new Set(), arrived: new Set(), delayed: new Set(), cancelled: new Set() };

    shipments.forEach(shipment => {
      const orderRef = shipment.orderRef;
      if (!orderRef) return;

      const wk = shipment.weekNumber;
      const weekBucket = wk === currentWeek ? 'curr' : wk === currentWeek - 1 ? 'prev' : null;

      let statusKey = null;
      switch (shipment.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          statusOrderRefs.planned.add(orderRef); statusKey = 'planned'; break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
          statusOrderRefs.inTransit.add(orderRef); statusKey = 'inTransit'; break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
          statusOrderRefs.arrived.add(orderRef); statusKey = 'arrived'; break;
        case ShipmentStatus.DELAYED:
          statusOrderRefs.delayed.add(orderRef); statusKey = 'delayed'; break;
        case ShipmentStatus.CANCELLED:
          statusOrderRefs.cancelled.add(orderRef); break;
        default: break;
      }

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
      },
    };

    Object.keys(warehouseOrderRefs).forEach(w => { stats.byWarehouse[w] = warehouseOrderRefs[w].size; });
    Object.keys(supplierOrderRefs).forEach(s => { stats.bySupplier[s] = supplierOrderRefs[s].size; });
    Object.keys(weekOrderRefs).forEach(w => { stats.byWeek[w] = weekOrderRefs[w].size; });

    return stats;
  };

  const stats = getShipmentStats();

  // Status donut data
  const statusChartData = useMemo(() => [
    { name: 'Planned', value: stats.planned },
    { name: 'In Transit', value: stats.inTransit },
    { name: 'Arrived', value: stats.arrived },
    { name: 'Delayed', value: stats.delayed },
    { name: 'Cancelled', value: stats.cancelled },
  ].filter(item => item.value > 0), [stats]);

  const statusTotal = useMemo(() => statusChartData.reduce((s, i) => s + i.value, 0), [statusChartData]);

  // Warehouse bar data
  const warehouseChartData = useMemo(() =>
    Object.entries(stats.byWarehouse).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count), [stats.byWarehouse]);

  // Top suppliers
  const topSuppliersData = useMemo(() =>
    Object.entries(stats.bySupplier)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })), [stats.bySupplier]);

  const supplierTotal = useMemo(() => topSuppliersData.reduce((s, i) => s + i.count, 0), [topSuppliersData]);

  // Weekly trend (orders per week)
  const weeklyTrend = useMemo(() => {
    const currentWeek = getCurrentWeek();
    const maxWeek = currentWeek + 2;
    return Object.entries(stats.byWeek)
      .filter(([w]) => w !== 'N/A')
      .map(([w, c]) => ({ week: `W${w}`, orders: c, _wk: Number(w) }))
      .filter(d => d._wk <= maxWeek)
      .sort((a, b) => a._wk - b._wk)
      .slice(-12);
  }, [stats.byWeek]);

  // Products & Pallets trend
  const productsPalletsTrend = useMemo(() => {
    const currentWeek = getCurrentWeek();
    const maxWeek = currentWeek + 2;
    const weeks = {};
    (shipments || []).forEach(s => {
      const wk = Number(s.weekNumber) || 0;
      if (wk === 0 || wk > maxWeek) return;
      if (!weeks[wk]) weeks[wk] = { products: 0, pallets: 0 };
      weeks[wk].products += 1;
      weeks[wk].pallets += Math.round(Number(s.palletQty) || 0);
    });
    const sorted = Object.keys(weeks).map(Number).sort((a, b) => a - b).slice(-12);
    if (sorted.length < 2) return null;
    return sorted.map(w => ({ week: `W${w}`, products: weeks[w].products, pallets: weeks[w].pallets }));
  }, [shipments]);

  // Offsite storage duration
  const offsiteChartData = useMemo(() => {
    const now = new Date();
    const offsite = (shipments || []).filter(s =>
      (s.latestStatus === 'stored' || s.latestStatus === 'archived') &&
      (s.receivingWarehouse || '').toUpperCase() === 'OFFSITE'
    );
    if (offsite.length === 0) return [];
    return offsite
      .map(s => {
        const storedDate = s.receivingDate || s.updatedAt || s.estimatedArrival;
        const days = storedDate ? Math.max(0, Math.floor((now - new Date(storedDate)) / (1000 * 60 * 60 * 24))) : 0;
        const label = `${s.orderRef || 'N/A'} — ${(s.productName || 'Unknown').slice(0, 25)}`;
        return { label, days };
      })
      .sort((a, b) => b.days - a.days);
  }, [shipments]);

  const getUpcomingOrders = () => {
    const currentWeek = getCurrentWeek();
    return shipments
      .filter(s =>
        s.weekNumber && s.weekNumber >= currentWeek &&
        s.latestStatus !== ShipmentStatus.ARRIVED_PTA &&
        s.latestStatus !== ShipmentStatus.ARRIVED_KLM &&
        s.latestStatus !== ShipmentStatus.CANCELLED
      )
      .sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0))
      .slice(0, 5);
  };

  const upcomingOrders = getUpcomingOrders();

  // KPI cards
  const kpiCards = [
    { key: 'total', value: stats.total, label: 'Total Shipments', icon: '📦', ring: 'ring-accent', tint: 'rgba(5,150,105,0.1)', filter: null, delta: stats.deltas.total },
    { key: 'transit', value: stats.inTransit, label: 'In Transit', icon: '🚢', ring: 'ring-info', tint: 'rgba(59,130,246,0.1)', filter: 'in_transit', delta: stats.deltas.inTransit },
    { key: 'arrived', value: stats.arrived, label: 'Arrived', icon: '✅', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)', filter: 'arrived', delta: stats.deltas.arrived },
    { key: 'delayed', value: stats.delayed, label: 'Delayed', icon: '⚠️', ring: 'ring-danger', tint: 'rgba(239,68,68,0.1)', filter: 'delayed', delta: stats.deltas.delayed },
    { key: 'planned', value: stats.planned, label: 'Planned', icon: '📅', ring: 'ring-warning', tint: 'rgba(245,158,11,0.1)', filter: 'planned', delta: stats.deltas.planned },
  ];

  const renderDelta = (delta) => {
    if (delta > 0) return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>↑ {delta} vs last week</span>;
    if (delta < 0) return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>↓ {Math.abs(delta)} vs last week</span>;
    return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-500)', opacity: 0.6 }}>— vs last week</span>;
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div className="brand-strip" />

      {/* KPI Cards */}
      <div className="stats-grid">
        {kpiCards.map(card => (
          <div key={card.key} className={`stat-card ${card.ring} clickable`}
            onClick={() => onNavigate('shipping', { statusFilter: card.filter })}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18,
              backgroundColor: card.tint, marginBottom: 10,
            }}>{card.icon}</div>
            <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{card.value}</h3>
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: '0 0 4px' }}>
              {card.label}
            </p>
            {renderDelta(card.delta)}
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginTop: '1.5rem' }}>

        {/* Weekly Trend — Orders vs Shipments */}
        <ChartCard title="Weekly Trend" subtitle="Orders per week">
          {weeklyTrend && weeklyTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="orders" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty label="No trend data yet" />
          )}
        </ChartCard>

        {/* Status Distribution — Donut */}
        <ChartCard title="Status Distribution" subtitle="By current status">
          {statusChartData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70}
                    paddingAngle={2} dataKey="value"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusChartData.map(item => {
                  const pct = statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0;
                  return (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: STATUS_COLORS[item.name] || '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-700)', minWidth: 70 }}>{item.name}</span>
                      <strong style={{ fontSize: 13, color: 'var(--text-900)' }}>{item.value}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-500)' }}>({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ChartEmpty label="No status data" />
          )}
        </ChartCard>

        {/* Warehouse Distribution — Bar */}
        <ChartCard title="By Warehouse" subtitle={`${warehouseChartData.length} locations`} style={{ alignSelf: 'start' }}>
          {warehouseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={warehouseChartData.length * 50 + 20}>
              <BarChart data={warehouseChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} width={90} />
                <Tooltip formatter={(value) => [`${value} orders`]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {warehouseChartData.map((_, idx) => (
                    <Cell key={idx} fill={WAREHOUSE_COLORS[idx % WAREHOUSE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty label="No warehouse data" />
          )}
        </ChartCard>

        {/* Top Suppliers */}
        <ChartCard title="Top Suppliers" subtitle="By shipment volume">
          {topSuppliersData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topSuppliersData.map((supplier, idx) => (
                <div key={supplier.name} style={{ padding: '10px 12px', backgroundColor: 'var(--surface-2)', borderRadius: 8 }}>
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
                    }}>{supplier.count}</span>
                  </div>
                  <div style={{ height: 4, backgroundColor: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${supplierTotal > 0 ? (supplier.count / supplierTotal) * 100 : 0}%`,
                      backgroundColor: RANK_COLORS[idx] || '#64748b',
                      borderRadius: 2, opacity: 0.6,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ChartEmpty label="No supplier data" />
          )}
        </ChartCard>

        {/* Products & Pallets by Week */}
        <ChartCard title="Products & Pallets by Week" subtitle="Weekly incoming volume" style={{ gridColumn: '1 / -1' }}>
          {productsPalletsTrend && productsPalletsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={productsPalletsTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="products" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Products" />
                <Line type="monotone" dataKey="pallets" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Pallets" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty label="No trend data yet" />
          )}
        </ChartCard>

        {/* Offsite Storage Duration */}
        {offsiteChartData.length > 0 && (
          <ChartCard title="Offsite Storage Duration" subtitle={`${offsiteChartData.length} items · Days in storage`} style={{ gridColumn: '1 / -1' }}>
            <ResponsiveContainer width="100%" height={offsiteChartData.length * 40 + 30}>
              <BarChart data={offsiteChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Days', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fontWeight: 500 }} width={220} />
                <Tooltip
                  formatter={(value) => [`${value} days`, 'Storage']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={22}>
                  {offsiteChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.days > 30 ? '#ef4444' : entry.days > 14 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#10b981', display: 'inline-block' }} /> 0–14 days
              </span>
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#f59e0b', display: 'inline-block' }} /> 15–30 days
              </span>
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ef4444', display: 'inline-block' }} /> 30+ days
              </span>
            </div>
          </ChartCard>
        )}
      </div>

      {/* Upcoming Orders */}
      {upcomingOrders.length > 0 && (
        <div className="dash-panel" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-900)' }}>Upcoming Orders</h4>
            <span style={{ fontSize: 11, color: 'var(--text-500)' }}>Next {upcomingOrders.length} due</span>
          </div>
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
            Shipping Schedule
          </button>
          <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
            onClick={() => onNavigate('reports')}>
            Reports
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
