import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/authFetch';
import { authUtils } from '../utils/auth';
import { getApiUrl } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';

const WAREHOUSES = ['All', 'PRETORIA', 'KLAPMUTS', 'OFFSITE'];

const TRUCK_STATUS_LABELS = {
  scheduled: 'Scheduled',
  checked_in: 'Checked In',
  unloading: 'Unloading',
  completed: 'Completed',
  departed: 'Departed',
};

const TRUCK_STATUS_COLORS = {
  scheduled: 'var(--info)',
  checked_in: 'var(--warning)',
  unloading: 'var(--accent)',
  completed: 'var(--success)',
  departed: 'var(--text-500)',
};

const DOCK_STATUS_COLORS = {
  available: '#10b981',
  occupied: '#f59e0b',
  maintenance: '#ef4444',
};

function DockManagement() {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('schedule');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [docks, setDocks] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [queue, setQueue] = useState([]);
  const [metrics, setMetrics] = useState({ avg_wait_minutes: 0, avg_turnaround_minutes: 0, utilization_percent: 0, trucks_today: 0, trucks_completed_today: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);
  const [showAssignDockModal, setShowAssignDockModal] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const currentUser = authUtils.getUser();

  const [truckForm, setTruckForm] = useState({
    carrier: '',
    driverName: '',
    driverPhone: '',
    vehicleReg: '',
    warehouse: '',
    expectedArrival: '',
    shipmentId: '',
    notes: '',
  });

  const warehouseParam = selectedWarehouse === 'All' ? '' : selectedWarehouse;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const wq = warehouseParam ? `?warehouse=${warehouseParam}` : '';
      const [docksRes, scheduleRes, queueRes, metricsRes] = await Promise.all([
        authFetch(getApiUrl(`/api/docks${wq}`)),
        authFetch(getApiUrl(`/api/docks/trucks/today${wq}`)),
        authFetch(getApiUrl(`/api/docks/trucks/queue${wq}`)),
        authFetch(getApiUrl(`/api/docks/metrics${wq}`)),
      ]);

      if (docksRes.ok) setDocks(await docksRes.json());
      if (scheduleRes.ok) setTodaySchedule(await scheduleRes.json());
      if (queueRes.ok) setQueue(await queueRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (err) {
      console.error('Error fetching dock data:', err);
    } finally {
      setLoading(false);
    }
  }, [warehouseParam]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleCreateTruck = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch(getApiUrl('/api/docks/trucks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(truckForm),
      });
      if (!res.ok) throw new Error('Failed to create truck arrival');
      showSuccess('Truck arrival scheduled');
      setShowAddTruckModal(false);
      setTruckForm({ carrier: '', driverName: '', driverPhone: '', vehicleReg: '', warehouse: '', expectedArrival: '', shipmentId: '', notes: '' });
      fetchAll();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async (truckId, truckWarehouse) => {
    setActionLoading(true);
    try {
      const res = await authFetch(getApiUrl(`/api/docks/trucks/${truckId}/check-in`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse: truckWarehouse || warehouseParam || undefined }),
      });
      if (!res.ok) throw new Error('Failed to check in truck');
      const data = await res.json();
      showSuccess(data.message);
      fetchAll();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignDock = async (truckId, dockId) => {
    setActionLoading(true);
    try {
      const res = await authFetch(getApiUrl(`/api/docks/trucks/${truckId}/assign-dock`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dockId }),
      });
      if (!res.ok) throw new Error('Failed to assign dock');
      showSuccess('Dock assigned');
      setShowAssignDockModal(false);
      setSelectedTruck(null);
      fetchAll();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTruck = async (truckId) => {
    setActionLoading(true);
    try {
      const res = await authFetch(getApiUrl(`/api/docks/trucks/${truckId}/complete`), { method: 'POST' });
      if (!res.ok) throw new Error('Failed to complete truck');
      const data = await res.json();
      showSuccess(data.nextAssigned ? 'Truck completed — next truck auto-assigned' : 'Truck completed');
      fetchAll();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDepartTruck = async (truckId) => {
    setActionLoading(true);
    try {
      const res = await authFetch(getApiUrl(`/api/docks/trucks/${truckId}/depart`), { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark truck as departed');
      showSuccess('Truck departed');
      fetchAll();
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionButton = (truck) => {
    switch (truck.status) {
      case 'scheduled':
        return <button className="btn btn-primary" style={btnStyle} onClick={() => handleCheckIn(truck.id, truck.warehouse)}>Check In</button>;
      case 'checked_in':
        return (
          <button className="btn btn-primary" style={btnStyle} onClick={() => {
            setSelectedTruck(truck);
            setShowAssignDockModal(true);
          }}>Assign Dock</button>
        );
      case 'unloading':
        return <button className="btn btn-primary" style={btnStyle} onClick={() => handleCompleteTruck(truck.id)}>Complete</button>;
      case 'completed':
        return <button className="btn btn-ghost" style={btnStyle} onClick={() => handleDepartTruck(truck.id)}>Depart</button>;
      default:
        return null;
    }
  };

  const btnStyle = { fontSize: '0.8rem', padding: '5px 10px' };

  const metricsCards = [
    { label: 'Trucks Today', value: metrics.trucks_today, color: 'var(--info)', icon: '\u{1F69B}' },
    { label: 'Avg Wait', value: `${Math.round(metrics.avg_wait_minutes)}m`, color: 'var(--warning)', icon: '\u23F1\uFE0F' },
    { label: 'Avg Turnaround', value: `${Math.round(metrics.avg_turnaround_minutes)}m`, color: 'var(--accent)', icon: '\u{1F504}' },
    { label: 'Dock Utilization', value: `${metrics.utilization_percent}%`, color: 'var(--success)', icon: '\u{1F4CA}' },
  ];

  const tabs = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'docks', label: 'Dock Board' },
    { id: 'queue', label: 'Queue', count: queue.length },
  ];

  const formatTime = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getWaitTime = (truck) => {
    if (!truck.check_in_time) return '-';
    const start = new Date(truck.check_in_time);
    const end = truck.check_out_time ? new Date(truck.check_out_time) : new Date();
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div className="brand-strip" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-900)' }}>
            Dock Management
          </h2>
          <p style={{ margin: 0, color: 'var(--text-500)', fontSize: '0.9rem' }}>
            Manage truck arrivals, dock assignments, and unloading workflows
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="select"
            style={{ fontSize: '0.85rem' }}
          >
            {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <button className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={() => setShowAddTruckModal(true)}>
            + Add Truck
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {metricsCards.map(card => (
          <div key={card.label} className="stat-card" style={{ borderLeft: `3px solid ${card.color}` }}>
            <h3 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: 'var(--navy-900)' }}>
              {card.icon} {card.value}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-500)', fontSize: '11px' }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: activeTab === tab.id ? 'var(--accent)' : 'var(--surface-2)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-700)',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label} {tab.count > 0 && <span style={{ opacity: 0.8 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>Loading...</div>
          ) : todaySchedule.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>No trucks scheduled for today</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Expected</th>
                    <th>Carrier</th>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th>Shipment</th>
                    <th>Warehouse</th>
                    <th>Dock</th>
                    <th>Status</th>
                    <th>Wait</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySchedule.map(truck => (
                    <tr key={truck.id}>
                      <td>{formatTime(truck.expected_arrival)}</td>
                      <td>{truck.carrier || '-'}</td>
                      <td>{truck.driver_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{truck.vehicle_reg || '-'}</td>
                      <td>{truck.order_ref || '-'}</td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{truck.warehouse || '-'}</td>
                      <td>{truck.dock_number || '-'}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: '999px',
                          fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: `${TRUCK_STATUS_COLORS[truck.status]}20`,
                          color: TRUCK_STATUS_COLORS[truck.status],
                        }}>
                          {TRUCK_STATUS_LABELS[truck.status] || truck.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-500)' }}>{getWaitTime(truck)}</td>
                      <td>{getActionButton(truck)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'docks' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
        }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>Loading...</div>
          ) : docks.map(dock => {
            const occupyingTruck = todaySchedule.find(t => t.dock_id === dock.id && t.status === 'unloading');
            return (
              <div
                key={dock.id}
                className="dash-panel"
                style={{
                  borderTop: `4px solid ${DOCK_STATUS_COLORS[dock.status]}`,
                  padding: '1rem',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-900)' }}>{dock.dock_number}</h3>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                    backgroundColor: `${DOCK_STATUS_COLORS[dock.status]}20`,
                    color: DOCK_STATUS_COLORS[dock.status],
                  }}>
                    {dock.status}
                  </span>
                </div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-500)' }}>{dock.warehouse}</p>

                {dock.status === 'occupied' && occupyingTruck && (
                  <div style={{
                    marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px',
                    background: 'var(--surface-2)', fontSize: '0.8rem',
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-900)' }}>{occupyingTruck.carrier || 'Unknown carrier'}</div>
                    <div style={{ color: 'var(--text-500)' }}>{occupyingTruck.vehicle_reg || ''} {occupyingTruck.driver_name ? `- ${occupyingTruck.driver_name}` : ''}</div>
                    {occupyingTruck.order_ref && <div style={{ color: 'var(--text-500)', marginTop: '2px' }}>Shipment: {occupyingTruck.order_ref}</div>}
                    <div style={{ marginTop: '0.5rem' }}>
                      <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => handleCompleteTruck(occupyingTruck.id)}>
                        Complete Unloading
                      </button>
                    </div>
                  </div>
                )}

                {dock.status === 'available' && (
                  <div style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 500 }}>
                    Ready for assignment
                  </div>
                )}

                {dock.status === 'maintenance' && (
                  <div style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
                    {dock.notes || 'Under maintenance'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>Loading...</div>
          ) : queue.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>No trucks in queue</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Carrier</th>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th>Checked In</th>
                    <th>Waiting</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((truck, idx) => (
                    <tr key={truck.id}>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{idx + 1}</td>
                      <td>{truck.carrier || '-'}</td>
                      <td>{truck.driver_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{truck.vehicle_reg || '-'}</td>
                      <td>{formatTime(truck.check_in_time)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--warning)' }}>{getWaitTime(truck)}</td>
                      <td>
                        <button className="btn btn-primary" style={btnStyle} onClick={() => {
                          setSelectedTruck(truck);
                          setShowAssignDockModal(true);
                        }}>Assign Dock</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Truck Modal */}
      {showAddTruckModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '90%', maxWidth: '480px',
            maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-900)' }}>Schedule Truck Arrival</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { key: 'carrier', label: 'Carrier', placeholder: 'e.g. DSV, DHL' },
                { key: 'driverName', label: 'Driver Name', placeholder: 'Full name' },
                { key: 'driverPhone', label: 'Driver Phone', placeholder: '+27...' },
                { key: 'vehicleReg', label: 'Vehicle Registration', placeholder: 'e.g. GP 123-456' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>{field.label}</label>
                  <input
                    type="text"
                    value={truckForm[field.key]}
                    onChange={e => setTruckForm({ ...truckForm, [field.key]: e.target.value })}
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Destination Warehouse *</label>
                <select
                  value={truckForm.warehouse}
                  onChange={e => setTruckForm({ ...truckForm, warehouse: e.target.value })}
                  className="select"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">Select warehouse...</option>
                  <option value="PRETORIA">PRETORIA</option>
                  <option value="KLAPMUTS">KLAPMUTS</option>
                  <option value="OFFSITE">OFFSITE</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Expected Arrival</label>
                <input
                  type="datetime-local"
                  value={truckForm.expectedArrival}
                  onChange={e => setTruckForm({ ...truckForm, expectedArrival: e.target.value })}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Notes</label>
                <textarea
                  value={truckForm.notes}
                  onChange={e => setTruckForm({ ...truckForm, notes: e.target.value })}
                  className="input"
                  style={{ width: '100%', minHeight: '50px', boxSizing: 'border-box', resize: 'vertical' }}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowAddTruckModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateTruck} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Schedule Arrival'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Dock Modal */}
      {showAssignDockModal && selectedTruck && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '90%', maxWidth: '400px',
            border: '1px solid var(--border)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-900)' }}>Assign Dock</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-500)', fontSize: '0.85rem' }}>
              {selectedTruck.carrier} &mdash; {selectedTruck.vehicle_reg || 'No reg'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {docks
                .filter(d => d.status === 'available' && (!selectedTruck.warehouse || d.warehouse === selectedTruck.warehouse))
                .map(dock => (
                  <button
                    key={dock.id}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px',
                      width: '100%', textAlign: 'left',
                    }}
                    onClick={() => handleAssignDock(selectedTruck.id, dock.id)}
                    disabled={actionLoading}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-900)' }}>{dock.dock_number}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-500)' }}>{dock.warehouse}</span>
                  </button>
                ))
              }
              {docks.filter(d => d.status === 'available' && (!selectedTruck.warehouse || d.warehouse === selectedTruck.warehouse)).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-500)', fontSize: '0.85rem', padding: '1rem' }}>
                  No docks available. Truck will remain in queue.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-ghost" onClick={() => { setShowAssignDockModal(false); setSelectedTruck(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DockManagement;
