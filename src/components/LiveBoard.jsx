import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShipmentStatus } from '../types/shipment';
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
  const [refreshPulse, setRefreshPulse] = useState(false);

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

    let planned = 0, inTransit = 0, arrived = 0, delayed = 0, port = 0, processing = 0;
    unique.forEach(s => {
      switch (s.latestStatus) {
        case ShipmentStatus.PLANNED_AIRFREIGHT:
        case ShipmentStatus.PLANNED_SEAFREIGHT:
          planned++; break;
        case ShipmentStatus.IN_TRANSIT_AIRFREIGHT:
        case ShipmentStatus.IN_TRANSIT_ROADWAY:
        case ShipmentStatus.IN_TRANSIT_SEAWAY:
        case ShipmentStatus.AIR_CUSTOMS_CLEARANCE:
          inTransit++; break;
        case ShipmentStatus.MOORED:
        case ShipmentStatus.BERTH_WORKING:
        case ShipmentStatus.BERTH_COMPLETE:
          port++; break;
        case ShipmentStatus.ARRIVED_PTA:
        case ShipmentStatus.ARRIVED_KLM:
        case ShipmentStatus.ARRIVED_OFFSITE:
          arrived++; break;
        case ShipmentStatus.DELAYED:
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

  // Recent activity (last 10 updated shipments)
  const recentActivity = useMemo(() => {
    return [...shipments]
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 6);
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
      color: 'white', overflow: 'auto',
      animation: 'liveboard-in 0.3s ease',
    }}>
      <style>{`
        @keyframes liveboard-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(5,150,105,0.4); } 70% { box-shadow: 0 0 0 10px rgba(5,150,105,0); } 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); } }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.5px' }}>
            Live Board
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
            Auto-refreshes every 30s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '1px' }}>
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

      {/* KPI Tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px', padding: '24px 32px',
      }}>
        {kpiTiles.map(tile => (
          <div key={tile.label} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '20px', borderLeft: `4px solid ${tile.color}`,
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: tile.color }}>
              {tile.value}
            </div>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Activity Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '20px', padding: '0 32px 32px',
      }}>
        {/* Donut Chart */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Status Distribution
          </h3>
          <div style={{ height: '260px' }}>
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Recent Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActivity.map(s => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px', borderLeft: '3px solid rgba(5,150,105,0.5)',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.orderRef}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{s.supplier}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                  }}>
                    {(s.latestStatus || '').replace(/_/g, ' ')}
                  </div>
                  {s.updatedAt && (
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
                      {new Date(s.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveBoard;
