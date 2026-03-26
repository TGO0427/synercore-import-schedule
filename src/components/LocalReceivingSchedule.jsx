import React, { useState, useMemo, useEffect, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { STATUS_COLORS } from '../types/shipment';

const LocalFileUpload = lazy(() => import('./LocalFileUpload'));

const WAREHOUSES = ['PRETORIA', 'KLAPMUTS', 'OFFSITE'];

const LOCAL_STATUSES = [
  { value: 'in_transit_roadway', label: 'In Transit Road', group: 'Transit' },
  { value: 'arrived_pta', label: 'Arrived PTA', group: 'Arrived' },
  { value: 'arrived_klm', label: 'Arrived KLM', group: 'Arrived' },
  { value: 'arrived_offsite', label: 'Arrived Offsite', group: 'Arrived' },
  { value: 'unloading', label: 'Unloading', group: 'Post-Arrival' },
  { value: 'inspection_pending', label: 'Inspection Pending', group: 'Post-Arrival' },
  { value: 'inspecting', label: 'Inspecting', group: 'Post-Arrival' },
  { value: 'inspection_passed', label: 'Inspection Passed', group: 'Post-Arrival' },
  { value: 'inspection_failed', label: 'Inspection Failed', group: 'Post-Arrival' },
  { value: 'receiving', label: 'Receiving', group: 'Warehouse' },
  { value: 'stored', label: 'Stored', group: 'Warehouse' },
  { value: 'delayed_supplier', label: 'Delayed - Supplier', group: 'Delayed' },
  { value: 'delayed_documents', label: 'Delayed - Documents', group: 'Delayed' },
  { value: 'cancelled', label: 'Cancelled', group: 'Other' },
];

const STAT_CARDS = [
  { key: 'total', status: null, label: 'Total Local', icon: '\u{1F69B}', ring: 'ring-accent', tint: 'rgba(5,150,105,0.1)' },
  { key: 'overdue', status: 'overdue', label: 'Overdue', icon: '\u{1F6A8}', ring: 'ring-danger', tint: 'rgba(239,68,68,0.1)' },
  { key: 'due_this_week', status: 'due_this_week', label: 'Due This Week', icon: '\u{1F4C5}', ring: 'ring-warning', tint: 'rgba(245,158,11,0.1)' },
  { key: 'in_transit_roadway', status: 'in_transit_roadway', label: 'In Transit', icon: '\u{1F69B}', ring: 'ring-info', tint: 'rgba(59,130,246,0.1)' },
  { key: 'arrived', status: 'arrived', label: 'Arrived', icon: '\u{1F4E6}', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)' },
  { key: 'post_arrival', status: 'post_arrival', label: 'Post-Arrival', icon: '\u{1F50D}', ring: 'ring-warning', tint: 'rgba(245,158,11,0.1)' },
  { key: 'stored', status: 'stored', label: 'Stored', icon: '\u{1F3EA}', ring: 'ring-success', tint: 'rgba(16,185,129,0.1)' },
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

  // Filter to local shipments only (show all statuses including post-arrival)
  const localShipments = useMemo(() =>
    shipments.filter(s => s.shipmentType === 'local'),
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

  // Date helpers (used by stats, sorting, and overdue detection)
  const parseExpectedDate = (d) => {
    if (!d) return null;
    try {
      const num = Number(d);
      if (!isNaN(num) && num > 30000 && num < 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + num * 86400000);
      }
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) return parsed;
      return null;
    } catch { return null; }
  };

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const endOfWeek = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + (7 - d.getDay()));
    return d;
  }, [today]);

  const isOverdue = (s) => {
    if (['arrived_pta', 'arrived_klm', 'arrived_offsite', 'unloading', 'inspection_pending',
         'inspecting', 'inspection_passed', 'receiving', 'stored'].includes(s.latestStatus)) return false;
    const expected = parseExpectedDate(s.vesselName);
    if (!expected) return false;
    return expected < today;
  };

  const isDueThisWeek = (s) => {
    if (!['in_transit_roadway'].includes(s.latestStatus)) return false;
    const expected = parseExpectedDate(s.vesselName);
    if (!expected) return false;
    return expected >= today && expected <= endOfWeek;
  };

  // Stats
  const stats = useMemo(() => {
    const arrivedStatuses = ['arrived_pta', 'arrived_klm', 'arrived_offsite'];
    const postArrivalStatuses = ['unloading', 'inspection_pending', 'inspecting', 'inspection_passed', 'inspection_failed', 'receiving'];
    const delayedStatuses = ['delayed_supplier', 'delayed_documents', 'delayed_port', 'delayed_customs'];
    return {
      total: localShipments.length,
      overdue: localShipments.filter(s => isOverdue(s)).length,
      due_this_week: localShipments.filter(s => isDueThisWeek(s)).length,
      in_transit_roadway: localShipments.filter(s => s.latestStatus === 'in_transit_roadway').length,
      arrived: localShipments.filter(s => arrivedStatuses.includes(s.latestStatus)).length,
      post_arrival: localShipments.filter(s => postArrivalStatuses.includes(s.latestStatus)).length,
      stored: localShipments.filter(s => s.latestStatus === 'stored').length,
      delayed: localShipments.filter(s => delayedStatuses.includes(s.latestStatus)).length,
    };
  }, [localShipments, today, endOfWeek]);

  // Filter
  const filtered = useMemo(() => {
    let list = localShipments;

    if (statusFilter) {
      const arrivedStatuses = ['arrived_pta', 'arrived_klm', 'arrived_offsite'];
      const postArrivalStatuses = ['unloading', 'inspection_pending', 'inspecting', 'inspection_passed', 'inspection_failed', 'receiving'];
      const delayedStatuses = ['delayed_supplier', 'delayed_documents', 'delayed_port', 'delayed_customs'];
      if (statusFilter === 'overdue') {
        list = list.filter(s => isOverdue(s));
      } else if (statusFilter === 'due_this_week') {
        list = list.filter(s => isDueThisWeek(s));
      } else if (statusFilter === 'arrived') {
        list = list.filter(s => arrivedStatuses.includes(s.latestStatus));
      } else if (statusFilter === 'post_arrival') {
        list = list.filter(s => postArrivalStatuses.includes(s.latestStatus));
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

    // Sort by earliest expected date first, no-date at bottom
    list.sort((a, b) => {
      const dateA = parseExpectedDate(a.vesselName);
      const dateB = parseExpectedDate(b.vesselName);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB;
    });

    return list;
  }, [localShipments, statusFilter, searchTerm, today, endOfWeek]);

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
    const parsed = parseExpectedDate(d);
    if (parsed) return parsed.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    return String(d);
  };

  // SVG icon helpers for action buttons
  const EditIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  );
  const TrashIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  );

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
          {(() => {
            const groups = {};
            LOCAL_STATUSES.forEach(st => {
              if (!groups[st.group]) groups[st.group] = [];
              groups[st.group].push(st);
            });
            return Object.entries(groups).map(([group, statuses]) => (
              <optgroup key={group} label={group}>
                {statuses.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </optgroup>
            ));
          })()}
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.25rem', paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-900)', fontSize: '1.25rem' }}>
            Local Receiving Schedule
          </h2>
          <p style={{ margin: 0, color: 'var(--text-500)', fontSize: '0.85rem' }}>
            Track local deliveries, road shipments, and inter-warehouse transfers
          </p>
        </div>
        <button className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={() => { resetForm(); setShowCreateModal(true); }}>
          + New Local Shipment
        </button>
      </div>

      {/* Stat Cards — compact strip */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap',
      }}>
        {statCards.map(card => (
          <div key={card.key}
            className={`stat-card ${card.ring} clickable ${statusFilter === card.status ? 'active' : ''}`}
            onClick={() => handleStatusCardClick(card.status)}
            style={{ minWidth: 100, maxWidth: 140, flex: '0 1 auto', padding: '8px 12px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{card.icon}</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--navy-900)' }}>
                {card.value}
              </h3>
            </div>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600, color: 'var(--text-500)', margin: '2px 0 0' }}>
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

      {/* Search + Import row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input"
          style={{ flex: '1 1 280px', maxWidth: '400px', boxSizing: 'border-box' }}
          placeholder="Search by order ref, supplier, product..."
        />
      </div>

      {/* File Import — collapsible utility */}
      <React.Suspense fallback={null}>
        <LocalFileUpload onFileUpload={onFileUpload} loading={loading} />
      </React.Suspense>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '0.5rem' }}>
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
                {filtered.map(s => {
                  const overdue = isOverdue(s);
                  const dueThisWeek = !overdue && isDueThisWeek(s);
                  const statusColor = STATUS_COLORS[s.latestStatus] || '#6c757d';
                  return (
                  <tr key={s.id} style={
                    overdue ? { boxShadow: 'inset 3px 0 0 var(--danger)' }
                    : dueThisWeek ? { boxShadow: 'inset 3px 0 0 #d97706' }
                    : {}
                  }>
                    <td style={{ fontWeight: 600 }}>{s.orderRef || '-'}</td>
                    <td>{s.supplier || '-'}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.productName || '-'}</td>
                    <td>{s.quantity || '-'}</td>
                    <td>{s.palletQty ? (Math.round(s.palletQty) || 1) : '-'}</td>
                    <td>{s.forwardingAgent || '-'}</td>
                    <td>
                      <span style={{ fontWeight: overdue || dueThisWeek ? 600 : 400, color: overdue ? 'var(--danger)' : dueThisWeek ? '#d97706' : 'inherit' }}>
                        {formatDate(s.vesselName)}
                      </span>
                      {overdue && (
                        <span style={{
                          display: 'inline-block', marginLeft: 6, fontSize: '0.6rem', fontWeight: 700,
                          padding: '1px 5px', borderRadius: 4,
                          backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
                          verticalAlign: 'middle', letterSpacing: '0.3px',
                        }}>OVERDUE</span>
                      )}
                      {dueThisWeek && (
                        <span style={{
                          display: 'inline-block', marginLeft: 6, fontSize: '0.6rem', fontWeight: 700,
                          padding: '1px 5px', borderRadius: 4,
                          backgroundColor: 'rgba(245,158,11,0.1)', color: '#d97706',
                          verticalAlign: 'middle', letterSpacing: '0.3px',
                        }}>THIS WEEK</span>
                      )}
                    </td>
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
                          padding: '4px 20px 4px 8px', borderRadius: '20px',
                          border: `1.5px solid ${statusColor}40`,
                          fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                          backgroundColor: `${statusColor}12`,
                          color: statusColor,
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${encodeURIComponent(statusColor)}' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 6px center',
                          lineHeight: 1.4,
                        }}
                      >
                        {(() => {
                          const groups = {};
                          LOCAL_STATUSES.forEach(st => {
                            if (!groups[st.group]) groups[st.group] = [];
                            groups[st.group].push(st);
                          });
                          return Object.entries(groups).map(([group, statuses]) => (
                            <optgroup key={group} label={group}>
                              {statuses.map(st => (
                                <option key={st.value} value={st.value}>{st.label}</option>
                              ))}
                            </optgroup>
                          ));
                        })()}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '5px 7px', fontSize: '0.8rem', borderRadius: 6 }}
                          onClick={() => openEdit(s)}
                          title="Edit shipment"
                        ><EditIcon /></button>
                        <button
                          className="btn btn-ghost danger"
                          style={{ padding: '5px 7px', fontSize: '0.8rem', borderRadius: 6 }}
                          onClick={() => handleDelete(s.id)}
                          title="Delete shipment"
                        ><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
