import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShipmentStatus, PRE_ARRIVAL_STATUSES, getCurrentWeek, isDelayedStatus } from '../types/shipment';
import { getApiUrl } from '../config/api';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

function LiveBoard({ shipments, onClose, onRefresh }) {
  const [clock, setClock] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [detailShipment, setDetailShipment] = useState(null);
  const [refreshPulse, setRefreshPulse] = useState(false);
  const [newsHeadlines, setNewsHeadlines] = useState([]);

  // Fetch freight news
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

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (onRefresh) onRefresh();
      setLastRefresh(new Date());
      setRefreshPulse(true);
      setTimeout(() => setRefreshPulse(false), 1000);
    }, 30000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  // Escape to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Compute stats
  const stats = useMemo(() => {
    const orderRefs = {};
    shipments.forEach(s => {
      if (!s.orderRef) return;
      if (!orderRefs[s.orderRef] || s.updatedAt > orderRefs[s.orderRef].updatedAt) {
        orderRefs[s.orderRef] = s;
      }
    });
    const unique = Object.values(orderRefs);
    const currentWeek = getCurrentWeek();

    let planned = 0, inTransit = 0, arrived = 0, delayed = 0, port = 0, processing = 0;
    unique.forEach(s => {
      const wk = parseInt(s.weekNumber) || 0;
      const isOverdue = wk > 0 && wk < currentWeek && PRE_ARRIVAL_STATUSES.includes(s.latestStatus);

      switch (s.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          if (isOverdue) { delayed++; } else { planned++; } break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
        case ShipmentStatus.AIR_CUSTOMS_CLEARANCE:
          if (isOverdue) { delayed++; } else { inTransit++; } break;
        case ShipmentStatus.MOORED:
        case ShipmentStatus.BERTH_WORKING:
        case ShipmentStatus.BERTH_COMPLETE:
          if (isOverdue) { delayed++; } else { port++; } break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
        case ShipmentStatus.ARRIVED_OFFSITE:
          arrived++; break;
        case ShipmentStatus.DELAYED_PORT:
        case ShipmentStatus.DELAYED_CUSTOMS:
        case ShipmentStatus.DELAYED_DOCUMENTS:
        case ShipmentStatus.DELAYED_SUPPLIER:
          delayed++; break;
        default:
          processing++; break;
      }
    });

    return { total: unique.length, planned, inTransit, arrived, delayed, port, processing };
  }, [shipments]);

  // Donut chart
  const donutData = useMemo(() => ({
    labels: ['Planned', 'In Transit', 'Port', 'Arrived', 'Delayed', 'Processing'],
    datasets: [{
      data: [stats.planned, stats.inTransit, stats.port, stats.arrived, stats.delayed, stats.processing],
      backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#64748b'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [stats]);

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right',
        labels: { color: 'rgba(255,255,255,0.7)', font: { size: 13 }, padding: 14 },
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 13 },
        bodyFont: { size: 13 },
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  // Recent activity — exclude archived/stored, active first, planned last
  const recentActivity = useMemo(() => {
    const excludedStatuses = [ShipmentStatus.STORED, ShipmentStatus.ARCHIVED, ShipmentStatus.CANCELLED];
    const currentWeek = getCurrentWeek();
    const plannedStatuses = [ShipmentStatus.PLANNED_AIRFREIGHT, ShipmentStatus.PLANNED_SEAFREIGHT];

    // Priority: 0 = delayed/overdue, 1 = in-transit/port/arrived, 2 = planned
    const getPriority = (s) => {
      const sDelayed = isDelayedStatus(s.latestStatus) || (parseInt(s.weekNumber) > 0 && parseInt(s.weekNumber) < currentWeek && PRE_ARRIVAL_STATUSES.includes(s.latestStatus));
      if (sDelayed) return 0;
      if (plannedStatuses.includes(s.latestStatus)) return 2;
      return 1;
    };

    // Group by orderRef, collect all product names per order
    const orderMap = {};
    shipments.forEach(s => {
      if (!s.orderRef || excludedStatuses.includes(s.latestStatus)) return;
      if (!orderMap[s.orderRef]) {
        orderMap[s.orderRef] = { ...s, _products: new Set() };
      }
      if (s.productName) orderMap[s.orderRef]._products.add(s.productName);
      // Keep the most recently updated entry's fields
      if (new Date(s.updatedAt || 0) > new Date(orderMap[s.orderRef].updatedAt || 0)) {
        const products = orderMap[s.orderRef]._products;
        orderMap[s.orderRef] = { ...s, _products: products };
        if (s.productName) products.add(s.productName);
      }
    });

    return Object.values(orderMap)
      .sort((a, b) => {
        const pa = getPriority(a);
        const pb = getPriority(b);
        if (pa !== pb) return pa - pb;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      })
      .slice(0, 10);
  }, [shipments]);

  const kpiTiles = [
    { label: 'Total', value: stats.total, color: '#059669' },
    { label: 'In Transit', value: stats.inTransit, color: '#3b82f6' },
    { label: 'At Port', value: stats.port, color: '#8b5cf6' },
    { label: 'Arrived', value: stats.arrived, color: '#10b981' },
    { label: 'Delayed', value: stats.delayed, color: '#ef4444' },
    { label: 'Planned', value: stats.planned, color: '#f59e0b' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e293b 100%)',
      color: 'white', overflow: 'hidden',
      animation: 'liveboard-in 0.3s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes liveboard-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(5,150,105,0.4); } 70% { box-shadow: 0 0 0 10px rgba(5,150,105,0); } 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); } }
        @keyframes news-scroll-lb { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .news-ticker-lb:hover { animation-play-state: paused !important; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px' }}>
            Live Board
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
            Auto-refreshes every 30s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '1px' }}>
              {clock.toLocaleTimeString()}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              {clock.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981',
            animation: refreshPulse ? 'pulse-ring 1s ease' : 'none',
          }} title={`Last refresh: ${lastRefresh.toLocaleTimeString()}`} />
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'white', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 500,
            }}
          >
            Exit (Esc)
          </button>
        </div>
      </div>

      {/* News Ticker */}
      {newsHeadlines.length > 0 && (
        <div style={{
          padding: '6px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b',
            textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0,
          }}>
            Supply Chain
          </span>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="news-ticker-lb" style={{
              display: 'flex', gap: '3rem', whiteSpace: 'nowrap',
              animation: `news-scroll-lb ${newsHeadlines.length * 4}s linear infinite`,
            }}>
              {newsHeadlines.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem',
                    textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                >
                  {item.source && (
                    <span style={{
                      fontSize: '0.55rem', fontWeight: 600, padding: '1px 4px',
                      borderRadius: '3px', flexShrink: 0,
                      background: item.source === 'Freight News' ? '#2563eb' :
                        item.source === 'The Loadstar' ? '#7c3aed' :
                        item.source === 'gCaptain' ? '#0891b2' : '#059669',
                      color: '#fff',
                    }}>{item.source}</span>
                  )}
                  {item.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '8px', padding: '12px 24px',
      }}>
        {kpiTiles.map(tile => (
          <div key={tile.label} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '10px', borderLeft: `3px solid ${tile.color}`,
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tile.color }}>
              {tile.value}
            </div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Activity Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '12px', padding: '0 24px 24px',
        flex: 1, minHeight: 0,
      }}>
        {/* Donut Chart */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '14px',
          display: 'flex', flexDirection: 'column',
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Status Distribution
          </h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '14px',
          display: 'flex', flexDirection: 'column',
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Recent Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {recentActivity.map(s => {
              const currentWeek = getCurrentWeek();
              const sIsDelayed = isDelayedStatus(s.latestStatus) || (parseInt(s.weekNumber) > 0 && parseInt(s.weekNumber) < currentWeek && PRE_ARRIVAL_STATUSES.includes(s.latestStatus));
              const isPlanned = s.latestStatus === ShipmentStatus.PLANNED_AIRFREIGHT || s.latestStatus === ShipmentStatus.PLANNED_SEAFREIGHT;
              const borderColor = sIsDelayed ? '#ef4444' : s.latestStatus?.startsWith('in_transit') ? '#3b82f6' : s.latestStatus?.startsWith('arrived') ? '#10b981' : isPlanned ? '#f59e0b' : 'rgba(5,150,105,0.5)';
              const badgeBg = sIsDelayed ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)';
              const badgeColor = sIsDelayed ? '#fca5a5' : 'rgba(255,255,255,0.7)';
              const statusLabel = sIsDelayed && !isDelayedStatus(s.latestStatus) ? 'overdue' : (s.latestStatus || '').replace(/_/g, ' ');
              return (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px', borderLeft: `3px solid ${borderColor}`,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    <span
                      onClick={() => setDetailShipment(s)}
                      style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.5)' }}
                      title="View order details"
                    >{s.orderRef}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                    {s.supplier}{s._products && s._products.size > 0 ? ` — ${[...s._products].join(', ')}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: '4px',
                    background: badgeBg, color: badgeColor,
                  }}>
                    {statusLabel}
                  </div>
                  {s.weekNumber && (
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
                      Week {s.weekNumber}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            {recentActivity.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Order Detail Card */}
      {detailShipment && (
        <div
          onClick={() => setDetailShipment(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a2e', borderRadius: 12, padding: '1.5rem',
              width: '90%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                {detailShipment.orderRef}
              </h3>
              <button
                onClick={() => setDetailShipment(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}
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
                ['Last Updated', fmt(s.updatedAt)],
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 0 }}>
                  {rows.map(([label, value]) => (
                    <React.Fragment key={label}>
                      <div style={{
                        padding: '6px 8px', fontSize: 12, fontWeight: 600,
                        color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        {label}
                      </div>
                      <div style={{
                        padding: '6px 8px', fontSize: 13,
                        color: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.08)',
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

export default LiveBoard;
