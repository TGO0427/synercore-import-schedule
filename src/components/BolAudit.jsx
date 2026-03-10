import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', bg: '#fef3c7' },
  in_review: { label: 'In Review', color: '#3b82f6', bg: '#dbeafe' },
  approved: { label: 'Approved', color: '#059669', bg: '#d1fae5' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2' },
  discrepancy: { label: 'Discrepancy', color: '#9333ea', bg: '#f3e8ff' },
};

const PAYMENT_TERMS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'collect', label: 'Collect' },
  { value: 'third_party', label: 'Third Party' },
];

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const emptyForm = {
  bol_number: '', shipment_id: '', supplier_name: '', carrier_name: '',
  vessel_name: '', voyage_number: '', port_of_loading: '', port_of_discharge: '',
  consignee: '', shipper: '', notify_party: '', description_of_goods: '',
  container_numbers: '', gross_weight_kg: '', volume_cbm: '',
  number_of_packages: '', freight_charges_usd: '', declared_value_usd: '',
  issue_date: '', ship_on_board_date: '', payment_terms: '', incoterm: '', notes: '',
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem',
      fontWeight: 600, color: config.color, backgroundColor: config.bg,
    }}>
      {config.label}
    </span>
  );
}

function StatCard({ label, value, color, prefix }) {
  return (
    <div style={{
      flex: '1 1 140px', padding: '14px 18px', borderRadius: '10px',
      backgroundColor: 'var(--surface-1, #fff)', border: '1px solid var(--border-color, #e5e7eb)',
      minWidth: 140,
    }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-500, #6b7280)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text-900, #111)' }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function BolAudit() {
  const { showSuccess, showError, confirm } = useNotification();
  const [bols, setBols] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [editingBol, setEditingBol] = useState(null);
  const [auditingBol, setAuditingBol] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [auditForm, setAuditForm] = useState({
    audit_status: 'approved', audit_notes: '', weight_verified: false,
    charges_verified: false, documents_verified: false, discrepancies: '',
  });
  const [saving, setSaving] = useState(false);

  // PDF Upload
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showUploadResult, setShowUploadResult] = useState(false);
  const fileInputRef = React.useRef(null);

  // Fetch BOLs
  const fetchBols = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (statusFilter !== 'all') params.set('audit_status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await authFetch(getApiUrl(`/api/bol-audit?${params}`));
      if (res.ok) {
        const json = await res.json();
        setBols(json.data || []);
        setPagination(json.pagination || { page, limit: 25, total: 0, pages: 0 });
      }
    } catch (err) {
      showError('Failed to load Bills of Lading');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(getApiUrl('/api/bol-audit/stats'));
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (err) {
      // Non-critical
    }
  }, []);

  useEffect(() => { fetchBols(1); }, [fetchBols]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Create / Update
  const handleSave = async () => {
    if (!formData.bol_number.trim()) {
      showError('BOL number is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        container_numbers: formData.container_numbers
          ? formData.container_numbers.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        gross_weight_kg: formData.gross_weight_kg ? parseFloat(formData.gross_weight_kg) : null,
        volume_cbm: formData.volume_cbm ? parseFloat(formData.volume_cbm) : null,
        number_of_packages: formData.number_of_packages ? parseInt(formData.number_of_packages) : null,
        freight_charges_usd: formData.freight_charges_usd ? parseFloat(formData.freight_charges_usd) : null,
        declared_value_usd: formData.declared_value_usd ? parseFloat(formData.declared_value_usd) : null,
      };

      const url = editingBol
        ? getApiUrl(`/api/bol-audit/${editingBol.id}`)
        : getApiUrl('/api/bol-audit');
      const method = editingBol ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccess(editingBol ? 'BOL updated successfully' : 'BOL created successfully');
        setShowForm(false);
        setEditingBol(null);
        setFormData(emptyForm);
        fetchBols(pagination.page);
        fetchStats();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save BOL');
      }
    } catch (err) {
      showError('Failed to save BOL');
    } finally {
      setSaving(false);
    }
  };

  // Audit submit
  const handleAuditSubmit = async () => {
    if (!auditingBol) return;
    setSaving(true);
    try {
      const payload = {
        ...auditForm,
        discrepancies: auditForm.discrepancies
          ? auditForm.discrepancies.split('\n').filter(Boolean)
          : null,
      };

      const res = await authFetch(getApiUrl(`/api/bol-audit/${auditingBol.id}/audit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccess(`BOL ${auditForm.audit_status === 'approved' ? 'approved' : auditForm.audit_status === 'rejected' ? 'rejected' : 'updated'}`);
        setShowAuditModal(false);
        setAuditingBol(null);
        fetchBols(pagination.page);
        fetchStats();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to submit audit');
      }
    } catch (err) {
      showError('Failed to submit audit');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (bol) => {
    const confirmed = await confirm({
      title: 'Delete Bill of Lading',
      message: `Are you sure you want to delete BOL ${bol.bol_number}? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await authFetch(getApiUrl(`/api/bol-audit/${bol.id}`), { method: 'DELETE' });
      if (res.ok) {
        showSuccess('BOL deleted');
        fetchBols(pagination.page);
        fetchStats();
      } else {
        showError('Failed to delete BOL');
      }
    } catch (err) {
      showError('Failed to delete BOL');
    }
  };

  // PDF Upload
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showError('Please select a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('File size must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const formPayload = new FormData();
      formPayload.append('pdf', file);

      const res = await authFetch(getApiUrl('/api/bol-audit/upload-pdf'), {
        method: 'POST',
        body: formPayload,
      });

      const json = await res.json();
      if (res.ok) {
        setUploadResult({ bol: json.data, extraction: json.extraction });
        setShowUploadResult(true);
        showSuccess(`BOL extracted and ${json.data.audit_status === 'approved' ? 'auto-approved' : 'flagged for review'}`);
        fetchBols(1);
        fetchStats();
      } else {
        showError(json.error || 'Failed to process PDF');
      }
    } catch (err) {
      showError('Failed to upload PDF');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // View PDF extraction results for an existing BOL
  const viewPdfResults = (bol) => {
    const confidence = typeof bol.extraction_confidence === 'string'
      ? JSON.parse(bol.extraction_confidence)
      : bol.extraction_confidence;
    const discrepancies = typeof bol.discrepancies === 'string'
      ? JSON.parse(bol.discrepancies)
      : bol.discrepancies;
    setUploadResult({
      bol,
      extraction: {
        confidence: confidence || {},
        findings: Array.isArray(discrepancies) ? discrepancies : [],
        score: null, // stored in audit_notes
        matched_shipment: null,
      },
    });
    setShowUploadResult(true);
  };

  // Open edit
  const openEdit = (bol) => {
    setEditingBol(bol);
    setFormData({
      bol_number: bol.bol_number || '',
      shipment_id: bol.shipment_id || '',
      supplier_name: bol.supplier_name || '',
      carrier_name: bol.carrier_name || '',
      vessel_name: bol.vessel_name || '',
      voyage_number: bol.voyage_number || '',
      port_of_loading: bol.port_of_loading || '',
      port_of_discharge: bol.port_of_discharge || '',
      consignee: bol.consignee || '',
      shipper: bol.shipper || '',
      notify_party: bol.notify_party || '',
      description_of_goods: bol.description_of_goods || '',
      container_numbers: Array.isArray(bol.container_numbers) ? bol.container_numbers.join(', ') : (bol.container_numbers || ''),
      gross_weight_kg: bol.gross_weight_kg ?? '',
      volume_cbm: bol.volume_cbm ?? '',
      number_of_packages: bol.number_of_packages ?? '',
      freight_charges_usd: bol.freight_charges_usd ?? '',
      declared_value_usd: bol.declared_value_usd ?? '',
      issue_date: bol.issue_date ? bol.issue_date.split('T')[0] : '',
      ship_on_board_date: bol.ship_on_board_date ? bol.ship_on_board_date.split('T')[0] : '',
      payment_terms: bol.payment_terms || '',
      incoterm: bol.incoterm || '',
      notes: bol.notes || '',
    });
    setShowForm(true);
  };

  // Open audit
  const openAudit = (bol) => {
    setAuditingBol(bol);
    setAuditForm({
      audit_status: bol.audit_status === 'pending' ? 'approved' : bol.audit_status,
      audit_notes: bol.audit_notes || '',
      weight_verified: bol.weight_verified || false,
      charges_verified: bol.charges_verified || false,
      documents_verified: bol.documents_verified || false,
      discrepancies: Array.isArray(bol.discrepancies) ? bol.discrepancies.join('\n') : '',
    });
    setShowAuditModal(true);
  };

  const formatCurrency = (val) => val != null ? `$${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-';
  const formatDate = (val) => val ? new Date(val).toLocaleDateString() : '-';
  const formatWeight = (val) => val != null ? `${parseFloat(val).toLocaleString()} kg` : '-';

  // Shared styles
  const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px',
    fontSize: '0.88rem', boxSizing: 'border-box', backgroundColor: 'var(--surface-1, #fff)',
    color: 'var(--text-900, #111)',
  };
  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-500)', marginBottom: 3 };
  const btnStyle = (bg) => ({
    padding: '6px 14px', backgroundColor: bg, color: '#fff', border: 'none',
    borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.82rem',
  });
  const modalOverlay = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'flex-start', paddingTop: '5vh', zIndex: 1000,
    overflowY: 'auto',
  };
  const modalBox = {
    backgroundColor: 'var(--surface-1, #fff)', borderRadius: '12px', width: '90%',
    maxWidth: 800, maxHeight: '88vh', overflowY: 'auto', padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  };

  const renderInput = (label, field, type = 'text', opts = {}) => (
    <div style={{ flex: opts.flex || '1 1 200px' }}>
      <label style={labelStyle}>{label}</label>
      {opts.type === 'select' ? (
        <select style={inputStyle} value={formData[field]} onChange={e => setFormData(f => ({ ...f, [field]: e.target.value }))}>
          <option value="">Select...</option>
          {opts.options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : opts.type === 'textarea' ? (
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={formData[field]}
          onChange={e => setFormData(f => ({ ...f, [field]: e.target.value }))} />
      ) : (
        <input style={inputStyle} type={type} value={formData[field]}
          onChange={e => setFormData(f => ({ ...f, [field]: e.target.value }))}
          placeholder={opts.placeholder || ''} step={opts.step} />
      )}
    </div>
  );

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-900)' }}>Bill of Lading Audit</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-500)' }}>
            Review, verify, and audit bills of lading for freight compliance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handlePdfUpload}
          />
          <button
            style={{ ...btnStyle('#3b82f6'), opacity: uploading ? 0.6 : 1 }}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Processing...' : 'Upload BOL PDF'}
          </button>
          <button style={btnStyle('#059669')} onClick={() => { setEditingBol(null); setFormData(emptyForm); setShowForm(true); }}>
            + New BOL
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <StatCard label="Total BOLs" value={parseInt(stats.total)} />
          <StatCard label="Pending" value={parseInt(stats.pending)} color="#f59e0b" />
          <StatCard label="Approved" value={parseInt(stats.approved)} color="#059669" />
          <StatCard label="Discrepancies" value={parseInt(stats.discrepancy)} color="#9333ea" />
          <StatCard label="Total Freight" value={formatCurrency(stats.total_freight_usd)} />
          <StatCard label="Flagged Value" value={formatCurrency(stats.flagged_freight_usd)} color="#dc2626" />
        </div>
      )}

      {/* Filters */}
      <div className="dash-panel" style={{ padding: '12px 16px', marginBottom: '1rem', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, maxWidth: 280 }}
          placeholder="Search BOL#, supplier, carrier, vessel..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-500)' }}>
          {pagination.total} record{pagination.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="dash-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-2, #f3f4f6)' }}>
                {['BOL #', 'Supplier', 'Carrier', 'Vessel', 'POL', 'POD', 'Issue Date', 'Weight', 'Freight (USD)', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Actions' ? 'center' : 'left', fontWeight: 600, borderBottom: '2px solid var(--border-color, #e5e7eb)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-500)' }}>Loading...</td></tr>
              ) : bols.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-500)' }}>No bills of lading found. Click "+ New BOL" to add one.</td></tr>
              ) : bols.map((bol, idx) => (
                <tr key={bol.id} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--surface-2, #f9fafb)', borderBottom: '1px solid var(--border-color, #f0f0f0)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{bol.bol_number}</td>
                  <td style={{ padding: '10px 12px' }}>{bol.supplier_name || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{bol.carrier_name || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{bol.vessel_name || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{bol.port_of_loading || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{bol.port_of_discharge || '-'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(bol.issue_date)}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatWeight(bol.gross_weight_kg)}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatCurrency(bol.freight_charges_usd)}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={bol.audit_status} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {bol.pdf_filename && (
                      <button style={{ ...btnStyle('#8b5cf6'), marginRight: 4, padding: '4px 10px' }} onClick={() => viewPdfResults(bol)} title="View PDF extraction results">PDF</button>
                    )}
                    <button style={{ ...btnStyle('#3b82f6'), marginRight: 4, padding: '4px 10px' }} onClick={() => openAudit(bol)} title="Audit">Audit</button>
                    <button style={{ ...btnStyle('#6b7280'), marginRight: 4, padding: '4px 10px' }} onClick={() => openEdit(bol)} title="Edit">Edit</button>
                    <button style={{ ...btnStyle('#dc2626'), padding: '4px 10px' }} onClick={() => handleDelete(bol)} title="Delete">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
            <button style={{ ...btnStyle('#6b7280'), opacity: pagination.page <= 1 ? 0.5 : 1 }} disabled={pagination.page <= 1} onClick={() => fetchBols(pagination.page - 1)}>Prev</button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-500)' }}>Page {pagination.page} of {pagination.pages}</span>
            <button style={{ ...btnStyle('#6b7280'), opacity: pagination.page >= pagination.pages ? 0.5 : 1 }} disabled={pagination.page >= pagination.pages} onClick={() => fetchBols(pagination.page + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={modalOverlay} onClick={() => setShowForm(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{editingBol ? 'Edit' : 'New'} Bill of Lading</h2>
              <button style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-500)' }} onClick={() => setShowForm(false)}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {renderInput('BOL Number *', 'bol_number')}
              {renderInput('Shipment ID', 'shipment_id')}
              {renderInput('Supplier', 'supplier_name')}
              {renderInput('Carrier', 'carrier_name')}
              {renderInput('Vessel Name', 'vessel_name')}
              {renderInput('Voyage Number', 'voyage_number')}
              {renderInput('Port of Loading', 'port_of_loading')}
              {renderInput('Port of Discharge', 'port_of_discharge')}
              {renderInput('Consignee', 'consignee')}
              {renderInput('Shipper', 'shipper')}
              {renderInput('Notify Party', 'notify_party')}
              {renderInput('Payment Terms', 'payment_terms', 'text', { type: 'select', options: PAYMENT_TERMS })}
              {renderInput('Incoterm', 'incoterm', 'text', { type: 'select', options: INCOTERMS })}
              {renderInput('Issue Date', 'issue_date', 'date')}
              {renderInput('Ship on Board Date', 'ship_on_board_date', 'date')}
              {renderInput('Gross Weight (kg)', 'gross_weight_kg', 'number', { step: '0.001' })}
              {renderInput('Volume (CBM)', 'volume_cbm', 'number', { step: '0.001' })}
              {renderInput('Number of Packages', 'number_of_packages', 'number')}
              {renderInput('Freight Charges (USD)', 'freight_charges_usd', 'number', { step: '0.01' })}
              {renderInput('Declared Value (USD)', 'declared_value_usd', 'number', { step: '0.01' })}
              {renderInput('Container Numbers', 'container_numbers', 'text', { flex: '1 1 100%', placeholder: 'Comma-separated: MSKU1234567, TGHU7654321' })}
              {renderInput('Description of Goods', 'description_of_goods', 'text', { type: 'textarea', flex: '1 1 100%' })}
              {renderInput('Notes', 'notes', 'text', { type: 'textarea', flex: '1 1 100%' })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={btnStyle('#6b7280')} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...btnStyle('#059669'), opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
                {saving ? 'Saving...' : editingBol ? 'Update BOL' : 'Create BOL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAuditModal && auditingBol && (
        <div style={modalOverlay} onClick={() => setShowAuditModal(false)}>
          <div style={{ ...modalBox, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Audit BOL: {auditingBol.bol_number}</h2>
              <button style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-500)' }} onClick={() => setShowAuditModal(false)}>&times;</button>
            </div>

            {/* BOL Summary */}
            <div style={{ backgroundColor: 'var(--surface-2, #f9fafb)', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><strong>Supplier:</strong> {auditingBol.supplier_name || '-'}</div>
                <div><strong>Carrier:</strong> {auditingBol.carrier_name || '-'}</div>
                <div><strong>Vessel:</strong> {auditingBol.vessel_name || '-'}</div>
                <div><strong>Voyage:</strong> {auditingBol.voyage_number || '-'}</div>
                <div><strong>Weight:</strong> {formatWeight(auditingBol.gross_weight_kg)}</div>
                <div><strong>Freight:</strong> {formatCurrency(auditingBol.freight_charges_usd)}</div>
                <div><strong>Packages:</strong> {auditingBol.number_of_packages || '-'}</div>
                <div><strong>Declared Value:</strong> {formatCurrency(auditingBol.declared_value_usd)}</div>
              </div>
            </div>

            {/* Verification Checklist */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Verification Checklist</label>
              {[
                ['weight_verified', 'Weight verified against shipping documents'],
                ['charges_verified', 'Freight charges verified against contract rates'],
                ['documents_verified', 'Supporting documents complete and valid'],
              ].map(([field, text]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={auditForm[field]} onChange={e => setAuditForm(f => ({ ...f, [field]: e.target.checked }))} />
                  {text}
                </label>
              ))}
            </div>

            {/* Decision */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Audit Decision</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'pending').map(([key, cfg]) => (
                  <button key={key} onClick={() => setAuditForm(f => ({ ...f, audit_status: key }))}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: `2px solid ${auditForm.audit_status === key ? cfg.color : '#e5e7eb'}`,
                      backgroundColor: auditForm.audit_status === key ? cfg.bg : 'transparent',
                      color: auditForm.audit_status === key ? cfg.color : 'var(--text-500)',
                      fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                    }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Audit Notes</label>
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={auditForm.audit_notes}
                onChange={e => setAuditForm(f => ({ ...f, audit_notes: e.target.value }))}
                placeholder="Add notes about the audit decision..." />
            </div>

            {/* Discrepancies */}
            {(auditForm.audit_status === 'discrepancy' || auditForm.audit_status === 'rejected') && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Discrepancies (one per line)</label>
                <textarea style={{ ...inputStyle, minHeight: 70 }} value={auditForm.discrepancies}
                  onChange={e => setAuditForm(f => ({ ...f, discrepancies: e.target.value }))}
                  placeholder="Weight mismatch: declared 5000kg, actual 4800kg&#10;Missing customs documentation" />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={btnStyle('#6b7280')} onClick={() => setShowAuditModal(false)}>Cancel</button>
              <button style={{ ...btnStyle(STATUS_CONFIG[auditForm.audit_status]?.color || '#059669'), opacity: saving ? 0.6 : 1 }}
                disabled={saving} onClick={handleAuditSubmit}>
                {saving ? 'Submitting...' : `Submit: ${STATUS_CONFIG[auditForm.audit_status]?.label || 'Audit'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Upload Result Modal */}
      {showUploadResult && uploadResult && (
        <div style={modalOverlay} onClick={() => setShowUploadResult(false)}>
          <div style={{ ...modalBox, maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>PDF Extraction Results</h2>
                {uploadResult.bol.pdf_filename && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-500)' }}>
                    Source: {uploadResult.bol.pdf_filename}
                  </p>
                )}
              </div>
              <button style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-500)' }} onClick={() => setShowUploadResult(false)}>&times;</button>
            </div>

            {/* Auto-Audit Status */}
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              backgroundColor: uploadResult.bol.audit_status === 'approved' ? '#d1fae5' : uploadResult.bol.audit_status === 'discrepancy' ? '#f3e8ff' : '#fef3c7',
              border: `1px solid ${uploadResult.bol.audit_status === 'approved' ? '#059669' : uploadResult.bol.audit_status === 'discrepancy' ? '#9333ea' : '#f59e0b'}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                Auto-Audit: <StatusBadge status={uploadResult.bol.audit_status} />
                {uploadResult.extraction?.score != null ? (
                  <span style={{ marginLeft: 12, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-500)' }}>
                    Score: {uploadResult.extraction.score}/100
                  </span>
                ) : uploadResult.bol.audit_notes && /score:\s*(\d+)/i.test(uploadResult.bol.audit_notes) && (
                  <span style={{ marginLeft: 12, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-500)' }}>
                    {uploadResult.bol.audit_notes}
                  </span>
                )}
              </div>
              {uploadResult.extraction?.matched_shipment && (
                <div style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--text-700)' }}>
                  Matched shipment: {uploadResult.extraction.matched_shipment.order_ref} ({uploadResult.extraction.matched_shipment.supplier})
                </div>
              )}
            </div>

            {/* Extracted BOL Data */}
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Extracted Data</h3>
              <div style={{ backgroundColor: 'var(--surface-2, #f9fafb)', borderRadius: 8, padding: 14, fontSize: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    ['BOL Number', uploadResult.bol.bol_number],
                    ['Supplier', uploadResult.bol.supplier_name],
                    ['Carrier', uploadResult.bol.carrier_name],
                    ['Vessel', uploadResult.bol.vessel_name],
                    ['Voyage', uploadResult.bol.voyage_number],
                    ['Port of Loading', uploadResult.bol.port_of_loading],
                    ['Port of Discharge', uploadResult.bol.port_of_discharge],
                    ['Consignee', uploadResult.bol.consignee],
                    ['Shipper', uploadResult.bol.shipper],
                    ['Weight', uploadResult.bol.gross_weight_kg ? `${uploadResult.bol.gross_weight_kg} kg` : null],
                    ['Volume', uploadResult.bol.volume_cbm ? `${uploadResult.bol.volume_cbm} CBM` : null],
                    ['Packages', uploadResult.bol.number_of_packages],
                    ['Freight', uploadResult.bol.freight_charges_usd ? `$${uploadResult.bol.freight_charges_usd}` : null],
                    ['Payment Terms', uploadResult.bol.payment_terms],
                    ['Incoterm', uploadResult.bol.incoterm],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label}><strong>{label}:</strong> {val}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scoring Breakdown */}
            {(() => {
              const FIELD_WEIGHTS = [
                { key: 'bol_number', label: 'BOL Number', weight: 20 },
                { key: 'supplier_name', label: 'Supplier', weight: 10 },
                { key: 'gross_weight_kg', label: 'Gross Weight', weight: 10 },
                { key: 'consignee', label: 'Consignee', weight: 8 },
                { key: 'shipper', label: 'Shipper', weight: 8 },
                { key: 'vessel_name', label: 'Vessel', weight: 7 },
                { key: 'port_of_loading', label: 'Port of Loading', weight: 7 },
                { key: 'port_of_discharge', label: 'Port of Discharge', weight: 7 },
                { key: 'incoterm', label: 'Incoterm', weight: 5 },
                { key: 'payment_terms', label: 'Payment Terms', weight: 4 },
                { key: 'container_numbers', label: 'Container Numbers', weight: 4 },
                { key: 'freight_charges_usd', label: 'Freight Charges', weight: 4 },
                { key: 'number_of_packages', label: 'Packages', weight: 3 },
                { key: 'carrier_name', label: 'Carrier', weight: 3 },
              ];
              const totalWeight = FIELD_WEIGHTS.reduce((s, f) => s + f.weight, 0);
              const bol = uploadResult.bol;
              let earned = 0;
              const rows = FIELD_WEIGHTS.map(f => {
                const val = bol[f.key];
                const hasValue = f.key === 'container_numbers'
                  ? (Array.isArray(val) ? val.length > 0 : !!val)
                  : !!val;
                if (hasValue) earned += f.weight;
                return { ...f, hasValue, pts: hasValue ? f.weight : 0 };
              });
              const baseScore = Math.round((earned / totalWeight) * 100);

              return (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Scoring Breakdown</h3>
                  <div style={{ backgroundColor: 'var(--surface-2, #f9fafb)', borderRadius: 8, padding: 14 }}>
                    {/* Score bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-700)' }}>Extraction Score</span>
                        <span style={{
                          fontSize: '0.95rem', fontWeight: 700,
                          color: baseScore >= 80 ? '#059669' : baseScore >= 50 ? '#d97706' : '#dc2626',
                        }}>{baseScore}/100</span>
                      </div>
                      <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4, transition: 'width 0.5s',
                          width: `${baseScore}%`,
                          backgroundColor: baseScore >= 80 ? '#059669' : baseScore >= 50 ? '#d97706' : '#dc2626',
                        }} />
                      </div>
                    </div>
                    {/* Field breakdown table */}
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600, color: 'var(--text-500)' }}>Field</th>
                          <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600, color: 'var(--text-500)', width: 60 }}>Weight</th>
                          <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600, color: 'var(--text-500)', width: 60 }}>Earned</th>
                          <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600, color: 'var(--text-500)', width: 60 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.key} style={{ borderBottom: '1px solid var(--border-color, #f0f0f0)' }}>
                            <td style={{ padding: '4px 6px' }}>{r.label}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-500)' }}>{r.weight}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: r.hasValue ? '#059669' : '#dc2626' }}>{r.pts}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block', width: 18, height: 18, lineHeight: '18px', borderRadius: '50%',
                                fontSize: '0.7rem', fontWeight: 700, textAlign: 'center',
                                backgroundColor: r.hasValue ? '#d1fae5' : '#fee2e2',
                                color: r.hasValue ? '#059669' : '#dc2626',
                              }}>{r.hasValue ? '\u2713' : '\u2717'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--border-color, #d1d5db)' }}>
                          <td style={{ padding: '6px', fontWeight: 700 }}>Total</td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: 'var(--text-500)' }}>{totalWeight}</td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>{earned}</td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: baseScore >= 80 ? '#059669' : baseScore >= 50 ? '#d97706' : '#dc2626' }}>{baseScore}%</td>
                        </tr>
                      </tfoot>
                    </table>
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-400)' }}>
                      Scores above 80% are rated Excellent, 50-79% Good, below 50% Needs Review. Deductions apply for shipment data mismatches.
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Extraction Confidence */}
            {uploadResult.extraction?.confidence && Object.keys(uploadResult.extraction.confidence).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Extraction Confidence</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(uploadResult.extraction.confidence).map(([field, score]) => (
                    <span key={field} style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                      backgroundColor: score >= 0.8 ? '#d1fae5' : score >= 0.5 ? '#fef3c7' : '#fee2e2',
                      color: score >= 0.8 ? '#059669' : score >= 0.5 ? '#d97706' : '#dc2626',
                    }}>
                      {field.replace(/_/g, ' ')}: {Math.round(score * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Findings */}
            {uploadResult.extraction?.findings?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Audit Findings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {uploadResult.extraction.findings.map((f, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem',
                      backgroundColor: f.severity === 'error' ? '#fee2e2' : f.severity === 'warning' ? '#fef3c7' : '#dbeafe',
                      border: `1px solid ${f.severity === 'error' ? '#fca5a5' : f.severity === 'warning' ? '#fcd34d' : '#93c5fd'}`,
                    }}>
                      <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: f.severity === 'error' ? '#dc2626' : f.severity === 'warning' ? '#d97706' : '#2563eb' }}>
                        {f.severity}
                      </strong>
                      {' '}{f.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              {uploadResult.bol?.id && (
                <button style={btnStyle('#3b82f6')} onClick={() => {
                  setShowUploadResult(false);
                  // Find the BOL in the list and open audit
                  const bol = bols.find(b => b.id === uploadResult.bol.id);
                  if (bol) openAudit(bol);
                }}>
                  Review & Audit
                </button>
              )}
              <button style={btnStyle('#6b7280')} onClick={() => setShowUploadResult(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BolAudit;
