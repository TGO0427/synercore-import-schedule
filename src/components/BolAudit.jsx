import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useNotification } from '../contexts/NotificationContext';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

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
  container_numbers: '', container_type: '', gross_weight_kg: '', volume_cbm: '',
  number_of_packages: '', freight_charges_usd: '', declared_value_usd: '',
  benchmark_rate_per_kg: '',
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

  // Month selector — defaults to current month
  const getCurrentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${selectedMonth}-${String(last).padStart(2, '0')}`;
  })();
  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  })();

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
  const fileInputRef = useRef(null);

  // Benchmarks
  const [benchmarks, setBenchmarks] = useState([]);
  const emptyBenchmarkForm = () => ({ port_of_loading: '', port_of_discharge: '', rate_per_kg_usd: '', rate_20gp_usd: '', rate_40gp_usd: '', rate_40hc_usd: '', carrier_name: '', transport_mode: 'sea', valid_from: monthStart, valid_until: monthEnd, notes: '' });
  const [benchmarkForm, setBenchmarkForm] = useState(emptyBenchmarkForm());
  const [editingBenchmark, setEditingBenchmark] = useState(null);
  const [activeTab, setActiveTab] = useState('audit');
  const [uploadingRates, setUploadingRates] = useState(false);
  const [rateUploadResult, setRateUploadResult] = useState(null);
  const rateFileInputRef = useRef(null);

  // [#2] Bulk selection
  const [selectedBols, setSelectedBols] = useState(new Set());

  // [#6] Audit history
  const [auditHistory, setAuditHistory] = useState([]);

  // [#7] Carrier stats
  const [carrierStats, setCarrierStats] = useState([]);

  // [#10] Confidence threshold
  const [confidenceThreshold, setConfidenceThreshold] = useState(() => {
    const saved = localStorage.getItem('bolAudit_confidenceThreshold');
    return saved ? parseInt(saved) : 80;
  });

  // Fetch BOLs — filtered by selected month
  const fetchBols = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (statusFilter !== 'all') params.set('audit_status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('date_from', monthStart);
      params.set('date_to', monthEnd);

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
  }, [statusFilter, search, monthStart, monthEnd]);

  // Fetch stats — filtered by selected month
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(getApiUrl(`/api/bol-audit/stats?month=${selectedMonth}`));
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (err) {
      // Non-critical
    }
  }, [selectedMonth]);

  // Fetch benchmarks — filtered by selected month
  const fetchBenchmarks = useCallback(async () => {
    try {
      const res = await authFetch(getApiUrl(`/api/bol-audit/benchmarks?month=${selectedMonth}`));
      if (res.ok) {
        const json = await res.json();
        setBenchmarks(json.data || []);
      }
    } catch (err) { /* non-critical */ }
  }, [selectedMonth]);

  // [#7] Fetch carrier stats
  const fetchCarrierStats = useCallback(async () => {
    try {
      const res = await authFetch(getApiUrl(`/api/bol-audit/carrier-stats?month=${selectedMonth}`));
      if (res.ok) {
        const json = await res.json();
        setCarrierStats(json.data || []);
      }
    } catch (err) { /* non-critical */ }
  }, [selectedMonth]);

  useEffect(() => { fetchBols(1); }, [fetchBols]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchBenchmarks(); }, [fetchBenchmarks]);
  useEffect(() => { if (activeTab === 'cost') fetchCarrierStats(); }, [activeTab, fetchCarrierStats]);
  // Update benchmark form dates when month changes
  useEffect(() => { if (!editingBenchmark) setBenchmarkForm(f => ({ ...f, valid_from: monthStart, valid_until: monthEnd })); }, [monthStart, monthEnd]);
  // Clear selection on page/filter change
  useEffect(() => { setSelectedBols(new Set()); }, [bols]);

  // [#9] Keyboard shortcuts for audit modal
  useEffect(() => {
    if (!showAuditModal) return;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') { e.preventDefault(); handleAuditSubmit(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAuditModal, auditForm, auditingBol, saving]);

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
        benchmark_rate_per_kg: formData.benchmark_rate_per_kg ? parseFloat(formData.benchmark_rate_per_kg) : null,
        declared_value_usd: formData.declared_value_usd ? parseFloat(formData.declared_value_usd) : null,
        container_type: formData.container_type || null,
        issue_date: formData.issue_date || null,
        ship_on_board_date: formData.ship_on_board_date || null,
        shipment_id: formData.shipment_id || null,
        payment_terms: formData.payment_terms || null,
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

  // [#2] Bulk audit
  const handleBulkAudit = async (status) => {
    if (selectedBols.size === 0) return;
    const confirmed = await confirm({
      title: `Bulk ${status}`,
      message: `Set ${selectedBols.size} BOL(s) to "${status}"?`,
      confirmText: `${status.charAt(0).toUpperCase() + status.slice(1)} All`,
      type: status === 'approved' ? 'info' : 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await authFetch(getApiUrl('/api/bol-audit/bulk-audit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bol_ids: [...selectedBols], audit_status: status }),
      });
      const json = await res.json();
      if (res.ok) {
        showSuccess(json.message);
        setSelectedBols(new Set());
        fetchBols(pagination.page);
        fetchStats();
      } else {
        showError(json.error || 'Bulk audit failed');
      }
    } catch (err) {
      showError('Bulk audit failed');
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

  // Benchmark CRUD
  const handleBenchmarkSave = async () => {
    if (!benchmarkForm.port_of_loading.trim() || !benchmarkForm.port_of_discharge.trim()) {
      showError('Port of Loading and Port of Discharge are required');
      return;
    }
    setSaving(true);
    try {
      const url = editingBenchmark
        ? getApiUrl(`/api/bol-audit/benchmarks/${editingBenchmark.id}`)
        : getApiUrl('/api/bol-audit/benchmarks');
      const res = await authFetch(url, {
        method: editingBenchmark ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...benchmarkForm,
          rate_per_kg_usd: benchmarkForm.rate_per_kg_usd ? parseFloat(benchmarkForm.rate_per_kg_usd) : null,
          rate_20gp_usd: benchmarkForm.rate_20gp_usd ? parseFloat(benchmarkForm.rate_20gp_usd) : null,
          rate_40gp_usd: benchmarkForm.rate_40gp_usd ? parseFloat(benchmarkForm.rate_40gp_usd) : null,
          rate_40hc_usd: benchmarkForm.rate_40hc_usd ? parseFloat(benchmarkForm.rate_40hc_usd) : null,
        }),
      });
      if (res.ok) {
        showSuccess(editingBenchmark ? 'Benchmark updated' : 'Benchmark created');
        setEditingBenchmark(null);
        setBenchmarkForm(emptyBenchmarkForm());
        fetchBenchmarks();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save benchmark');
      }
    } catch (err) {
      showError('Failed to save benchmark');
    } finally {
      setSaving(false);
    }
  };

  const handleBenchmarkDelete = async (bm) => {
    const confirmed = await confirm({ title: 'Delete Benchmark', message: `Delete rate for ${bm.port_of_loading} → ${bm.port_of_discharge}?`, confirmText: 'Delete', type: 'danger' });
    if (!confirmed) return;
    try {
      const res = await authFetch(getApiUrl(`/api/bol-audit/benchmarks/${bm.id}`), { method: 'DELETE' });
      if (res.ok) { showSuccess('Benchmark deleted'); fetchBenchmarks(); }
    } catch (err) { showError('Failed to delete benchmark'); }
  };

  const handleDeleteAllBenchmarks = async () => {
    const confirmed = await confirm({ title: 'Delete All Rates', message: `Are you sure you want to delete all ${benchmarks.length} benchmark rates? This cannot be undone.`, confirmText: 'Delete All', type: 'danger' });
    if (!confirmed) return;
    try {
      const res = await authFetch(getApiUrl('/api/bol-audit/benchmarks'), { method: 'DELETE' });
      if (res.ok) {
        const json = await res.json();
        showSuccess(json.message);
        fetchBenchmarks();
      }
    } catch (err) { showError('Failed to delete benchmarks'); }
  };

  const openEditBenchmark = (bm) => {
    setEditingBenchmark(bm);
    setBenchmarkForm({
      port_of_loading: bm.port_of_loading || '', port_of_discharge: bm.port_of_discharge || '',
      rate_per_kg_usd: bm.rate_per_kg_usd ?? '',
      rate_20gp_usd: bm.rate_20gp_usd ?? '', rate_40gp_usd: bm.rate_40gp_usd ?? '', rate_40hc_usd: bm.rate_40hc_usd ?? '',
      carrier_name: bm.carrier_name || '',
      transport_mode: bm.transport_mode || 'sea', valid_from: bm.valid_from ? bm.valid_from.split('T')[0] : '',
      valid_until: bm.valid_until ? bm.valid_until.split('T')[0] : '', notes: bm.notes || '',
    });
  };

  // Download rate sheet template
  const downloadRateTemplate = () => {
    const headers = [
      'Port of Loading', 'Port of Discharge', 'Rate per kg (USD)', '20GP (USD)',
      '40GP (USD)', '40HC (USD)', 'Carrier', 'Mode', 'Valid From', 'Valid Until', 'Notes'
    ];
    const sampleRows = [
      ['Shanghai', 'Durban', '', 2000, 2100, 2100, 'ONE', 'sea', '2026-01-01', '2026-12-31', ''],
      ['Shanghai', 'Durban', '', 1950, 2100, 2100, 'CMA-CGM', 'sea', '2026-01-01', '2026-12-31', ''],
      ['Shanghai', 'Durban', '', 1900, 1950, 1950, 'MSC Special', 'sea', '', '', ''],
      ['Qingdao', 'Durban', '', 2000, 2100, 2100, 'ONE', 'sea', '', '', ''],
      ['Port Kelang', 'Durban', '', 2000, 2050, 2050, 'MSC Special', 'sea', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rate Benchmarks');
    XLSX.writeFile(wb, 'Rate_Benchmark_Template.xlsx');
  };

  // Rate sheet upload
  const handleRateSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv|pdf)$/i)) {
      showError('Please select a PDF, Excel (.xlsx/.xls), or CSV file');
      return;
    }

    setUploadingRates(true);
    setRateUploadResult(null);
    try {
      const formPayload = new FormData();
      formPayload.append('rateSheet', file);
      formPayload.append('month', selectedMonth);

      const res = await authFetch(getApiUrl('/api/bol-audit/benchmarks/upload'), {
        method: 'POST',
        body: formPayload,
      });

      const json = await res.json();
      if (res.ok) {
        setRateUploadResult(json);
        showSuccess(json.message);
        fetchBenchmarks();
      } else {
        showError(json.error || 'Failed to process rate sheet');
        if (json.hint || json.debug) setRateUploadResult({ error: json.error, hint: json.hint, debug: json.debug });
      }
    } catch (err) {
      showError('Failed to upload rate sheet');
    } finally {
      setUploadingRates(false);
      if (rateFileInputRef.current) rateFileInputRef.current.value = '';
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
        const isDup = json.data.is_duplicate;
        const statusMsg = json.data.audit_status === 'approved' ? 'auto-approved'
          : json.data.audit_status === 'discrepancy' && isDup ? 'flagged as duplicate for review'
          : 'flagged for review';
        showSuccess(`BOL extracted and ${statusMsg}`);
        fetchBols(1);
        fetchStats();
      } else if (res.status === 409) {
        showError(json.error || 'This BOL has already been uploaded');
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
        score: null,
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
      container_type: bol.container_type || '',
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
      benchmark_rate_per_kg: bol.benchmark_rate_per_kg ?? '',
    });
    setShowForm(true);
  };

  // [#6] Open audit (with history fetch)
  const openAudit = async (bol) => {
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
    // Fetch audit history
    try {
      const res = await authFetch(getApiUrl(`/api/bol-audit/${bol.id}/history`));
      if (res.ok) {
        const json = await res.json();
        setAuditHistory(json.data || []);
      }
    } catch (err) { setAuditHistory([]); }
  };

  const formatCurrency = (val) => val != null ? `$${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-';
  const formatDate = (val) => val ? new Date(val).toLocaleDateString() : '-';
  const formatWeight = (val) => val != null ? `${parseFloat(val).toLocaleString()} kg` : '-';

  // [#3] Export to Excel
  const handleExport = (type) => {
    const data = type === 'cost'
      ? bols.filter(b => b.freight_charges_usd).map(b => ({
          'BOL #': b.bol_number, Supplier: b.supplier_name || '', Carrier: b.carrier_name || '',
          'Port of Loading': b.port_of_loading || '', 'Port of Discharge': b.port_of_discharge || '',
          'Container Type': b.container_type || '', 'Weight (kg)': b.gross_weight_kg || '',
          'Actual Freight (USD)': b.freight_charges_usd || '', 'Benchmark Rate (USD)': b.benchmark_rate_per_kg || '',
          'Expected (USD)': b.expected_freight_usd || '', 'Variance (USD)': b.freight_variance_usd || '',
          Status: b.audit_status, Duplicate: b.is_duplicate ? 'Yes' : 'No',
        }))
      : bols.map(b => ({
          'BOL #': b.bol_number, Supplier: b.supplier_name || '', Carrier: b.carrier_name || '',
          Vessel: b.vessel_name || '', 'Port of Loading': b.port_of_loading || '',
          'Port of Discharge': b.port_of_discharge || '', 'Issue Date': b.issue_date ? b.issue_date.split('T')[0] : '',
          'Weight (kg)': b.gross_weight_kg || '', 'Freight (USD)': b.freight_charges_usd || '',
          Status: b.audit_status, 'Container Type': b.container_type || '',
          'Audited By': b.audited_by_name || '', 'Audit Notes': b.audit_notes || '',
        }));

    if (data.length === 0) { showError('No data to export'); return; }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'cost' ? 'Cost Protection' : 'BOL Audit');
    XLSX.writeFile(wb, `BOL_${type === 'cost' ? 'Cost_Protection' : 'Audit'}_${selectedMonth}.xlsx`);
    showSuccess(`Exported ${data.length} records`);
  };

  // [#4] High-variance alerts
  const highVarianceBols = useMemo(() =>
    bols.filter(b => {
      const v = parseFloat(b.freight_variance_usd || 0);
      const f = parseFloat(b.freight_charges_usd || 0);
      return v > 0 && f > 0 && (v / f) > 0.1; // >10% overcharge
    }),
    [bols]
  );

  // [#5] Expiring benchmarks (within 30 days)
  const expiringBenchmarks = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return benchmarks.filter(bm => {
      if (!bm.valid_until) return false;
      const exp = new Date(bm.valid_until);
      return exp >= now && exp <= thirtyDays;
    });
  }, [benchmarks]);

  // [#8] Duplicate groups
  const duplicateGroups = useMemo(() => {
    const dups = bols.filter(b => b.is_duplicate);
    const groups = {};
    dups.forEach(b => {
      const key = b.bol_number;
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return Object.entries(groups).filter(([, v]) => v.length > 0);
  }, [bols]);

  // [#1] Chart data for Cost Protection
  const varianceChartData = useMemo(() => {
    const withVariance = bols
      .filter(b => b.freight_variance_usd != null && b.freight_charges_usd)
      .sort((a, b) => (a.issue_date || a.ship_on_board_date || '').localeCompare(b.issue_date || b.ship_on_board_date || ''));
    if (withVariance.length === 0) return null;
    const labels = withVariance.map(b => b.bol_number?.substring(0, 12) || `#${b.id}`);
    const variances = withVariance.map(b => parseFloat(b.freight_variance_usd));
    return {
      labels,
      datasets: [{
        label: 'Freight Variance (USD)',
        data: variances,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
        tension: 0.3, fill: true,
        pointBackgroundColor: variances.map(v => v > 0 ? '#dc2626' : '#059669'),
        pointBorderColor: variances.map(v => v > 0 ? '#dc2626' : '#059669'),
      }],
    };
  }, [bols]);

  const statusChartData = useMemo(() => {
    if (!stats) return null;
    const labels = ['Pending', 'Approved', 'Rejected', 'Discrepancy'];
    const values = [parseInt(stats.pending || 0), parseInt(stats.approved || 0), parseInt(stats.rejected || 0), parseInt(stats.discrepancy || 0)];
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#f59e0b', '#059669', '#dc2626', '#9333ea'],
      }],
    };
  }, [stats]);

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

  const changeMonth = (delta) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // [#2] Toggle select helpers
  const toggleSelect = (id) => {
    setSelectedBols(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedBols.size === bols.length) setSelectedBols(new Set());
    else setSelectedBols(new Set(bols.map(b => b.id)));
  };

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 12 }}>
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

      {/* [#4] High Variance Alert */}
      {highVarianceBols.length > 0 && activeTab === 'audit' && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: '1rem',
          backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.1rem' }}>!</span>
          <div style={{ fontSize: '0.85rem' }}>
            <strong style={{ color: '#dc2626' }}>{highVarianceBols.length} BOL(s) with &gt;10% freight overcharge</strong>
            {' — '}
            {highVarianceBols.slice(0, 3).map(b => b.bol_number).join(', ')}
            {highVarianceBols.length > 3 ? ` and ${highVarianceBols.length - 3} more` : ''}
            . Total overcharge: <strong style={{ color: '#dc2626' }}>
              {formatCurrency(highVarianceBols.reduce((s, b) => s + parseFloat(b.freight_variance_usd || 0), 0))}
            </strong>
          </div>
        </div>
      )}

      {/* Month Picker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem',
        padding: '10px 16px', borderRadius: 10,
        backgroundColor: 'var(--surface-1, #fff)', border: '1px solid var(--border-color, #e5e7eb)',
      }}>
        <button onClick={() => changeMonth(-1)} style={{
          padding: '6px 12px', border: '1px solid var(--border-color, #d1d5db)', borderRadius: 6,
          background: 'var(--surface-2, #f3f4f6)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
        }}>&#9664;</button>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '6px 12px', border: '1px solid var(--border-color, #d1d5db)', borderRadius: 6,
            fontSize: '0.95rem', fontWeight: 600, background: 'var(--surface-2, #f3f4f6)',
            color: 'var(--text-900, #111)', cursor: 'pointer',
          }}
        />
        <button onClick={() => changeMonth(1)} style={{
          padding: '6px 12px', border: '1px solid var(--border-color, #d1d5db)', borderRadius: 6,
          background: 'var(--surface-2, #f3f4f6)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
        }}>&#9654;</button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-500, #6b7280)', marginLeft: 8 }}>
          Showing data for <strong style={{ color: 'var(--text-900, #111)' }}>{monthLabel}</strong>
        </span>
        {selectedMonth !== getCurrentMonth() && (
          <button
            onClick={() => setSelectedMonth(getCurrentMonth())}
            style={{
              marginLeft: 'auto', padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6,
              border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#3b82f6',
            }}
          >
            Today
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.2rem', borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
        {[
          { key: 'audit', label: 'BOL Audit' },
          { key: 'cost', label: 'Cost Protection' },
          { key: 'benchmarks', label: 'Rate Benchmarks' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
            backgroundColor: 'transparent', borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === tab.key ? '#3b82f6' : 'var(--text-500)', marginBottom: '-2px',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Stats Cards */}
      {stats && activeTab === 'audit' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <StatCard label="Total BOLs" value={parseInt(stats.total)} />
          <StatCard label="Pending" value={parseInt(stats.pending)} color="#f59e0b" />
          <StatCard label="Approved" value={parseInt(stats.approved)} color="#059669" />
          <StatCard label="Discrepancies" value={parseInt(stats.discrepancy)} color="#9333ea" />
          <StatCard label="Total Freight" value={formatCurrency(stats.total_freight_usd)} />
          <StatCard label="Flagged Value" value={formatCurrency(stats.flagged_freight_usd)} color="#dc2626" />
        </div>
      )}

      {/* Cost Protection Dashboard */}
      {stats && activeTab === 'cost' && (
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatCard label="Total Freight Audited" value={formatCurrency(stats.total_freight_usd)} color="#3b82f6" />
            <StatCard label="Overcharges Caught" value={formatCurrency(stats.total_overcharges_usd)} color="#dc2626" />
            <StatCard label="Overcharge Count" value={parseInt(stats.overcharge_count || 0)} color="#dc2626" />
            <StatCard label="Under-Benchmark" value={formatCurrency(stats.total_undercharges_usd)} color="#059669" />
            <StatCard label="Avg Rate/kg" value={`$${parseFloat(stats.avg_freight_per_kg || 0).toFixed(4)}`} />
            <StatCard label="Duplicates Found" value={parseInt(stats.duplicate_count || 0)} color="#f59e0b" />
            <StatCard label="Weight Discrepancies" value={parseInt(stats.weight_discrepancy_count || 0)} color="#9333ea" />
          </div>

          {/* [#1] Charts — side by side */}
          {(varianceChartData || statusChartData) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
              <div className="dash-panel" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Freight Variance by BOL</h3>
                {varianceChartData ? (
                  <div style={{ height: 240 }}>
                    <Line data={varianceChartData} options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw > 0 ? '+' : ''}$${ctx.raw.toLocaleString()}` } } },
                      scales: {
                        x: { grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
                        y: { grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { callback: v => `$${v.toLocaleString()}`, font: { size: 11 } } },
                      },
                    }} />
                  </div>
                ) : (
                  <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-400)', fontSize: '0.85rem' }}>
                    Run Benchmark Check to see variance data
                  </div>
                )}
              </div>
              {statusChartData && (
                <div className="dash-panel" style={{ padding: 16 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Audit Status</h3>
                  <div style={{ height: 240, display: 'flex', justifyContent: 'center' }}>
                    <Doughnut data={statusChartData} options={{
                      responsive: true, maintainAspectRatio: false,
                      cutout: '68%',
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } },
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* [#10] Confidence Threshold Setting */}
          <div className="dash-panel" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)' }}>Auto-Approve Threshold:</span>
            <input type="range" min="50" max="100" step="5" value={confidenceThreshold}
              onChange={e => { const v = parseInt(e.target.value); setConfidenceThreshold(v); localStorage.setItem('bolAudit_confidenceThreshold', v); }}
              style={{ width: 120, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: confidenceThreshold >= 80 ? '#059669' : '#d97706', minWidth: 40 }}>
              {confidenceThreshold}%
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-400)' }}>
              BOLs scoring above this threshold are auto-approved on PDF upload
            </span>
          </div>

          {/* Run benchmark check + Export buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <button style={{ ...btnStyle('#6b7280'), fontSize: '0.85rem' }} onClick={() => handleExport('cost')}>
              Export to Excel
            </button>
            <button
              style={{ ...btnStyle('#3b82f6'), fontSize: '0.85rem' }}
              onClick={async () => {
                try {
                  const res = await authFetch(getApiUrl('/api/bol-audit/benchmark-check'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: selectedMonth }),
                  });
                  const json = await res.json();
                  if (res.ok) {
                    showSuccess(json.message);
                    fetchBols();
                    fetchStats();
                  } else {
                    showError(json.details ? `${json.error}: ${json.details}` : json.error || 'Benchmark check failed');
                  }
                } catch (err) { showError('Failed to run benchmark check'); }
              }}
            >
              Run Benchmark Check ({monthLabel})
            </button>
          </div>

          {/* [#7] Carrier Scorecards */}
          {carrierStats.length > 0 && (
            <div className="dash-panel" style={{ overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontWeight: 600, fontSize: '0.95rem' }}>
                Carrier Scorecards
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-2, #f3f4f6)' }}>
                      {['Carrier', 'BOLs', 'Total Freight', 'Overcharges', 'Undercharges', 'Avg Var %', 'Weight Issues', 'Duplicates', 'Approved', 'Discrepancies'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border-color, #e5e7eb)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {carrierStats.map((cs, idx) => {
                      const varPct = parseFloat(cs.avg_variance_pct || 0);
                      return (
                        <tr key={cs.carrier_name} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--surface-2, #f9fafb)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{cs.carrier_name}</td>
                          <td style={{ padding: '8px 10px' }}>{parseInt(cs.total_bols)}</td>
                          <td style={{ padding: '8px 10px' }}>{formatCurrency(cs.total_freight)}</td>
                          <td style={{ padding: '8px 10px', color: '#dc2626', fontWeight: 600 }}>
                            {formatCurrency(cs.total_overcharges)} ({parseInt(cs.overcharge_count)})
                          </td>
                          <td style={{ padding: '8px 10px', color: '#059669' }}>
                            {formatCurrency(cs.total_undercharges)} ({parseInt(cs.undercharge_count)})
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: varPct > 5 ? '#dc2626' : varPct < -5 ? '#059669' : 'var(--text-500)' }}>
                            {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%
                          </td>
                          <td style={{ padding: '8px 10px' }}>{parseInt(cs.weight_discrepancies)}</td>
                          <td style={{ padding: '8px 10px' }}>{parseInt(cs.duplicates)}</td>
                          <td style={{ padding: '8px 10px', color: '#059669' }}>{parseInt(cs.approved_count)}</td>
                          <td style={{ padding: '8px 10px', color: '#9333ea' }}>{parseInt(cs.discrepancy_count)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* [#8] Duplicate Groups */}
          {duplicateGroups.length > 0 && (
            <div className="dash-panel" style={{ overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontWeight: 600, fontSize: '0.95rem', color: '#d97706' }}>
                Duplicate BOLs — Side-by-Side Comparison
              </div>
              {duplicateGroups.map(([bolNum, dups]) => (
                <div key={bolNum} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #f0f0f0)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-700)' }}>BOL# {bolNum} ({dups.length} entries)</div>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                    {dups.map(d => (
                      <div key={d.id} style={{
                        flex: '0 0 220px', padding: '10px', borderRadius: 8, fontSize: '0.8rem',
                        backgroundColor: 'var(--surface-2, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)',
                      }}>
                        <div><strong>File:</strong> {d.pdf_filename || 'Manual'}</div>
                        <div><strong>Supplier:</strong> {d.supplier_name || '-'}</div>
                        <div><strong>Carrier:</strong> {d.carrier_name || '-'}</div>
                        <div><strong>Freight:</strong> {formatCurrency(d.freight_charges_usd)}</div>
                        <div><strong>Weight:</strong> {formatWeight(d.gross_weight_kg)}</div>
                        <div><strong>Date:</strong> {formatDate(d.issue_date)}</div>
                        <div style={{ marginTop: 6 }}><StatusBadge status={d.audit_status} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cost protection table — show BOLs with freight variances */}
          <div className="dash-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontWeight: 600, fontSize: '0.95rem' }}>
              Freight Variance Detail
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2, #f3f4f6)' }}>
                    {['BOL #', 'Supplier', 'Route', 'Container', 'Weight (kg)', 'Actual Freight', 'Benchmark Rate', 'Expected', 'Variance', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border-color, #e5e7eb)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bols.filter(b => b.freight_variance_usd != null || b.freight_charges_usd).length === 0 ? (
                    <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: 'var(--text-500)' }}>No freight data to analyze. Upload BOL PDFs and import rate benchmarks, then click "Run Benchmark Check".</td></tr>
                  ) : bols.filter(b => b.freight_charges_usd).map((bol, idx) => {
                    const variance = parseFloat(bol.freight_variance_usd || 0);
                    const benchmarkVal = parseFloat(bol.benchmark_rate_per_kg || 0);
                    return (
                      <tr key={bol.id} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--surface-2, #f9fafb)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{bol.bol_number}</td>
                        <td style={{ padding: '10px 12px' }}>{bol.supplier_name || '-'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{bol.port_of_loading || '?'} → {bol.port_of_discharge || '?'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{bol.container_type || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{bol.gross_weight_kg ? parseFloat(bol.gross_weight_kg).toLocaleString() : '-'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{formatCurrency(bol.freight_charges_usd)}</td>
                        <td style={{ padding: '10px 12px' }}>{benchmarkVal > 0 ? formatCurrency(benchmarkVal) : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{bol.expected_freight_usd ? formatCurrency(bol.expected_freight_usd) : '-'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: variance > 0 ? '#dc2626' : variance < 0 ? '#059669' : 'var(--text-500)' }}>
                          {bol.freight_variance_usd != null ? `${variance > 0 ? '+' : ''}${formatCurrency(bol.freight_variance_usd)}` : 'No benchmark'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {bol.is_duplicate && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fef3c7', color: '#d97706', marginRight: 4 }}>DUP</span>}
                          <StatusBadge status={bol.audit_status} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}
                            title="Re-check this BOL against benchmarks"
                            onClick={async () => {
                              try {
                                const r = await authFetch(getApiUrl('/api/bol-audit/benchmark-check'), {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ bol_ids: [bol.id] }),
                                });
                                const j = await r.json();
                                if (r.ok) { showSuccess(j.message); fetchBols(); fetchStats(); }
                                else showError(j.error);
                              } catch { showError('Check failed'); }
                            }}
                          >Check</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rate Benchmarks Tab */}
      {activeTab === 'benchmarks' && (
        <div style={{ marginBottom: '1.2rem' }}>
          {/* [#5] Expiring Benchmarks Warning */}
          {expiringBenchmarks.length > 0 && (
            <div style={{
              padding: '10px 16px', borderRadius: 8, marginBottom: 16,
              backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
              fontSize: '0.85rem',
            }}>
              <strong style={{ color: '#d97706' }}>Rate Expiry Warning:</strong>{' '}
              {expiringBenchmarks.length} benchmark rate(s) expire within 30 days —{' '}
              {expiringBenchmarks.slice(0, 3).map(bm =>
                `${bm.port_of_loading} → ${bm.port_of_discharge} (${bm.carrier_name}, expires ${new Date(bm.valid_until).toLocaleDateString()})`
              ).join('; ')}
              {expiringBenchmarks.length > 3 && ` and ${expiringBenchmarks.length - 3} more`}.
              {' '}Upload updated rate sheets to avoid benchmark gaps.
            </div>
          )}

          {/* Upload Rate Sheet */}
          <div className="dash-panel" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Import Rate Sheet for {monthLabel}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-500)' }}>
                  Rates uploaded here will be assigned to <strong>{monthLabel}</strong>. Change the month above if needed.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={btnStyle('#6b7280')}
                  onClick={downloadRateTemplate}
                >
                  Download Template
                </button>
                <input ref={rateFileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleRateSheetUpload} />
                <button
                  style={{ ...btnStyle('#3b82f6'), opacity: uploadingRates ? 0.6 : 1 }}
                  disabled={uploadingRates}
                  onClick={() => rateFileInputRef.current?.click()}
                >
                  {uploadingRates ? 'Processing...' : 'Upload Rate Sheet'}
                </button>
              </div>
            </div>

            {/* Upload result */}
            {rateUploadResult && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginTop: 8,
                backgroundColor: rateUploadResult.error ? '#fee2e2' : '#d1fae5',
                border: `1px solid ${rateUploadResult.error ? '#fca5a5' : '#6ee7b7'}`,
              }}>
                {rateUploadResult.error ? (
                  <div>
                    <strong style={{ color: '#dc2626' }}>{rateUploadResult.error}</strong>
                    {rateUploadResult.hint && <p style={{ margin: '4px 0 0', color: '#92400e' }}>{rateUploadResult.hint}</p>}
                    {rateUploadResult.debug && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.8rem' }}>Debug: raw cell data</summary>
                        <div style={{ marginTop: 4, fontSize: '0.72rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', background: '#f9fafb', padding: 8, borderRadius: 6 }}>
                          <div>Sheets: {rateUploadResult.debug.sheets?.join(', ')}</div>
                          {rateUploadResult.debug.sampleRows?.map((row, i) => (
                            <div key={i}>Row {i}: [{row.map(c => `"${c}"`).join(', ')}]</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <div>
                    <strong style={{ color: '#059669' }}>{rateUploadResult.message}</strong>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <span>Extracted: {rateUploadResult.data?.total_extracted}</span>
                      <span>Inserted: {rateUploadResult.data?.inserted}</span>
                      {rateUploadResult.data?.skipped > 0 && <span>Duplicates skipped: {rateUploadResult.data?.skipped}</span>}
                    </div>
                    {rateUploadResult.data?.rates?.length > 0 && (
                      <div style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #6ee7b7', textAlign: 'left' }}>
                              <th style={{ padding: '4px 6px' }}>POL</th>
                              <th style={{ padding: '4px 6px' }}>POD</th>
                              <th style={{ padding: '4px 6px' }}>Rate/kg</th>
                              <th style={{ padding: '4px 6px' }}>20GP</th>
                              <th style={{ padding: '4px 6px' }}>40GP</th>
                              <th style={{ padding: '4px 6px' }}>40HC</th>
                              <th style={{ padding: '4px 6px' }}>Carrier</th>
                              <th style={{ padding: '4px 6px' }}>Mode</th>
                              <th style={{ padding: '4px 6px' }}>Valid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rateUploadResult.data.rates.map((r, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #d1fae5' }}>
                                <td style={{ padding: '3px 6px' }}>{r.port_of_loading}</td>
                                <td style={{ padding: '3px 6px' }}>{r.port_of_discharge}</td>
                                <td style={{ padding: '3px 6px' }}>{r.rate_per_kg_usd ?? '-'}</td>
                                <td style={{ padding: '3px 6px' }}>{r.rate_20gp_usd ?? '-'}</td>
                                <td style={{ padding: '3px 6px' }}>{r.rate_40gp_usd ?? '-'}</td>
                                <td style={{ padding: '3px 6px' }}>{r.rate_40hc_usd ?? '-'}</td>
                                <td style={{ padding: '3px 6px' }}>{r.carrier_name ?? '-'}</td>
                                <td style={{ padding: '3px 6px' }}>{r.transport_mode}</td>
                                <td style={{ padding: '3px 6px' }}>{r.valid_from || '-'} → {r.valid_until || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Benchmark Form */}
          <div className="dash-panel" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>{editingBenchmark ? 'Edit' : 'Add'} Contracted Rate (Manual)</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Port of Loading *</label>
                <input style={inputStyle} value={benchmarkForm.port_of_loading} onChange={e => setBenchmarkForm(f => ({ ...f, port_of_loading: e.target.value }))} placeholder="e.g. Shanghai" />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Port of Discharge *</label>
                <input style={inputStyle} value={benchmarkForm.port_of_discharge} onChange={e => setBenchmarkForm(f => ({ ...f, port_of_discharge: e.target.value }))} placeholder="e.g. Durban" />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={labelStyle}>Rate per kg (USD)</label>
                <input style={inputStyle} type="number" step="0.0001" value={benchmarkForm.rate_per_kg_usd} onChange={e => setBenchmarkForm(f => ({ ...f, rate_per_kg_usd: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>20GP (USD)</label>
                <input style={inputStyle} type="number" step="1" value={benchmarkForm.rate_20gp_usd} onChange={e => setBenchmarkForm(f => ({ ...f, rate_20gp_usd: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>40GP (USD)</label>
                <input style={inputStyle} type="number" step="1" value={benchmarkForm.rate_40gp_usd} onChange={e => setBenchmarkForm(f => ({ ...f, rate_40gp_usd: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>40HC (USD)</label>
                <input style={inputStyle} type="number" step="1" value={benchmarkForm.rate_40hc_usd} onChange={e => setBenchmarkForm(f => ({ ...f, rate_40hc_usd: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={labelStyle}>Carrier</label>
                <input style={inputStyle} value={benchmarkForm.carrier_name} onChange={e => setBenchmarkForm(f => ({ ...f, carrier_name: e.target.value }))} placeholder="Optional" />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>Mode</label>
                <select style={inputStyle} value={benchmarkForm.transport_mode} onChange={e => setBenchmarkForm(f => ({ ...f, transport_mode: e.target.value }))}>
                  <option value="sea">Sea</option>
                  <option value="air">Air</option>
                  <option value="road">Road</option>
                </select>
              </div>
              <div style={{ flex: '1 1 130px' }}>
                <label style={labelStyle}>Valid From</label>
                <input style={inputStyle} type="date" value={benchmarkForm.valid_from} onChange={e => setBenchmarkForm(f => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 130px' }}>
                <label style={labelStyle}>Valid Until</label>
                <input style={inputStyle} type="date" value={benchmarkForm.valid_until} onChange={e => setBenchmarkForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ ...btnStyle('#059669'), opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleBenchmarkSave}>
                {saving ? 'Saving...' : editingBenchmark ? 'Update Rate' : 'Add Rate'}
              </button>
              {editingBenchmark && (
                <button style={btnStyle('#6b7280')} onClick={() => { setEditingBenchmark(null); setBenchmarkForm(emptyBenchmarkForm()); }}>Cancel</button>
              )}
            </div>
          </div>

          {/* Benchmark List */}
          <div className="dash-panel" style={{ overflow: 'hidden' }}>
            {benchmarks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                <button
                  style={{ ...btnStyle('#dc2626'), fontSize: '0.8rem', padding: '6px 14px' }}
                  onClick={handleDeleteAllBenchmarks}
                >
                  Delete All Rates
                </button>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2, #f3f4f6)' }}>
                    {['POL', 'POD', 'Rate/kg', '20GP', '40GP', '40HC', 'Carrier', 'Mode', 'Valid From', 'Valid Until', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border-color, #e5e7eb)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.length === 0 ? (
                    <tr><td colSpan={11} style={{ padding: 30, textAlign: 'center', color: 'var(--text-500)' }}>No rate benchmarks set. Add contracted rates above to enable freight cost comparison.</td></tr>
                  ) : benchmarks.map((bm, idx) => {
                    // [#5] Check if expiring soon
                    const isExpiring = bm.valid_until && (() => {
                      const now = new Date();
                      const exp = new Date(bm.valid_until);
                      return exp >= now && exp <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    })();
                    return (
                      <tr key={bm.id} style={{ backgroundColor: isExpiring ? '#fffbeb' : idx % 2 === 0 ? 'transparent' : 'var(--surface-2, #f9fafb)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{bm.port_of_loading}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{bm.port_of_discharge}</td>
                        <td style={{ padding: '10px 12px' }}>{bm.rate_per_kg_usd ? `$${parseFloat(bm.rate_per_kg_usd).toFixed(4)}` : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{bm.rate_20gp_usd ? `$${parseFloat(bm.rate_20gp_usd).toFixed(0)}` : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{bm.rate_40gp_usd ? `$${parseFloat(bm.rate_40gp_usd).toFixed(0)}` : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{bm.rate_40hc_usd ? `$${parseFloat(bm.rate_40hc_usd).toFixed(0)}` : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{bm.carrier_name || '-'}</td>
                        <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{bm.transport_mode}</td>
                        <td style={{ padding: '10px 12px' }}>{bm.valid_from ? new Date(bm.valid_from).toLocaleDateString() : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {bm.valid_until ? new Date(bm.valid_until).toLocaleDateString() : '-'}
                          {isExpiring && (
                            <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#d97706' }}>
                              EXPIRING
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <button style={{ ...btnStyle('#6b7280'), marginRight: 4, padding: '4px 10px' }} onClick={() => openEditBenchmark(bm)}>Edit</button>
                          <button style={{ ...btnStyle('#dc2626'), padding: '4px 10px' }} onClick={() => handleBenchmarkDelete(bm)}>Del</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Filters + Table — only on audit tab */}
      {activeTab === 'audit' && (
      <div>
      <div className="dash-panel" style={{ padding: '12px 16px', marginBottom: '1rem', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, maxWidth: 280 }}
          placeholder="Search BOL#, supplier, carrier, container..."
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
        {/* [#3] Export */}
        <button style={{ ...btnStyle('#6b7280'), marginLeft: 'auto', fontSize: '0.8rem' }} onClick={() => handleExport('audit')}>
          Export
        </button>
      </div>

      {/* [#2] Bulk action bar */}
      {selectedBols.size > 0 && (
        <div style={{
          padding: '8px 16px', borderRadius: 8, marginBottom: '0.8rem',
          backgroundColor: '#dbeafe', border: '1px solid #93c5fd',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1d4ed8' }}>
            {selectedBols.size} BOL(s) selected
          </span>
          <button style={btnStyle('#059669')} onClick={() => handleBulkAudit('approved')}>Approve All</button>
          <button style={btnStyle('#dc2626')} onClick={() => handleBulkAudit('rejected')}>Reject All</button>
          <button style={btnStyle('#9333ea')} onClick={() => handleBulkAudit('discrepancy')}>Flag All</button>
          <button style={{ ...btnStyle('#6b7280'), marginLeft: 'auto' }} onClick={() => setSelectedBols(new Set())}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="dash-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-2, #f3f4f6)' }}>
                {/* [#2] Checkbox column */}
                <th style={{ padding: '10px 8px', width: 36, textAlign: 'center', borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                  <input type="checkbox" checked={bols.length > 0 && selectedBols.size === bols.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                </th>
                {['BOL #', 'Supplier', 'Carrier', 'Vessel', 'POL', 'POD', 'Issue Date', 'Weight', 'Freight (USD)', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Actions' ? 'center' : 'left', fontWeight: 600, borderBottom: '2px solid var(--border-color, #e5e7eb)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: 'var(--text-500)' }}>Loading...</td></tr>
              ) : bols.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: 'var(--text-500)' }}>No bills of lading found. Click "+ New BOL" to add one.</td></tr>
              ) : bols.map((bol, idx) => (
                <tr key={bol.id} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--surface-2, #f9fafb)', borderBottom: '1px solid var(--border-color, #f0f0f0)' }}>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedBols.has(bol.id)} onChange={() => toggleSelect(bol.id)} style={{ cursor: 'pointer' }} />
                  </td>
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
      </div>
      )}

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
              {renderInput('Benchmark Rate (USD)', 'benchmark_rate_per_kg', 'number', { step: '0.01', placeholder: 'Override auto benchmark' })}
              {renderInput('Declared Value (USD)', 'declared_value_usd', 'number', { step: '0.01' })}
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Container Type</label>
                <select
                  value={formData.container_type}
                  onChange={e => setFormData(f => ({ ...f, container_type: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color, #d1d5db)', fontSize: '0.85rem', backgroundColor: 'var(--surface-1, #fff)' }}
                >
                  <option value="">Select...</option>
                  <option value="20GP">20GP</option>
                  <option value="40GP">40GP</option>
                  <option value="40HC">40HC</option>
                </select>
              </div>
              {renderInput('Container Numbers', 'container_numbers', 'text', { flex: '1 1 calc(100% - 170px)', placeholder: 'Comma-separated: MSKU1234567, TGHU7654321' })}
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
          <div style={{ ...modalBox, maxWidth: 650 }} onClick={e => e.stopPropagation()}>
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

            {/* [#6] Audit History Timeline */}
            {auditHistory.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Audit History</label>
                <div style={{
                  borderLeft: '2px solid var(--border-color, #d1d5db)', paddingLeft: 16,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {auditHistory.map((h, i) => (
                    <div key={i} style={{ position: 'relative', fontSize: '0.82rem' }}>
                      <div style={{
                        position: 'absolute', left: -22, top: 4, width: 10, height: 10,
                        borderRadius: '50%', backgroundColor: h.action === 'audit' ? '#3b82f6' : h.action === 'create' ? '#059669' : h.action === 'import_pdf' ? '#8b5cf6' : '#6b7280',
                      }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-700)' }}>
                        {h.action === 'create' ? 'Created' : h.action === 'audit' ? 'Audited' : h.action === 'update' ? 'Updated' : h.action === 'import_pdf' ? 'PDF Imported' : h.action === 'delete' ? 'Deleted' : h.action}
                      </div>
                      <div style={{ color: 'var(--text-500)' }}>
                        by <strong>{h.username || 'System'}</strong> on {new Date(h.created_at).toLocaleString()}
                      </div>
                      {h.changes && (() => {
                        try {
                          const c = typeof h.changes === 'string' ? JSON.parse(h.changes) : h.changes;
                          if (c.audit_status) return <div style={{ color: 'var(--text-500)' }}>Status: <StatusBadge status={c.audit_status} /></div>;
                          if (c.bulk) return <div style={{ color: 'var(--text-500)' }}>Bulk action: <StatusBadge status={c.audit_status} /></div>;
                        } catch { /* ignore */ }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              {/* [#9] Keyboard shortcut hint */}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>
                Ctrl+Enter to submit
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnStyle('#6b7280')} onClick={() => setShowAuditModal(false)}>Cancel</button>
                <button style={{ ...btnStyle(STATUS_CONFIG[auditForm.audit_status]?.color || '#059669'), opacity: saving ? 0.6 : 1 }}
                  disabled={saving} onClick={handleAuditSubmit}>
                  {saving ? 'Submitting...' : `Submit: ${STATUS_CONFIG[auditForm.audit_status]?.label || 'Audit'}`}
                </button>
              </div>
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
                    Score: {uploadResult.extraction.score}/100 (threshold: {confidenceThreshold}%)
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
                          color: baseScore >= confidenceThreshold ? '#059669' : baseScore >= 50 ? '#d97706' : '#dc2626',
                        }}>{baseScore}/100</span>
                      </div>
                      <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          height: '100%', borderRadius: 4, transition: 'width 0.5s',
                          width: `${baseScore}%`,
                          backgroundColor: baseScore >= confidenceThreshold ? '#059669' : baseScore >= 50 ? '#d97706' : '#dc2626',
                        }} />
                        {/* Threshold marker */}
                        <div style={{
                          position: 'absolute', top: -2, left: `${confidenceThreshold}%`, width: 2, height: 12,
                          backgroundColor: '#374151', borderRadius: 1,
                        }} title={`Auto-approve threshold: ${confidenceThreshold}%`} />
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
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: baseScore >= confidenceThreshold ? '#059669' : baseScore >= 50 ? '#d97706' : '#dc2626' }}>{baseScore}%</td>
                        </tr>
                      </tfoot>
                    </table>
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-400)' }}>
                      Scores above {confidenceThreshold}% are auto-approved. Adjust the threshold in Cost Protection settings.
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
