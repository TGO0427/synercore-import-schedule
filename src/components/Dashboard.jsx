import React, { useMemo, useState, useEffect, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShipmentStatus, DELAYED_STATUSES, isDelayedStatus, PRE_ARRIVAL_STATUSES, getCurrentWeek } from '../types/shipment';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';
import PerformanceMetrics from './PerformanceMetrics';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line as LineChart, Doughnut, Bar as BarChart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement,
  Title, Tooltip, Legend, Filler,
);

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

const STATUS_COLORS = { Planned: '#f59e0b', 'In Transit': '#3b82f6', Stored: '#10b981', Delayed: '#ef4444', Cancelled: '#6b7280' };
const WAREHOUSE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32', '#64748b', '#64748b'];

function Dashboard({ shipments, onOpenLiveBoard }) {
  const navigate = useNavigate();
  const [detailShipment, setDetailShipment] = useState(null);
  const [warehouseData, setWarehouseData] = useState([]);
  const [newsHeadlines, setNewsHeadlines] = useState([]);

  // Fetch freight news headlines
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(getApiUrl('/api/news'));
        if (res.ok) {
          const result = await res.json();
          setNewsHeadlines(result.data || []);
        }
      } catch (err) { /* silently ignore */ }
    };
    fetchNews();
  }, []);

  // Fetch warehouse capacity data
  useEffect(() => {
    const fetchCapacity = async () => {
      try {
        const res = await authFetch(getApiUrl('/api/warehouse-capacity'));
        if (res.ok) {
          const data = await res.json();
          setWarehouseData(Array.isArray(data) ? data : (data.data || []));
        }
      } catch (err) { /* silently ignore */ }
    };
    fetchCapacity();
  }, []);

  // Consolidated single-pass computation: stats, percentage deltas, and offsite average
  const { stats, pctDeltas, avgDaysOffsite } = useMemo(() => {
    const supplierOrderRefs = {};
    const warehouseOrderRefs = {};
    const weekOrderRefs = {};
    const currentWeek = getCurrentWeek();

    const weekStatusRefs = {
      curr: { total: new Set(), planned: new Set(), inTransit: new Set(), stored: new Set(), delayed: new Set() },
      prev: { total: new Set(), planned: new Set(), inTransit: new Set(), stored: new Set(), delayed: new Set() },
    };

    const statusOrderRefs = { planned: new Set(), inTransit: new Set(), stored: new Set(), delayed: new Set(), cancelled: new Set() };

    // Status category arrays for pctDeltas computation
    const plannedStatuses = [ShipmentStatus.PLANNED_AIRFREIGHT, ShipmentStatus.PLANNED_SEAFREIGHT];
    const transitStatuses = [
      ShipmentStatus.IN_TRANSIT_AIRFREIGHT, ShipmentStatus.AIR_CUSTOMS_CLEARANCE,
      ShipmentStatus.IN_TRANSIT_ROADWAY, ShipmentStatus.IN_TRANSIT_SEAWAY,
      ShipmentStatus.MOORED, ShipmentStatus.BERTH_WORKING, ShipmentStatus.BERTH_COMPLETE,
    ];
    const storedStatuses = [
      ShipmentStatus.ARRIVED_PTA, ShipmentStatus.ARRIVED_KLM, ShipmentStatus.ARRIVED_OFFSITE,
      ShipmentStatus.UNLOADING, ShipmentStatus.INSPECTION_PENDING, ShipmentStatus.INSPECTING,
      ShipmentStatus.INSPECTION_PASSED, ShipmentStatus.INSPECTION_FAILED,
      ShipmentStatus.RECEIVING, ShipmentStatus.RECEIVED,
      ShipmentStatus.STORED, ShipmentStatus.ARCHIVED,
    ];

    // Date-based week-over-week counting for percentage deltas
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const dateWeekCounts = {
      thisWeek: { total: 0, planned: 0, inTransit: 0, stored: 0, delayed: 0 },
      lastWeek: { total: 0, planned: 0, inTransit: 0, stored: 0, delayed: 0 },
    };

    // Offsite average days tracking
    const offsitePostArrivalStatuses = [
      ShipmentStatus.ARRIVED_OFFSITE,
      ShipmentStatus.UNLOADING, ShipmentStatus.INSPECTION_PENDING, ShipmentStatus.INSPECTING,
      ShipmentStatus.INSPECTION_PASSED, ShipmentStatus.INSPECTION_FAILED,
      ShipmentStatus.RECEIVING, ShipmentStatus.RECEIVED,
      ShipmentStatus.STORED, ShipmentStatus.ARCHIVED,
    ];
    let offsiteDaysSum = 0;
    let offsiteCount = 0;

    shipments.forEach(shipment => {
      const orderRef = shipment.orderRef;
      if (!orderRef) return;

      const wk = shipment.weekNumber;
      const weekBucket = wk === currentWeek ? 'curr' : wk === currentWeek - 1 ? 'prev' : null;

      // Check if shipment is overdue: still pre-arrival but past its scheduled week
      const isOverdue = wk > 0 && wk < currentWeek && PRE_ARRIVAL_STATUSES.includes(shipment.latestStatus);

      let statusKey = null;
      switch (shipment.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          if (isOverdue) {
            statusOrderRefs.delayed.add(orderRef); statusKey = 'delayed';
          } else {
            statusOrderRefs.planned.add(orderRef); statusKey = 'planned';
          }
          break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.AIR_CUSTOMS_CLEARANCE:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
        case ShipmentStatus.MOORED:
        case ShipmentStatus.BERTH_WORKING:
        case ShipmentStatus.BERTH_COMPLETE:
          if (isOverdue) {
            statusOrderRefs.delayed.add(orderRef); statusKey = 'delayed';
          } else {
            statusOrderRefs.inTransit.add(orderRef); statusKey = 'inTransit';
          }
          break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
        case ShipmentStatus.ARRIVED_OFFSITE:
        case ShipmentStatus.UNLOADING:
        case ShipmentStatus.INSPECTION_PENDING:
        case ShipmentStatus.INSPECTING:
        case ShipmentStatus.INSPECTION_PASSED:
        case ShipmentStatus.INSPECTION_FAILED:
        case ShipmentStatus.RECEIVING:
        case ShipmentStatus.RECEIVED:
        case ShipmentStatus.STORED:
        case ShipmentStatus.ARCHIVED:
          statusOrderRefs.stored.add(orderRef); statusKey = 'stored'; break;
        case ShipmentStatus.DELAYED_PORT:
        case ShipmentStatus.DELAYED_CUSTOMS:
        case ShipmentStatus.DELAYED_DOCUMENTS:
        case ShipmentStatus.DELAYED_SUPPLIER:
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

      // Date-based week-over-week counting for pctDeltas
      const d = new Date(shipment.updatedAt || shipment.createdAt);
      const shipmentIsDelayed = isDelayedStatus(shipment.latestStatus) ||
        (shipment.weekNumber > 0 && shipment.weekNumber < currentWeek && PRE_ARRIVAL_STATUSES.includes(shipment.latestStatus));
      let dateBucket = null;
      if (d >= oneWeekAgo) dateBucket = 'thisWeek';
      else if (d >= twoWeeksAgo) dateBucket = 'lastWeek';
      if (dateBucket) {
        dateWeekCounts[dateBucket].total++;
        if (shipmentIsDelayed) {
          dateWeekCounts[dateBucket].delayed++;
        } else if (plannedStatuses.includes(shipment.latestStatus)) {
          dateWeekCounts[dateBucket].planned++;
        } else if (transitStatuses.includes(shipment.latestStatus)) {
          dateWeekCounts[dateBucket].inTransit++;
        } else if (storedStatuses.includes(shipment.latestStatus)) {
          dateWeekCounts[dateBucket].stored++;
        }
      }

      // Average days in OFFSITE storage
      if (offsitePostArrivalStatuses.includes(shipment.latestStatus) &&
          (shipment.receivingWarehouse || '').toUpperCase() === 'OFFSITE') {
        const storedDate = new Date(shipment.receivingDate || shipment.updatedAt || shipment.createdAt);
        offsiteDaysSum += Math.max(0, Math.floor((Date.now() - storedDate.getTime()) / (1000 * 60 * 60 * 24)));
        offsiteCount++;
      }
    });

    const uniqueOrderRefs = new Set(shipments.map(s => s.orderRef).filter(Boolean));

    const result = {
      total: uniqueOrderRefs.size,
      planned: statusOrderRefs.planned.size,
      inTransit: statusOrderRefs.inTransit.size,
      stored: statusOrderRefs.stored.size,
      delayed: statusOrderRefs.delayed.size,
      cancelled: statusOrderRefs.cancelled.size,
      byWarehouse: {},
      bySupplier: {},
      byWeek: {},
      deltas: {
        total: weekStatusRefs.curr.total.size - weekStatusRefs.prev.total.size,
        planned: weekStatusRefs.curr.planned.size - weekStatusRefs.prev.planned.size,
        inTransit: weekStatusRefs.curr.inTransit.size - weekStatusRefs.prev.inTransit.size,
        stored: weekStatusRefs.curr.stored.size - weekStatusRefs.prev.stored.size,
        delayed: weekStatusRefs.curr.delayed.size - weekStatusRefs.prev.delayed.size,
      },
    };

    Object.keys(warehouseOrderRefs).forEach(w => { result.byWarehouse[w] = warehouseOrderRefs[w].size; });
    Object.keys(supplierOrderRefs).forEach(s => { result.bySupplier[s] = supplierOrderRefs[s].size; });
    Object.keys(weekOrderRefs).forEach(w => { result.byWeek[w] = weekOrderRefs[w].size; });

    // Compute percentage-based week-over-week deltas (single-pass)
    const computePctDelta = (tw, lw) => {
      if (lw === 0) return tw > 0 ? '+100%' : '0%';
      const pct = Math.round(((tw - lw) / lw) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    return {
      stats: result,
      pctDeltas: {
        total: computePctDelta(dateWeekCounts.thisWeek.total, dateWeekCounts.lastWeek.total),
        inTransit: computePctDelta(dateWeekCounts.thisWeek.inTransit, dateWeekCounts.lastWeek.inTransit),
        stored: computePctDelta(dateWeekCounts.thisWeek.stored, dateWeekCounts.lastWeek.stored),
        delayed: computePctDelta(dateWeekCounts.thisWeek.delayed, dateWeekCounts.lastWeek.delayed),
        planned: computePctDelta(dateWeekCounts.thisWeek.planned, dateWeekCounts.lastWeek.planned),
      },
      avgDaysOffsite: offsiteCount > 0 ? Math.round(offsiteDaysSum / offsiteCount) : 0,
    };
  }, [shipments]);

  // Supplier on-time trend (last 8 weeks)
  const supplierOnTimeTrend = useMemo(() => {
    const arrivedStatuses = [
      ShipmentStatus.ARRIVED_PTA, ShipmentStatus.ARRIVED_KLM, ShipmentStatus.ARRIVED_OFFSITE,
      ShipmentStatus.STORED, ShipmentStatus.RECEIVED, ShipmentStatus.ARCHIVED,
      ShipmentStatus.UNLOADING, ShipmentStatus.INSPECTION_PENDING, ShipmentStatus.INSPECTING,
      ShipmentStatus.INSPECTION_PASSED, ShipmentStatus.RECEIVING,
    ];
    const weeks = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const weekShipments = (shipments || []).filter(s => {
        const d = new Date(s.updatedAt || s.createdAt);
        return d >= weekStart && d < weekEnd;
      });
      const arrived = weekShipments.filter(s => arrivedStatuses.includes(s.latestStatus));
      const pct = weekShipments.length > 0 ? Math.round((arrived.length / weekShipments.length) * 100) : 0;
      const weekNum = Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      weeks.push({ label: `W${weekNum}`, pct });
    }
    return weeks;
  }, [shipments]);

  // Status donut data
  const statusChartData = useMemo(() => [
    { name: 'Planned', value: stats.planned },
    { name: 'In Transit', value: stats.inTransit },
    { name: 'Stored', value: stats.stored },
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
    const offsiteStatuses = [
      ShipmentStatus.ARRIVED_OFFSITE,
      ShipmentStatus.UNLOADING, ShipmentStatus.INSPECTION_PENDING, ShipmentStatus.INSPECTING,
      ShipmentStatus.INSPECTION_PASSED, ShipmentStatus.INSPECTION_FAILED,
      ShipmentStatus.RECEIVING, ShipmentStatus.RECEIVED,
      ShipmentStatus.STORED, ShipmentStatus.ARCHIVED,
    ];
    const offsite = (shipments || []).filter(s =>
      offsiteStatuses.includes(s.latestStatus) &&
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
    const activeStatuses = [
      ShipmentStatus.PLANNED_AIRFREIGHT, ShipmentStatus.PLANNED_SEAFREIGHT,
      ShipmentStatus.IN_TRANSIT_AIRFREIGHT, ShipmentStatus.IN_TRANSIT_SEAWAY,
      ShipmentStatus.IN_TRANSIT_ROADWAY, ShipmentStatus.AIR_CUSTOMS_CLEARANCE,
      ShipmentStatus.MOORED, ShipmentStatus.BERTH_WORKING, ShipmentStatus.BERTH_COMPLETE,
      ...DELAYED_STATUSES,
    ];
    return shipments
      .filter(s =>
        s.weekNumber && s.weekNumber >= currentWeek &&
        activeStatuses.includes(s.latestStatus)
      )
      .sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0))
      .slice(0, 5);
  };

  const upcomingOrders = getUpcomingOrders();

  // KPI cards
  const kpiCards = [
    { key: 'total', value: stats.total, label: 'Total Shipments', icon: '📦', ring: 'ring-accent', tint: 'rgba(5,150,105,0.1)', filter: null, delta: stats.deltas.total, pctDelta: pctDeltas.total },
    { key: 'transit', value: stats.inTransit, label: 'In Transit', icon: '🚢', ring: 'ring-info', tint: 'rgba(59,130,246,0.1)', filter: 'in_transit', delta: stats.deltas.inTransit, pctDelta: pctDeltas.inTransit, info: stats.inTransit > 0 ? { label: 'Active', pill: 'pill-info' } : null },
    { key: 'stored', value: stats.stored, label: 'Stored', icon: '✅', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)', filter: 'stored', view: 'stored', delta: stats.deltas.stored, pctDelta: pctDeltas.stored, info: stats.stored > 0 ? { label: 'In Stock', pill: 'pill-ok' } : null },
    { key: 'delayed', value: stats.delayed, label: 'Delayed', icon: '⚠️', ring: 'ring-danger', tint: 'rgba(239,68,68,0.1)', filter: 'delayed', delta: stats.deltas.delayed, pctDelta: pctDeltas.delayed, info: stats.delayed > 0 ? { label: 'Needs Attention', pill: 'pill-bad' } : null },
    { key: 'planned', value: stats.planned, label: 'Planned', icon: '📅', ring: 'ring-warning', tint: 'rgba(245,158,11,0.1)', filter: 'planned', delta: stats.deltas.planned, pctDelta: pctDeltas.planned },
    { key: 'offsite', value: `${avgDaysOffsite}d`, label: 'Avg Days in OFFSITE', icon: '🏭', ring: 'ring-accent', tint: 'rgba(139,92,246,0.1)', filter: 'stored', view: 'stored', delta: null, pctDelta: null },
  ];

  const renderDelta = (delta, pctDelta) => {
    if (delta === null && pctDelta === null) return null;
    const pctColor = pctDelta && pctDelta.startsWith('+') ? 'var(--success)' : pctDelta && pctDelta.startsWith('-') ? 'var(--danger)' : 'var(--text-500)';
    if (delta > 0) return (
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
        ↑ {delta}
        {pctDelta && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: pctColor }}>{pctDelta} vs last week</span>}
      </span>
    );
    if (delta < 0) return (
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
        ↓ {Math.abs(delta)}
        {pctDelta && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: pctColor }}>{pctDelta} vs last week</span>}
      </span>
    );
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-500)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
        —
        {pctDelta && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: pctColor }}>{pctDelta} vs last week</span>}
      </span>
    );
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div className="brand-strip" />

      {/* Freight News Ticker */}
      {newsHeadlines.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          borderRadius: '8px', padding: '8px 16px', marginBottom: '0.75rem',
          overflow: 'hidden', position: 'relative',
        }}>
          <style>{`
            @keyframes news-scroll {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
            .news-ticker-track:hover {
              animation-play-state: paused !important;
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b',
              textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              Freight News
            </span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="news-ticker-track" style={{
                display: 'flex', gap: '3rem', whiteSpace: 'nowrap',
                animation: `news-scroll ${newsHeadlines.length * 4}s linear infinite`,
              }}>
                {newsHeadlines.map((item, i) => (
                  <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem',
                      textDecoration: 'none', flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {authUtils.getUser()?.role === 'admin' && <PerformanceMetrics />}

      {/* KPI Cards */}
      <div className="stats-grid">
        {kpiCards.map(card => (
          <div key={card.key} className={`stat-card ${card.ring} clickable`}
            role="button" tabIndex={0}
            aria-label={`${card.value} ${card.label} — click to view`}
            onClick={() => { const path = card.view ? `/${card.view}` : '/shipping'; startTransition(() => navigate(card.filter ? `${path}?status=${card.filter}` : path)); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const path = card.view ? `/${card.view}` : '/shipping'; startTransition(() => navigate(card.filter ? `${path}?status=${card.filter}` : path)); } }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 12,
              backgroundColor: card.tint, marginBottom: 6,
            }}>{card.icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 1px', color: 'var(--navy-900)' }}>{card.value}</h3>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600, color: 'var(--text-500)', margin: '0 0 1px' }}>
              {card.label}
            </p>
            {renderDelta(card.delta, card.pctDelta)}
            {card.info && <span className={`pill ${card.info.pill}`} style={{ fontSize: 10, padding: '2px 6px', marginTop: 2 }}>{card.info.label}</span>}
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginTop: '1.5rem' }}>

        {/* Weekly Trend — Orders vs Shipments */}
        <ChartCard title="Weekly Trend" subtitle="Orders per week">
          {weeklyTrend && weeklyTrend.length > 1 ? (
            <div style={{ height: 220 }}>
              <LineChart
                data={{
                  labels: weeklyTrend.map(d => d.week),
                  datasets: [{
                    label: 'Orders',
                    data: weeklyTrend.map(d => d.orders),
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5,150,105,0.08)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.3,
                    fill: true,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { font: { size: 12 } } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { precision: 0, font: { size: 11 } } } } }}
              />
            </div>
          ) : (
            <ChartEmpty label="No trend data yet" />
          )}
        </ChartCard>

        {/* Status Distribution — Donut */}
        <ChartCard title="Status Distribution" subtitle="By current status">
          {statusChartData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: 160, height: 160 }}>
                <Doughnut
                  data={{
                    labels: statusChartData.map(d => d.name),
                    datasets: [{
                      data: statusChartData.map(d => d.value),
                      backgroundColor: statusChartData.map(d => STATUS_COLORS[d.name] || '#6b7280'),
                      borderWidth: 2,
                      borderColor: '#fff',
                      hoverBorderWidth: 0,
                      hoverOffset: 4,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}` } } } }}
                />
              </div>
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
            <div style={{ height: warehouseChartData.length * 50 + 20 }}>
              <BarChart
                data={{
                  labels: warehouseChartData.map(d => d.name),
                  datasets: [{
                    data: warehouseChartData.map(d => d.count),
                    backgroundColor: warehouseChartData.map((_, idx) => WAREHOUSE_COLORS[idx % WAREHOUSE_COLORS.length]),
                    borderRadius: 4,
                    barThickness: 20,
                  }],
                }}
                options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw} orders` } } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { precision: 0, font: { size: 11 } } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 12, weight: 600 } } } } }}
              />
            </div>
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

        {/* Supplier On-Time Trend — Line */}
        <ChartCard title="Supplier On-Time Trend" subtitle="Last 8 weeks" style={{ gridColumn: '1 / -1' }}>
          {supplierOnTimeTrend.length > 0 ? (
            <div style={{ height: 220 }}>
              <LineChart
                data={{
                  labels: supplierOnTimeTrend.map(d => d.label),
                  datasets: [{
                    label: 'On-Time %',
                    data: supplierOnTimeTrend.map(d => d.pct),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139,92,246,0.08)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#8b5cf6',
                    pointHoverRadius: 6,
                    tension: 0.3,
                    fill: true,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw}% on-time` } },
                  },
                  scales: {
                    x: { grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { font: { size: 12 } } },
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { precision: 0, font: { size: 11 }, callback: (v) => `${v}%` } },
                  },
                }}
              />
            </div>
          ) : (
            <ChartEmpty label="No on-time data yet" />
          )}
        </ChartCard>

        {/* Products & Pallets by Week */}
        <ChartCard title="Products & Pallets by Week" subtitle="Weekly incoming volume" style={{ gridColumn: '1 / -1' }}>
          {productsPalletsTrend && productsPalletsTrend.length > 0 ? (
            <div style={{ height: 260 }}>
              <LineChart
                data={{
                  labels: productsPalletsTrend.map(d => d.week),
                  datasets: [
                    { label: 'Products', data: productsPalletsTrend.map(d => d.products), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 20, tension: 0.3, fill: true },
                    { label: 'Pallets', data: productsPalletsTrend.map(d => d.pallets), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 20, tension: 0.3, fill: true },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, font: { size: 11 } } } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { font: { size: 12 } } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { precision: 0, font: { size: 11 } } } } }}
              />
            </div>
          ) : (
            <ChartEmpty label="No trend data yet" />
          )}
        </ChartCard>

        {/* Offsite Storage Duration */}
        {offsiteChartData.length > 0 && (
          <ChartCard title="Offsite Storage Duration" subtitle={`${offsiteChartData.length} items · Days in storage`} style={{ gridColumn: '1 / -1' }}>
            <div style={{ height: offsiteChartData.length * 40 + 30 }}>
              <BarChart
                data={{
                  labels: offsiteChartData.map(d => d.label),
                  datasets: [{
                    data: offsiteChartData.map(d => d.days),
                    backgroundColor: offsiteChartData.map(d => d.days > 30 ? '#ef4444' : d.days > 14 ? '#f59e0b' : '#10b981'),
                    borderRadius: 4,
                    barThickness: 22,
                  }],
                }}
                options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw} days` } } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { precision: 0, font: { size: 11 } }, title: { display: true, text: 'Days', font: { size: 11 }, color: '#94a3b8' } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 500 } } } } }}
              />
            </div>
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

      {/* Warehouse Utilization */}
      <div className="dash-panel" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-900)' }}>Warehouse Utilization</h3>
        {warehouseData.map(w => {
          const pct = w.total_capacity > 0 ? Math.round((w.bins_used / w.total_capacity) * 100) : 0;
          const color = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)';
          return (
            <div key={w.warehouse_name} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>{w.warehouse_name}</span>
                <span style={{ color: 'var(--text-500)' }}>{w.bins_used} / {w.total_capacity} bins ({pct}%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-2)' }}>
                <div style={{ height: '100%', borderRadius: '4px', background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
        {warehouseData.length === 0 && <p style={{ color: 'var(--text-500)', fontSize: '0.85rem', margin: 0 }}>No warehouse data available</p>}
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
              <div key={shipment.id} role="button" tabIndex={0} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', backgroundColor: 'var(--surface-2)',
                borderRadius: 8, borderLeft: '3px solid var(--info)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
                onClick={() => navigate(`/shipping?status=${shipment.latestStatus}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/shipping?status=${shipment.latestStatus}`); } }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
              >
                <div>
                  <strong
                    onClick={(e) => { e.stopPropagation(); setDetailShipment(shipment); }}
                    style={{ color: 'var(--accent)', fontSize: 13, cursor: 'pointer', borderBottom: '1px dashed var(--accent)' }}
                    title="View order details"
                  >{shipment.orderRef}</strong>
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
      <div style={{
        display: 'flex', gap: 12, marginTop: '1.5rem', flexWrap: 'wrap',
        paddingTop: '1.5rem', borderTop: '1px solid var(--border)',
      }}>
        <button className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}
          onClick={() => navigate('/shipping')}>
          Shipping Schedule
        </button>
        <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
          onClick={() => navigate('/reports')}>
          Reports
        </button>
        <button className="btn btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}
          onClick={() => navigate('/capacity')}>
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
      {/* Order Detail Card */}
      {detailShipment && (
        <div
          onClick={() => setDetailShipment(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 12, padding: '1.5rem',
              width: '90%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)', border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)' }}>
                {detailShipment.orderRef}
              </h3>
              <button
                onClick={() => setDetailShipment(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-500)', lineHeight: 1 }}
              >
                x
              </button>
            </div>
            {(() => {
              const s = detailShipment;
              const fmt = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
              const rows = [
                ['Supplier', s.supplier],
                ['Product', s.productName],
                ['Quantity', s.quantity != null ? Number(s.quantity).toLocaleString() : '-'],
                ['Pallets', s.palletQty ? (Math.round(s.palletQty) || 1) : '-'],
                ['CBM', s.cbm || '-'],
                ['Week', s.weekNumber ? `Week ${s.weekNumber}` : '-'],
                ['Status', (s.latestStatus || '').replace(/_/g, ' ') || '-'],
                ['Final POD', s.finalPod || '-'],
                ['Warehouse', s.receivingWarehouse || '-'],
                ['Freight Type', s.freightType || '-'],
                ['Incoterm', s.incoterm || '-'],
                ['Forwarding Agent', s.forwardingAgent || '-'],
                ['Vessel', s.vesselName || '-'],
                ['Created', fmt(s.createdAt)],
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 0 }}>
                  {rows.map(([label, value]) => (
                    <React.Fragment key={label}>
                      <div style={{
                        padding: '6px 8px', fontSize: 12, fontWeight: 600,
                        color: 'var(--text-500)', borderBottom: '1px solid var(--border)'
                      }}>
                        {label}
                      </div>
                      <div style={{
                        padding: '6px 8px', fontSize: 13,
                        color: 'var(--text-700)', borderBottom: '1px solid var(--border)',
                        wordBreak: 'break-word'
                      }}>
                        {value || '-'}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
