import React, { useState, useEffect } from 'react';
import useFormDraft from '../hooks/useFormDraft';
import { getApiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { authUtils } from '../utils/auth';
import {
  calculateAllTotals,
  formatNumber,
  lookupOceanFreightRate,
} from '../utils/costingCalculations';
import { generateEstimatePDF, generateEstimatePDFBase64 } from '../utils/costingPdf';
import { useNotification } from '../contexts/NotificationContext';
import CostingReportsPanel from './CostingReportsPanel';
import CostingEstimatesTable from './CostingEstimatesTable';
import CostingFormSections from './CostingFormSections';
import { EmailEstimateModal, RequestCostingModal } from './CostingModals';

const INITIAL_FORM_STATE = {
  transport_mode: 'sea', // 'sea' or 'air'
  reference_number: '',
  // Origin details
  country_of_origin: '',
  port_of_loading: '',
  // Destination details
  country_of_destination: 'South Africa',
  port_of_discharge: 'CPT',
  load_type: 'FCL',
  shipping_line: '',
  routing: '',
  frequency: '',
  transit_time_days: 30,
  inco_terms: 'CIF',
  inco_term_place: 'CPT',
  container_type: "20' Dry Container",
  quantity: 1,
  supplier_name: '',
  validity_date: '',
  costing_date: new Date().toISOString().split('T')[0],
  payment_terms: '',
  roe_origin: '',  // USD/ZAR
  roe_eur: '',     // EUR/ZAR
  // Ocean Freight
  ocean_freight_usd: 0,
  ocean_freight_eur: 0,
  // Origin Charges
  origin_charge_usd: 0,
  origin_charge_eur: 0,
  // Local Charges (Transport/Cartage) - Default rates from AFI rate sheet
  local_cartage_cpt_klapmuts_20ton_zar: 6970,
  local_cartage_cpt_klapmuts_28ton_zar: 7500,
  transport_dbn_to_pretoria_20ft_zar: 16640,
  transport_dbn_to_pretoria_40ft_zar: 20380,
  transport_dbn_to_whs_zar: 5350,
  unpack_reload_zar: 5430,
  storage_zar: 15,
  storage_days: 0,
  outlying_depot_surcharge_zar: 964,
  local_cartage_dbn_whs_pretoria_opt_a_zar: 17000,
  local_cartage_dbn_whs_pretoria_opt_b_zar: 19260,
  local_cartage_dbn_whs_pretoria_6m_zar: 10370,
  local_cartage_dbn_whs_pretoria_12m_zar: 14330,
  transport_pe_coega_to_pretoria_zar: 0,
  // Destination Charges (Port/Shipping) - Default rates from AFI rate sheet
  shipping_line_charges_zar: 0,
  cargo_dues_20ft_zar: 1879.72,
  cargo_dues_40ft_zar: 3759.42,
  cto_fee_zar: 360,
  port_health_inspection_zar: 620,
  daff_inspection_zar: 620,
  state_vet_cancellation_fee_zar: 290,
  jnb_turn_in_zar: 0,
  // Products - each product in the container
  products: [
    { _id: Date.now(), name: '', hs_code: '', pack_size: '', pack_type: '', weight_kg: 0, rate_per_kg: 0, duty_percent: 0, duty_schedule1_percent: 0, currency: 'USD', invoice_value: 0 }
  ],
  // Customs & Duties
  roe_customs: '',  // ROE for customs calculation
  customs_declaration_zar: 590,
  agency_fee_percentage: 3.5,
  agency_fee_min: 1187,
  // Airfreight fields
  airline_name: '',
  flight_number: '',
  airport_of_departure: '',
  airport_of_arrival: '',
  actual_weight_kg: 0,
  dimensions_length_cm: 0,
  dimensions_width_cm: 0,
  dimensions_height_cm: 0,
  number_of_pieces: 1,
  volumetric_divisor: 6000,
  airfreight_rate_per_kg: 0,
  airfreight_origin_charges_usd: 0,
  fuel_surcharge_per_kg: 0,
  security_surcharge_per_kg: 0,
  screening_fee_zar: 0,
  awb_fee_zar: 0,
  airline_handling_fee_zar: 0,
  airport_transfer_fee_zar: 0,
  cartage_airport_to_whs_zar: 0,
  airfreight_insurance_percent: 0,
  // Metadata
  notes: '',
  status: 'draft',
};

function ImportCosting() {
  const { showSuccess, showError, confirm: confirmAction } = useNotification();
  const currentUser = authUtils.getUser();
  const isAdmin = currentUser?.role === 'admin';
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formExpanded, setFormExpanded] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const { clearDraft: clearCostingDraft, confirmClose: confirmCloseCosting } = useFormDraft(
    `costing_${editingId || 'new'}`, formData, setFormData, { enabled: showForm }
  );
  const [calculatedTotals, setCalculatedTotals] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  const [_rateLoading, setRateLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailEstimate, setEmailEstimate] = useState(null);
  const [showReports, setShowReports] = useState(false);

  // Costing request state (for non-admin users)
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  // Warn before leaving with unsaved form data
  useEffect(() => {
    if (!showForm) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [showForm]);

  // Fetch estimates on mount
  useEffect(() => {
    fetchEstimates();
    fetchExchangeRate();
    fetchSuppliers();
    if (!isAdmin) fetchMyRequests();
  }, []);

  // Recalculate totals when form data changes
  useEffect(() => {
    const totals = calculateAllTotals(formData);
    setCalculatedTotals(totals);
  }, [formData]);

  const fetchEstimates = async () => {
    try {
      setLoading(true);
      const response = await authFetch(getApiUrl('/api/costing'));
      if (response.ok) {
        const result = await response.json();
        setEstimates(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch estimates:', err);
      setError('Failed to load cost estimates');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const response = await authFetch(getApiUrl('/api/costing-requests'));
      if (response.ok) {
        const result = await response.json();
        setMyRequests(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch costing requests:', err);
    }
  };

  const handleSubmitRequest = async (formData) => {
    try {
      const response = await authFetch(getApiUrl('/api/costing-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setShowRequestModal(false);
        fetchMyRequests();
      } else {
        setError('Failed to submit costing request');
      }
    } catch (err) {
      console.error('Failed to submit costing request:', err);
      setError('Failed to submit costing request');
    }
  };

  const fetchExchangeRate = async () => {
    try {
      setRateLoading(true);
      const response = await authFetch(getApiUrl('/api/costing/exchange-rate/current'));
      if (response.ok) {
        const result = await response.json();
        setExchangeRate(result.data);
        if (result.data?.rate && !formData.roe_origin) {
          setFormData(prev => ({ ...prev, roe_origin: result.data.rate }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
    } finally {
      setRateLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await authFetch(getApiUrl('/api/suppliers'));
      if (response.ok) {
        const result = await response.json();
        setSuppliers(result.data || result || []);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  const createSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const response = await authFetch(getApiUrl('/api/suppliers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSupplierName.trim() }),
      });
      if (response.ok) {
        const result = await response.json();
        const newSupplier = result.data || result;
        // Add to suppliers list and select it
        setSuppliers(prev => [...prev, newSupplier]);
        setFormData(prev => ({ ...prev, supplier_name: newSupplier.name }));
        setShowAddSupplier(false);
        setNewSupplierName('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create supplier');
      }
    } catch (err) {
      console.error('Failed to create supplier:', err);
      setError('Failed to create supplier');
    }
  };



  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-fill ocean freight when port, shipping line, or container type changes
      if (field === 'port_of_loading' || field === 'shipping_line' || field === 'container_type') {
        const rate = lookupOceanFreightRate(
          field === 'port_of_loading' ? value : updated.port_of_loading,
          field === 'shipping_line' ? value : updated.shipping_line,
          field === 'container_type' ? value : updated.container_type
        );
        if (rate !== null) {
          updated.ocean_freight_usd = rate;
        }
      }
      return updated;
    });
  };

  // Product helpers
  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [
        ...prev.products,
        { _id: Date.now() + Math.random(), name: '', hs_code: '', pack_size: '', pack_type: '', weight_kg: 0, rate_per_kg: 0, duty_percent: 0, duty_schedule1_percent: 0, currency: 'USD', invoice_value: 0 }
      ]
    }));
  };

  const removeProduct = (index) => {
    setFormData(prev => {
      const newProducts = prev.products.filter((_, i) => i !== index);
      return {
        ...prev,
        products: newProducts,
      };
    });
  };

  const updateProduct = (index, field, value) => {
    setFormData(prev => {
      const newProducts = prev.products.map((item, i) => {
        if (i !== index) return item;

        const updatedItem = { ...item, [field]: value };

        // Auto-calculate invoice_value when weight or rate_per_kg changes
        if (field === 'weight_kg' || field === 'rate_per_kg') {
          const weight = field === 'weight_kg' ? (parseFloat(value) || 0) : (parseFloat(item.weight_kg) || 0);
          const rate = field === 'rate_per_kg' ? (parseFloat(value) || 0) : (parseFloat(item.rate_per_kg) || 0);
          updatedItem.invoice_value = Math.round(weight * rate * 100) / 100;
        }

        return updatedItem;
      });

      return {
        ...prev,
        products: newProducts,
      };
    });
  };

  // Calculate total weight from all products
  const getTotalWeight = () => {
    return (formData.products || []).reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
  };

  // Calculate product customs values
  const calculateProductCustomsValues = (product) => {
    const roeCustoms = parseFloat(formData.roe_customs) || parseFloat(formData.roe_origin) || 0;
    const roeEur = parseFloat(formData.roe_eur) || roeCustoms;
    const invoiceValue = parseFloat(product.invoice_value) || 0;
    const dutyPercent = parseFloat(product.duty_percent) || 0;
    const dutySchedule1Percent = parseFloat(product.duty_schedule1_percent) || 0;
    const currency = product.currency || 'USD';

    // Convert to ZAR based on currency
    let roe = roeCustoms;
    if (currency === 'EUR') roe = roeEur;
    if (currency === 'ZAR') roe = 1;

    const customsValue = invoiceValue * roe;
    const totalDuties = customsValue * (dutyPercent / 100);
    const schedule1Duty = customsValue * (dutySchedule1Percent / 100);
    const totalVat = (customsValue + totalDuties + schedule1Duty) * 0.15;

    return { customsValue, totalDuties, schedule1Duty, totalVat, roe };
  };

  // Calculate product cost allocation (shipping costs allocated by weight)
  const calculateProductAllocation = (product) => {
    const totalWeight = getTotalWeight();
    const productWeight = parseFloat(product.weight_kg) || 0;
    const weightRatio = totalWeight > 0 ? productWeight / totalWeight : 0;

    // For CIF/CIP/CFR terms, ocean freight and origin charges are already in
    // the product price — only allocate local + destination charges
    const incoTerms = (formData.inco_terms || '').toUpperCase();
    const freightIncluded = ['CIF', 'CIP', 'CFR'].includes(incoTerms);
    let shippingToAllocate;
    if (freightIncluded) {
      shippingToAllocate = (calculatedTotals.local_charges_subtotal_zar || 0)
        + (calculatedTotals.destination_charges_subtotal_zar || 0);
    } else {
      shippingToAllocate = calculatedTotals.total_shipping_cost_zar || 0;
    }
    const allocatedShippingCost = shippingToAllocate * weightRatio;

    // Get customs values for this product
    const customs = calculateProductCustomsValues(product);
    // VAT excluded - not charged to clients
    const productCustomsCost = customs.totalDuties + customs.schedule1Duty;

    // Total landed cost = product value (customs value) + duties + allocated shipping
    const totalProductCost = customs.customsValue + productCustomsCost + allocatedShippingCost;
    const costPerKg = productWeight > 0 ? totalProductCost / productWeight : 0;

    return { weightRatio, allocatedShippingCost, productCustomsCost, totalProductCost, costPerKg };
  };

  // Calculate customs totals from all products
  const getCustomsTotals = () => {
    let totalCustomsValue = 0;
    let totalDuties = 0;
    let totalSchedule1Duty = 0;
    let totalVat = 0;

    (formData.products || []).forEach(product => {
      const values = calculateProductCustomsValues(product);
      totalCustomsValue += values.customsValue;
      totalDuties += values.totalDuties;
      totalSchedule1Duty += values.schedule1Duty;
      totalVat += values.totalVat;
    });

    return { totalCustomsValue, totalDuties, totalSchedule1Duty, totalVat };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Clean data - convert empty strings to null for numeric fields
      const cleanedData = { ...formData };
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === '') {
          cleanedData[key] = null;
        }
      });
      // Filter out display-only fields (prefixed with underscore)
      const dbTotals = {};
      Object.keys(calculatedTotals).forEach(key => {
        if (!key.startsWith('_')) {
          dbTotals[key] = calculatedTotals[key];
        }
      });
      const dataToSend = { ...cleanedData, ...dbTotals };
      const url = editingId
        ? getApiUrl(`/api/costing/${editingId}`)
        : getApiUrl('/api/costing');

      const response = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        clearCostingDraft();
        setShowForm(false);
        setEditingId(null);
        setFormData(INITIAL_FORM_STATE);
        fetchEstimates();
      } else {
        const errorData = await response.json();
        console.error('Save error details:', errorData);
        let detailMsg = '';
        if (Array.isArray(errorData.details)) {
          detailMsg = errorData.details.map(d => `${d.path || d.param}: ${d.msg || d.message}`).join(', ');
        } else if (typeof errorData.details === 'string') {
          detailMsg = errorData.details;
        }
        setError(detailMsg || errorData.error || errorData.message || 'Failed to save cost estimate');
      }
    } catch (err) {
      console.error('Failed to save estimate:', err);
      setError('Failed to save cost estimate');
    }
  };

  const handleEdit = (estimate) => {
    const fixed = { ...estimate };
    // Fix historical bug: origin charges were auto-populated with invoice totals
    const products = fixed.products || [];
    const invoiceTotalUsd = products.reduce((sum, p) => sum + ((!p.currency || p.currency === 'USD') ? (parseFloat(p.invoice_value) || 0) : 0), 0);
    const invoiceTotalEur = products.reduce((sum, p) => sum + ((p.currency === 'EUR') ? (parseFloat(p.invoice_value) || 0) : 0), 0);
    if (invoiceTotalUsd > 0 && Math.abs((parseFloat(fixed.origin_charge_usd) || 0) - invoiceTotalUsd) < 0.01) {
      fixed.origin_charge_usd = 0;
    }
    if (invoiceTotalEur > 0 && Math.abs((parseFloat(fixed.origin_charge_eur) || 0) - invoiceTotalEur) < 0.01) {
      fixed.origin_charge_eur = 0;
    }
    setFormData({
      ...INITIAL_FORM_STATE,
      ...fixed,
    });
    setEditingId(estimate.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction({ title: 'Delete Cost Estimate', message: 'Are you sure you want to delete this cost estimate?', type: 'danger', confirmText: 'Delete' }))) return;

    try {
      const response = await authFetch(getApiUrl(`/api/costing/${id}`), {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchEstimates();
      }
    } catch (err) {
      console.error('Failed to delete estimate:', err);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/costing/${id}/duplicate`), {
        method: 'POST',
      });
      if (response.ok) {
        fetchEstimates();
      }
    } catch (err) {
      console.error('Failed to duplicate estimate:', err);
    }
  };

  const generatePDF = (estimate) => generateEstimatePDF(estimate);

  const generatePDFBase64 = (estimate) => generateEstimatePDFBase64(estimate);

  // Send email with PDF attachment
  const sendEstimateEmail = async (emailTo, estimate) => {
    if (!emailTo || !estimate) return;

    try {
      const pdfBase64 = generatePDFBase64(estimate);

      const response = await authFetch(getApiUrl(`/api/costing/${estimate.id}/send-email`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: emailTo,
          pdfBase64: pdfBase64,
        }),
      });

      if (response.ok) {
        showSuccess('Email sent successfully!');
        setShowEmailModal(false);
        setEmailEstimate(null);
      } else {
        const data = await response.json();
        showError(`Failed to send email: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error sending email:', err);
      showError('Failed to send email. Please try again.');
    }
  };

  const resetForm = () => {
    clearCostingDraft();
    setFormData(INITIAL_FORM_STATE);
    setEditingId(null);
    if (exchangeRate?.rate) {
      setFormData(prev => ({ ...prev, roe_origin: exchangeRate.rate }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading cost estimates...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div className="brand-strip" />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="page-header">
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Import Costing</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-500)', fontSize: '0.8rem' }}>
            Sea & Air Freight Import Cost Comparison
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {exchangeRate && (
            <div style={{ padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-500)' }}>Market Rate: </span>
              <strong>{formatNumber(exchangeRate.rate, 4)}</strong>
              <span style={{ color: '#888', marginLeft: '4px', fontSize: '0.75rem' }}>(ref only - use Finex SA)</span>
            </div>
          )}
          <button
            onClick={() => setShowReports(!showReports)}
            style={{
              padding: '10px 20px', backgroundColor: showReports ? '#7c3aed' : '#8b5cf6', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
            }}
          >
            {showReports ? '✕ Close Reports' : '📊 Reports'}
          </button>
          {isAdmin ? (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{
                padding: '10px 20px', backgroundColor: '#059669', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
              }}
            >
              + New Estimate
            </button>
          ) : (
            <button
              onClick={() => setShowRequestModal(true)}
              style={{
                padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
              }}
            >
              Request Costing
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {/* Pending Requests Banner (non-admin) */}
      {!isAdmin && myRequests.filter(r => r.status === 'pending').length > 0 && (
        <div style={{ padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', color: '#92400e' }}>
          You have <strong>{myRequests.filter(r => r.status === 'pending').length}</strong> pending costing request(s). An admin will prepare them for you.
        </div>
      )}

      {/* Reports Section */}
      {showReports && (
        <CostingReportsPanel estimates={estimates} onClose={() => setShowReports(false)} />
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: formExpanded ? 'stretch' : 'flex-start',
          padding: formExpanded ? 0 : '1rem', zIndex: 1000, overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: formExpanded ? 0 : '12px',
            width: formExpanded ? '100vw' : '95%',
            maxWidth: formExpanded ? '100vw' : '1400px',
            minWidth: formExpanded ? '100vw' : '600px',
            height: formExpanded ? '100vh' : '90vh',
            minHeight: '400px',
            overflow: 'auto',
            boxShadow: formExpanded ? 'none' : '0 25px 50px -12px rgba(0,0,0,0.25)',
            resize: formExpanded ? 'none' : 'both',
            transition: 'all 0.2s ease',
          }}>
            {/* Form Header */}
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ margin: 0, color: '#0f172a' }}>
                  {editingId ? 'Edit Cost Estimate' : 'New Cost Estimate'}
                </h3>
                <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
                  <button
                    type="button"
                    onClick={() => handleInputChange('transport_mode', 'sea')}
                    style={{
                      padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
                      backgroundColor: formData.transport_mode === 'sea' ? '#1d4ed8' : '#f3f4f6',
                      color: formData.transport_mode === 'sea' ? 'white' : '#6b7280',
                    }}
                  >
                    Sea Freight
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('transport_mode', 'air')}
                    style={{
                      padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
                      backgroundColor: formData.transport_mode === 'air' ? '#7c3aed' : '#f3f4f6',
                      color: formData.transport_mode === 'air' ? 'white' : '#6b7280',
                    }}
                  >
                    Air Freight
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setFormExpanded(!formExpanded)}
                  title={formExpanded ? 'Collapse form' : 'Expand form'}
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-700)', fontWeight: 500 }}
                >
                  {formExpanded ? '⊖ Collapse' : '⊕ Expand'}
                </button>
                <button
                  onClick={() => confirmCloseCosting(() => { setShowForm(false); setEditingId(null); setFormExpanded(false); })}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-500)' }}
                >
                  x
                </button>
              </div>
            </div>

            <CostingFormSections
              formData={formData}
              calculatedTotals={calculatedTotals}
              editingId={editingId}
              suppliers={suppliers}
              exchangeRate={exchangeRate}
              onInputChange={handleInputChange}
              onAddProduct={addProduct}
              onRemoveProduct={removeProduct}
              onUpdateProduct={updateProduct}
              onSubmit={handleSubmit}
              onCancel={() => confirmCloseCosting(() => { setShowForm(false); setEditingId(null); })}
              showAddSupplier={showAddSupplier}
              onToggleAddSupplier={setShowAddSupplier}
              newSupplierName={newSupplierName}
              onNewSupplierNameChange={setNewSupplierName}
              onCreateSupplier={createSupplier}
              getTotalWeight={getTotalWeight}
              getCustomsTotals={getCustomsTotals}
              calculateProductCustomsValues={calculateProductCustomsValues}
              calculateProductAllocation={calculateProductAllocation}
            />
          </div>
        </div>
      )}

      {/* Estimates Table */}
      <CostingEstimatesTable
        estimates={estimates}
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onGeneratePDF={generatePDF}
        onEmailEstimate={(est) => { setEmailEstimate(est); setShowEmailModal(true); }}
      />

      {/* Email Modal */}
      <EmailEstimateModal
        isOpen={showEmailModal}
        estimate={emailEstimate}
        onClose={() => { setShowEmailModal(false); setEmailEstimate(null); }}
        onSend={sendEstimateEmail}
      />

      {/* Request Costing Modal (non-admin) */}
      <RequestCostingModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSubmit={handleSubmitRequest}
      />
    </div>
  );
}

export default ImportCosting;
