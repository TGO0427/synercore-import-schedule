import React, { useState, useMemo, useEffect, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { STATUS_COLORS, SHIPPING_EXCLUDED_STATUSES } from '../types/shipment';

const LocalFileUpload = lazy(() => import('./LocalFileUpload'));

const WAREHOUSES = ['PRETORIA', 'KLAPMUTS', 'OFFSITE'];

const LOCAL_STATUSES = [
  { value: 'in_transit_roadway', label: 'In Transit Road' },
  { value: 'arrived_pta', label: 'Arrived PTA' },
  { value: 'arrived_klm', label: 'Arrived KLM' },
  { value: 'arrived_offsite', label: 'Arrived Offsite' },
  { value: 'delayed_supplier', label: 'Delayed - Supplier' },
  { value: 'delayed_documents', label: 'Delayed - Documents' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STAT_CARDS = [
  { key: 'total', status: null, label: 'Total Local', icon: '\u{1F69B}', ring: 'ring-accent', tint: 'rgba(5,150,105,0.1)' },
  { key: 'in_transit_roadway', status: 'in_transit_roadway', label: 'In Transit', icon: '\u{1F69B}', ring: 'ring-info', tint: 'rgba(59,130,246,0.1)' },
  { key: 'arrived', status: 'arrived', label: 'Arrived', icon: '\u{1F4E6}', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)' },
  { key: 'delayed', status: 'delayed', label: 'Delayed', icon: '\u26A0\uFE0F', ring: 'ring-danger', tint: 'rgba(239,68,68,0.1)' },
];

function LocalReceivingSchedule({ shipments, onCreateShipment, onUpdateShipment, onDeleteShipment, onFileUpload, loading }) {
  const { showSuccess, showError, confirm: confirmAction } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || null;
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShipment, setEditingShipment] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [truckInfoMap, setTruckInfoMap] = useState({});

  const [form, setForm] = useState({
    orderRef: '',
    supplier: '',
    productName: '',
    quantity: '',
    palletQty: '',
    receivingWarehouse: '',
    carrier: '',
    expectedArrival: '',
    latestStatus: 'in_transit_roadway',
    notes: '',
  });

  // Filter to local shipments only
  const localShipments = useMemo(() =>
    shipments.filter(s =>
      s.shipmentType === 'local' &&
      !SHIPPING_EXCLUDED_STATUSES.includes(s.latestStatus)
    ),
    [shipments]
  );

  // Fetch truck info for local shipments
  useEffect(() => {
    const arrived = localShipments.filter(s =>
      ['arrived_pta', 'arrived_klm', 'arrived_offsite', 'unloading', 'inspection_pending'].includes(s.latestStatus)
    );
    if (arrived.length === 0) return;

    const fetchTruckInfo = async () => {
      const map = {};
      await Promise.all(arrived.map(async (s) => {
        try {
          const res = await authFetch(getApiUrl(`/api/docks/truck-for-shipment/${s.id}`));
          if (res.ok) {
            const info = await res.json();
            if (info) map[s.id] = info;
          }
        } catch { /* ignore */ }
      }));
      setTruckInfoMap(map);
    };
    fetchTruckInfo();
  }, [localShipments]);

  // Stats
  const stats = useMemo(() => {
    const arrivedStatuses = ['arrived_pta', 'arrived_klm', 'arrived_offsite'];
    const delayedStatuses = ['delayed_supplier', 'delayed_documents', 'delayed_port', 'delayed_customs'];
    return {
      total: localShipments.length,
      in_transit_roadway: localShipments.filter(s => s.latestStatus === 'in_transit_roadway').length,
      arrived: localShipments.filter(s => arrivedStatuses.includes(s.latestStatus)).length,
      delayed: localShipments.filter(s => delayedStatuses.includes(s.latestStatus)).length,
    };
  }, [localShipments]);

  // Filter
  const filtered = useMemo(() => {
    let list = localShipments;

    if (statusFilter) {
      const arrivedStatuses = ['arrived_pta', 'arrived_klm', 'arrived_offsite'];
      const delayedStatuses = ['delayed_supplier', 'delayed_documents', 'delayed_port', 'delayed_customs'];
      if (statusFilter === 'arrived') {
        list = list.filter(s => arrivedStatuses.includes(s.latestStatus));
      } else if (statusFilter === 'delayed') {
        list = list.filter(s => delayedStatuses.includes(s.latestStatus));
      } else {
        list = list.filter(s => s.latestStatus === statusFilter);
      }
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(s =>
        (s.orderRef || '').toLowerCase().includes(q) ||
        (s.supplier || '').toLowerCase().includes(q) ||
        (s.productName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [localShipments, statusFilter, searchTerm]);

  const handleStatusCardClick = (status) => {
    const params = new URLSearchParams(searchParams);
    if (status === null || statusFilter === status) {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    setSearchParams(params, { replace: true });
  };

  const resetForm = () => setForm({
    orderRef: '', supplier: '', productName: '', quantity: '', palletQty: '',
    receivingWarehouse: '', carrier: '', expectedArrival: '', latestStatus: 'in_transit_roadway', notes: '',
  });

  const handleCreate = async () => {
    if (!form.orderRef || !form.supplier) {
      showError('Order Ref and Supplier are required');
      return;
    }
    setActionLoading(true);
    try {
      await onCreateShipment({
        orderRef: form.orderRef,
        supplier: form.supplier,
        productName: form.productName,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        palletQty: form.palletQty ? Number(form.palletQty) : undefined,
        receivingWarehouse: form.receivingWarehouse,
        forwardingAgent: form.carrier, // use forwarding_agent field for carrier
        latestStatus: form.latestStatus,
        notes: form.notes,
        vesselName: form.expectedArrival || '', // store expected arrival in vessel_name for local
        shipmentType: 'local',
      });
      showSuccess('Local shipment created');
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      showError(err.message || 'Failed to create shipment');
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (s) => {
    setEditingShipment(s);
    setForm({
      orderRef: s.orderRef || '',
      supplier: s.supplier || '',
      productName: s.productName || '',
      quantity: s.quantity || '',
      palletQty: s.palletQty || '',
      receivingWarehouse: s.receivingWarehouse || '',
      carrier: s.forwardingAgent || '',
      expectedArrival: s.vesselName || '', // stored in vessel_name for local
      latestStatus: s.latestStatus || 'in_transit_roadway',
      notes: s.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingShipment) return;
    setActionLoading(true);
    try {
      await onUpdateShipment(editingShipment.id, {
        orderRef: form.orderRef,
        supplier: form.supplier,
        productName: form.productName,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        palletQty: form.palletQty ? Number(form.palletQty) : undefined,
        receivingWarehouse: form.receivingWarehouse,
        forwardingAgent: form.carrier,
        latestStatus: form.latestStatus,
        notes: form.notes,
        vesselName: form.expectedArrival || '',
      });
      showSuccess('Shipment updated');
      setShowEditModal(false);
      setEditingShipment(null);
      resetForm();
    } catch (err) {
      showError(err.message || 'Failed to update');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmAction({
      title: 'Delete Shipment',
      message: 'Are you sure you want to delete this local shipment?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!confirmed) return;
    try {
      await onDeleteShipment(id);
      showSuccess('Shipment deleted');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await onUpdateShipment(id, { latestStatus: newStatus });
      showSuccess('Status updated');
    } catch (err) {
      showError(err.message);
    }
  };

  const statCards = STAT_CARDS.map(c => ({
    ...c,
    value: c.status === null ? stats.total : stats[c.key] || 0,
  })).filter(c => c.status === null || c.value > 0);

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  const btnStyle = { fontSize: '0.8rem', padding: '5px 10px' };

  const renderFormFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[
        { key: 'orderRef', label: 'Order / Ref *', placeholder: 'e.g. APO0012345' },
        { key: 'supplier', label: 'Supplier *', placeholder: 'Supplier name' },
        { key: 'productName', label: 'Product', placeholder: 'Product description' },
      ].map(f => (
        <div key={f.key}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>{f.label}</label>
          <input type="text" value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            className="input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder={f.placeholder} />
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Quantity</label>
          <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
            className="input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="0" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Pallets</label>
          <input type="number" value={form.palletQty} onChange={e => setForm({ ...form, palletQty: e.target.value })}
            className="input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="0" />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Carrier</label>
        <input type="text" value={form.carrier} onChange={e => setForm({ ...form, carrier: e.target.value })}
          className="input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="e.g. DSV, DHL, AGX" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Expected Delivery Date</label>
        <input type="date" value={form.expectedArrival} onChange={e => setForm({ ...form, expectedArrival: e.target.value })}
          className="input" style={{ width: '100%', boxSizing: 'border-box' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Destination Warehouse</label>
        <select value={form.receivingWarehouse} onChange={e => setForm({ ...form, receivingWarehouse: e.target.value })}
          className="select" style={{ width: '100%', boxSizing: 'border-box' }}>
          <option value="">Select warehouse...</option>
          {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Status</label>
        <select value={form.latestStatus} onChange={e => setForm({ ...form, latestStatus: e.target.value })}
          className="select" style={{ width: '100%', boxSizing: 'border-box' }}>
          {LOCAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '4px' }}>Notes</label>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          className="input" style={{ width: '100%', minHeight: '50px', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder="Additional notes..." />
      </div>
    </div>
  );

  return (
    <div className="window-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-900)' }}>
            Local Receiving Schedule
          </h2>
          <p style={{ margin: 0, color: 'var(--text-500)', fontSize: '0.9rem' }}>
            Track local deliveries, road shipments, and inter-warehouse transfers
          </p>
        </div>
        <button className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={() => { resetForm(); setShowCreateModal(true); }}>
          + New Local Shipment
        </button>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        {statCards.map(card => (
          <div key={card.key}
            className={`stat-card ${card.ring} clickable ${statusFilter === card.status ? 'active' : ''}`}
            onClick={() => handleStatusCardClick(card.status)}
          >
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 12,
              backgroundColor: card.tint, marginBottom: 6,
            }}>
              {card.icon}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 1px', color: 'var(--navy-900)' }}>
              {card.value}
            </h3>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filter chip */}
      {statusFilter && (
        <div style={{
          margin: '0.75rem 0', padding: '0.5rem 1rem',
          backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ color: 'var(--info)', fontWeight: 'bold', fontSize: '0.85rem' }}>
            Filtered: {statusFilter.replace(/_/g, ' ').toUpperCase()}
          </span>
          <button onClick={() => { const p = new URLSearchParams(searchParams); p.delete('status'); setSearchParams(p, { replace: true }); }}
            className="btn btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>Clear</button>
        </div>
      )}

      {/* File Import */}
      <React.Suspense fallback={null}>
        <LocalFileUpload onFileUpload={onFileUpload} loading={loading} />
      </React.Suspense>

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input"
          style={{ width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}
          placeholder="Search by order ref, supplier, product..."
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>
            No local shipments found. Click "+ New Local Shipment" to add one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Order Ref</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Pallets</th>
                  <th>Carrier</th>
                  <th>Expected</th>
                  <th>Warehouse</th>
                  <th>Truck</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.orderRef || '-'}</td>
                    <td>{s.supplier || '-'}</td>
                    <td>{s.productName || '-'}</td>
                    <td>{s.quantity || '-'}</td>
                    <td>{s.palletQty ? (Math.round(s.palletQty) || 1) : '-'}</td>
                    <td>{s.forwardingAgent || '-'}</td>
                    <td>{formatDate(s.vesselName)}</td>
                    <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{s.receivingWarehouse || '-'}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-500)' }}>
                      {truckInfoMap[s.id] ? (
                        <span>{truckInfoMap[s.id].carrier}{truckInfoMap[s.id].vehicle_reg ? ` (${truckInfoMap[s.id].vehicle_reg})` : ''}</span>
                      ) : '-'}
                    </td>
                    <td>
                      <select
                        value={s.latestStatus}
                        onChange={e => handleStatusChange(s.id, e.target.value)}
                        style={{
                          padding: '3px 6px', borderRadius: '999px', border: 'none',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                          backgroundColor: `${STATUS_COLORS[s.latestStatus] || '#6c757d'}20`,
                          color: STATUS_COLORS[s.latestStatus] || '#6c757d',
                        }}
                      >
                        {LOCAL_STATUSES.map(st => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-ghost" style={btnStyle} onClick={() => openEdit(s)}>Edit</button>
                        <button className="btn btn-ghost danger" style={btnStyle} onClick={() => handleDelete(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
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
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-900)' }}>New Local Shipment</h3>
            {renderFormFields()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={actionLoading}>
                {actionLoading ? 'Creating...' : 'Create Shipment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingShipment && (
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
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-900)' }}>Edit Local Shipment</h3>
            {renderFormFields()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => { setShowEditModal(false); setEditingShipment(null); }} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocalReceivingSchedule;
