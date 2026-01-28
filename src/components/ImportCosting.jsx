import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import {
  calculateAllTotals,
  formatCurrency,
  formatNumber,
  CONTAINER_TYPES,
  INCO_TERMS,
  SA_PORTS,
} from '../utils/costingCalculations';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const INITIAL_FORM_STATE = {
  reference_number: '',
  country_of_destination: 'South Africa',
  port_of_discharge: 'CPT',
  shipping_line: '',
  routing: '',
  frequency: '',
  transit_time_days: 30,
  inco_terms: 'CIF',
  inco_term_place: 'CPT',
  container_type: "20' Dry Container",
  quantity: 1,
  hs_code: '',
  gross_weight_kg: '',
  total_gross_weight_kg: '',
  origin_rate_usd: '',
  ocean_freight_rate_usd: '',
  commodity: '',
  customs_value_zar: '',
  supplier_name: '',
  validity_date: '',
  costing_date: new Date().toISOString().split('T')[0],
  payment_terms: '',
  roe_origin: '',
  // Origin Charges
  origin_charge_usd: 0,
  // Destination Charges
  thc_zar: 0,
  gate_door_zar: 0,
  insurance_zar: 0,
  shipping_line_fee_zar: 0,
  port_inland_release_fee_zar: 0,
  cto_zar: 0,
  transport_port_to_warehouse_zar: 0,
  delivery_only_trans_zar: 0,
  unpack_reload_zar: 0,
  // Customs
  customs_duty_zar: 0,
  customs_duty_not_applicable: false,
  // Clearing Charges
  documentation_fee_zar: 0,
  communication_fee_zar: 0,
  edif_fee_zar: 0,
  plant_inspection_zar: 0,
  portbuild_zar: 0,
  agency_zar: 0,
  // Metadata
  notes: '',
  status: 'draft',
};

function ImportCosting() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const [calculatedTotals, setCalculatedTotals] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState(null);

  // Fetch estimates on mount
  useEffect(() => {
    fetchEstimates();
    fetchExchangeRate();
    fetchSuppliers();
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

  const refreshExchangeRate = async () => {
    try {
      setRateLoading(true);
      const response = await authFetch(getApiUrl('/api/costing/exchange-rate/refresh'), {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        setExchangeRate(result.data);
        setFormData(prev => ({ ...prev, roe_origin: result.data.rate }));
      }
    } catch (err) {
      console.error('Failed to refresh exchange rate:', err);
    } finally {
      setRateLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...formData, ...calculatedTotals };

      const url = editingId
        ? getApiUrl(`/api/costing/${editingId}`)
        : getApiUrl('/api/costing');

      const response = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData(INITIAL_FORM_STATE);
        fetchEstimates();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save cost estimate');
      }
    } catch (err) {
      console.error('Failed to save estimate:', err);
      setError('Failed to save cost estimate');
    }
  };

  const handleEdit = (estimate) => {
    setFormData({
      ...INITIAL_FORM_STATE,
      ...estimate,
    });
    setEditingId(estimate.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cost estimate?')) return;

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

  const generatePDF = (estimate) => {
    const doc = new jsPDF();
    const totals = calculateAllTotals(estimate);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(11, 31, 58);
    doc.text('FCL Import Cost Estimate', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Reference: ${estimate.reference_number || 'N/A'}`, 14, 28);
    doc.text(`Date: ${estimate.costing_date || 'N/A'}`, 14, 34);
    doc.text(`Supplier: ${estimate.supplier_name || 'N/A'}`, 14, 40);

    // Shipment Details
    doc.autoTable({
      startY: 48,
      head: [['Shipment Details', '']],
      body: [
        ['Port of Discharge', estimate.port_of_discharge || '-'],
        ['Container Type', estimate.container_type || '-'],
        ['INCO Terms', estimate.inco_terms || '-'],
        ['Transit Time', `${estimate.transit_time_days || '-'} days`],
        ['Gross Weight', `${formatNumber(estimate.total_gross_weight_kg)} kg`],
        ['Exchange Rate (ROE)', formatNumber(estimate.roe_origin, 4)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [11, 31, 58] },
    });

    // Origin Charges
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Origin Charges', 'USD', 'ZAR']],
      body: [
        ['Origin Charge', formatCurrency(estimate.origin_charge_usd, 'USD'), formatCurrency(totals.origin_charge_zar)],
        ['Total Origin', '', formatCurrency(totals.total_origin_charges_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [46, 139, 87] },
    });

    // Destination Charges
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Destination Charges (ZAR)', 'Amount']],
      body: [
        ['THC', formatCurrency(estimate.thc_zar)],
        ['Gate/Door', formatCurrency(estimate.gate_door_zar)],
        ['Insurance', formatCurrency(estimate.insurance_zar)],
        ['Shipping Line Fee', formatCurrency(estimate.shipping_line_fee_zar)],
        ['CTO', formatCurrency(estimate.cto_zar)],
        ['Transport to Warehouse', formatCurrency(estimate.transport_port_to_warehouse_zar)],
        ['Sub-Total', formatCurrency(totals.destination_charges_subtotal_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 167] },
    });

    // Clearing Charges
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Clearing Charges (ZAR)', 'Amount']],
      body: [
        ['Documentation Fee', formatCurrency(estimate.documentation_fee_zar)],
        ['EDIF Fee', formatCurrency(estimate.edif_fee_zar)],
        ['DAVIF (3.25% min R125)', formatCurrency(totals.davif_zar)],
        ['Sub-Total', formatCurrency(totals.clearing_charges_subtotal_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [232, 93, 4] },
    });

    // Totals
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Summary', 'Amount']],
      body: [
        ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
        ['Customs Duty', formatCurrency(totals.customs_disbursements_subtotal_zar)],
        ['Total in Warehouse Cost', formatCurrency(totals.total_in_warehouse_cost_zar)],
        ['Cost per KG', formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [11, 31, 58] },
      bodyStyles: { fontStyle: 'bold' },
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Synercore Import Schedule', 14, doc.internal.pageSize.height - 10);

    doc.save(`cost-estimate-${estimate.reference_number || estimate.id}.pdf`);
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setEditingId(null);
    if (exchangeRate?.rate) {
      setFormData(prev => ({ ...prev, roe_origin: exchangeRate.rate }));
    }
  };

  // Render input field helper
  const renderInput = (label, field, type = 'text', options = {}) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
        {label}
      </label>
      <input
        type={type}
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
        className="input"
        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
        {...options}
      />
    </div>
  );

  // Render select field helper
  const renderSelect = (label, field, options) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
        {label}
      </label>
      <select
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, e.target.value)}
        className="select"
        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // Render currency input
  const renderCurrencyInput = (label, field, currency = 'ZAR') => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
        {label} ({currency})
      </label>
      <input
        type="number"
        value={formData[field] || ''}
        onChange={(e) => handleInputChange(field, parseFloat(e.target.value) || 0)}
        className="input"
        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
        min="0"
        step="0.01"
      />
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading cost estimates...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0b1f3a' }}>Import Costing</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            FCL Import Cost Comparison
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {exchangeRate && (
            <div style={{ padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '0.85rem' }}>
              <span style={{ color: '#666' }}>USD/ZAR: </span>
              <strong>{formatNumber(exchangeRate.rate, 4)}</strong>
              {exchangeRate.isStale && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>(stale)</span>}
              <button
                onClick={refreshExchangeRate}
                disabled={rateLoading}
                style={{
                  marginLeft: '8px', padding: '2px 8px', fontSize: '0.75rem',
                  backgroundColor: '#0ea5a8', color: 'white', border: 'none',
                  borderRadius: '4px', cursor: 'pointer'
                }}
              >
                {rateLoading ? '...' : 'Refresh'}
              </button>
            </div>
          )}
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{
              padding: '10px 20px', backgroundColor: '#0ea5a8', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
            }}
          >
            + New Estimate
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'flex-start', padding: '2rem', zIndex: 1000, overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '1000px',
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Form Header */}
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10
            }}>
              <h3 style={{ margin: 0, color: '#0b1f3a' }}>
                {editingId ? 'Edit Cost Estimate' : 'New Cost Estimate'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}
              >
                x
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              {/* Section: Header Details */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#0b1f3a', fontSize: '1rem' }}>Shipment Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderInput('Reference Number', 'reference_number')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Supplier
                    </label>
                    <select
                      value={formData.supplier_name || ''}
                      onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                      className="select"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      <option value="">Select Supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {renderSelect('Port of Discharge', 'port_of_discharge', SA_PORTS)}
                  {renderSelect('Container Type', 'container_type', CONTAINER_TYPES)}
                  {renderSelect('INCO Terms', 'inco_terms', INCO_TERMS)}
                  {renderInput('INCO Term Place', 'inco_term_place')}
                  {renderInput('Transit Time (days)', 'transit_time_days', 'number')}
                  {renderInput('Shipping Line', 'shipping_line')}
                  {renderInput('Quantity', 'quantity', 'number')}
                  {renderInput('HS Code', 'hs_code')}
                  {renderInput('Commodity', 'commodity')}
                  {renderInput('Gross Weight (kg)', 'gross_weight_kg', 'number')}
                  {renderInput('Total Gross Weight (kg)', 'total_gross_weight_kg', 'number')}
                  {renderInput('Costing Date', 'costing_date', 'date')}
                  {renderInput('Validity Date', 'validity_date', 'date')}
                  {renderInput('Payment Terms', 'payment_terms')}
                </div>
              </div>

              {/* Section: Exchange Rate & Customs Value */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#065f46', fontSize: '1rem' }}>Exchange Rate & Values</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      ROE Origin (USD/ZAR)
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="number"
                        value={formData.roe_origin || ''}
                        onChange={(e) => handleInputChange('roe_origin', parseFloat(e.target.value) || '')}
                        className="input"
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
                        step="0.0001"
                      />
                      <button
                        type="button"
                        onClick={() => exchangeRate?.rate && handleInputChange('roe_origin', exchangeRate.rate)}
                        style={{
                          padding: '8px 12px', backgroundColor: '#10b981', color: 'white',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem'
                        }}
                        title="Use current rate"
                      >
                        Current
                      </button>
                    </div>
                  </div>
                  {renderCurrencyInput('Origin Rate', 'origin_rate_usd', 'USD')}
                  {renderCurrencyInput('Ocean Freight Rate', 'ocean_freight_rate_usd', 'USD')}
                  {renderCurrencyInput('Customs Value', 'customs_value_zar', 'ZAR')}
                </div>
              </div>

              {/* Section: Origin Charges */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Origin Charges (USD)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Origin Charge', 'origin_charge_usd', 'USD')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Origin Charge (ZAR) - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#e5e7eb', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency(calculatedTotals.origin_charge_zar)}
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Total Origin Charges - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency(calculatedTotals.total_origin_charges_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Destination Charges */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#1e40af', fontSize: '1rem' }}>Destination Charges (ZAR)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('THC', 'thc_zar')}
                  {renderCurrencyInput('Gate/Door', 'gate_door_zar')}
                  {renderCurrencyInput('Insurance', 'insurance_zar')}
                  {renderCurrencyInput('Shipping Line Fee', 'shipping_line_fee_zar')}
                  {renderCurrencyInput('Port/Inland Release', 'port_inland_release_fee_zar')}
                  {renderCurrencyInput('CTO', 'cto_zar')}
                  {renderCurrencyInput('Transport to Warehouse', 'transport_port_to_warehouse_zar')}
                  {renderCurrencyInput('Delivery Only', 'delivery_only_trans_zar')}
                  {renderCurrencyInput('Unpack & Reload', 'unpack_reload_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1e40af' }}>
                      {formatCurrency(calculatedTotals.destination_charges_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Customs Disbursements */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#92400e', fontSize: '1rem' }}>Customs Disbursements</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Customs Duty', 'customs_duty_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      <input
                        type="checkbox"
                        checked={formData.customs_duty_not_applicable || false}
                        onChange={(e) => handleInputChange('customs_duty_not_applicable', e.target.checked)}
                      />
                      Not Applicable (Essentials)
                    </label>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#92400e' }}>
                      {formatCurrency(calculatedTotals.customs_disbursements_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Clearing Charges */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#c2410c', fontSize: '1rem' }}>Clearing Charges (ZAR)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Documentation Fee', 'documentation_fee_zar')}
                  {renderCurrencyInput('Communication Fee', 'communication_fee_zar')}
                  {renderCurrencyInput('EDIF Fee', 'edif_fee_zar')}
                  {renderCurrencyInput('Plant Inspection', 'plant_inspection_zar')}
                  {renderCurrencyInput('Portbuild', 'portbuild_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      DAVIF (3.25% min R125) - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fed7aa', borderRadius: '6px', fontWeight: '600', color: '#c2410c' }}>
                      {formatCurrency(calculatedTotals.davif_zar)}
                    </div>
                  </div>
                  {renderCurrencyInput('Agency', 'agency_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#ffedd5', borderRadius: '6px', fontWeight: '600', color: '#c2410c' }}>
                      {formatCurrency(calculatedTotals.clearing_charges_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Totals Summary */}
              <div style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#0b1f3a', borderRadius: '8px', color: 'white' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Summary Totals</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Total Shipping Cost</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(calculatedTotals.total_shipping_cost_zar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Total in Warehouse Cost</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{formatCurrency(calculatedTotals.total_in_warehouse_cost_zar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Cost per KG</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>{formatCurrency(calculatedTotals.all_in_warehouse_cost_per_kg_zar)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Status</div>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', width: '100%' }}
                    >
                      <option value="draft">Draft</option>
                      <option value="final">Final</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', minHeight: '80px' }}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  style={{
                    padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#374151',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px', backgroundColor: '#0ea5a8', color: 'white',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                  }}
                >
                  {editingId ? 'Update Estimate' : 'Create Estimate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estimates Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Reference</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Supplier</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Port</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Container</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Total Cost</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Cost/KG</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                    No cost estimates yet. Create your first estimate to get started.
                  </td>
                </tr>
              ) : (
                estimates.map((est) => {
                  const totals = calculateAllTotals(est);
                  return (
                    <tr key={est.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', color: '#111827' }}>{est.reference_number || est.id.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{est.supplier_name || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{est.port_of_discharge || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{est.container_type || '-'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                        {formatCurrency(totals.total_in_warehouse_cost_zar)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500', color: '#d97706' }}>
                        {formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500',
                          backgroundColor: est.status === 'final' ? '#dcfce7' : est.status === 'archived' ? '#f3f4f6' : '#fef3c7',
                          color: est.status === 'final' ? '#166534' : est.status === 'archived' ? '#6b7280' : '#92400e'
                        }}>
                          {est.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEdit(est)}
                            style={{ padding: '6px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => generatePDF(est)}
                            style={{ padding: '6px 10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleDuplicate(est.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleDelete(est.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ImportCosting;
