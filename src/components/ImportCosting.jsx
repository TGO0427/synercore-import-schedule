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

// Payment terms options
const PAYMENT_TERMS = [
  { value: 'CIA', label: 'CIA - Cash in Advance' },
  { value: 'COD', label: 'COD - Cash on Delivery' },
  { value: 'Net 7', label: 'Net 7 Days' },
  { value: 'Net 14', label: 'Net 14 Days' },
  { value: 'Net 30', label: 'Net 30 Days' },
  { value: 'Net 45', label: 'Net 45 Days' },
  { value: 'Net 60', label: 'Net 60 Days' },
  { value: 'Net 90', label: 'Net 90 Days' },
  { value: '2/10 Net 30', label: '2/10 Net 30 - 2% discount if paid in 10 days' },
  { value: 'LC at Sight', label: 'LC at Sight - Letter of Credit' },
  { value: 'LC 30 Days', label: 'LC 30 Days - Letter of Credit' },
  { value: 'LC 60 Days', label: 'LC 60 Days - Letter of Credit' },
  { value: 'LC 90 Days', label: 'LC 90 Days - Letter of Credit' },
  { value: 'DA 30', label: 'DA 30 - Documents Against Acceptance' },
  { value: 'DA 60', label: 'DA 60 - Documents Against Acceptance' },
  { value: 'DA 90', label: 'DA 90 - Documents Against Acceptance' },
  { value: 'DP', label: 'DP - Documents Against Payment' },
  { value: 'TT in Advance', label: 'TT in Advance - Telegraphic Transfer' },
  { value: 'TT after Delivery', label: 'TT after Delivery' },
];

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
  invoice_value_usd: '',  // Invoice/FOB value in USD
  invoice_value_eur: '',  // Invoice/FOB value in EUR
  supplier_name: '',
  validity_date: '',
  costing_date: new Date().toISOString().split('T')[0],
  payment_terms: '',
  roe_origin: '',  // USD/ZAR
  roe_eur: '',     // EUR/ZAR
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
  // Customs & Duties - Default rates from AFI rate sheet
  duties_zar: 0,
  customs_vat_zar: 0,
  customs_declaration_zar: 590,
  agency_fee_zar: 0,
  agency_fee_percentage: 3.5,
  agency_fee_min: 1187,
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
        ['USD/ZAR Rate', formatNumber(estimate.roe_origin, 4)],
        ['EUR/ZAR Rate', formatNumber(estimate.roe_eur, 4)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [11, 31, 58] },
    });

    // Origin Charges
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Origin Charges', 'Amount', 'ZAR']],
      body: [
        ['Origin Charge (USD)', formatCurrency(estimate.origin_charge_usd, 'USD'), formatCurrency(totals.origin_charge_usd_zar)],
        ['Origin Charge (EUR)', formatCurrency(estimate.origin_charge_eur, 'EUR'), formatCurrency(totals.origin_charge_eur_zar)],
        ['Total Origin Charges', '', formatCurrency(totals.total_origin_charges_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [46, 139, 87] },
    });

    // Local Charges
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Local Charges (Transport/Cartage)', 'ZAR']],
      body: [
        ['Local Cartage: CPT to Klapmuts (<20 Ton)', formatCurrency(estimate.local_cartage_cpt_klapmuts_20ton_zar)],
        ['Local Cartage: CPT to Klapmuts (21-28 Ton)', formatCurrency(estimate.local_cartage_cpt_klapmuts_28ton_zar)],
        ['Transport: DBN Port to Pretoria (20FT)', formatCurrency(estimate.transport_dbn_to_pretoria_20ft_zar)],
        ['Transport: DBN Port to Pretoria (40FT)', formatCurrency(estimate.transport_dbn_to_pretoria_40ft_zar)],
        ['Transport: DBN Port to WHS', formatCurrency(estimate.transport_dbn_to_whs_zar)],
        ['Unpack / Reload', formatCurrency(estimate.unpack_reload_zar)],
        ['Storage', formatCurrency(estimate.storage_zar)],
        ['Outlying Container Depot Surcharge', formatCurrency(estimate.outlying_depot_surcharge_zar)],
        ['Local Cartage: DBN WHS to PTA (Tautliner A)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_opt_a_zar)],
        ['Local Cartage: DBN WHS to PTA (Tautliner B)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_opt_b_zar)],
        ['Local Cartage: DBN WHS to PTA (6M Deck)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_6m_zar)],
        ['Local Cartage: DBN WHS to PTA (12M Deck)', formatCurrency(estimate.local_cartage_dbn_whs_pretoria_12m_zar)],
        ['Transport: PE/Coega Port to Pretoria', formatCurrency(estimate.transport_pe_coega_to_pretoria_zar)],
        ['Sub-Total', formatCurrency(totals.local_charges_subtotal_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
    });

    // Destination Charges
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Destination Charges', 'ZAR']],
      body: [
        ['Shipping Line Charges (At Cost)', formatCurrency(estimate.shipping_line_charges_zar)],
        ['Cargo Dues (20FT)', formatCurrency(estimate.cargo_dues_20ft_zar)],
        ['Cargo Dues (40FT)', formatCurrency(estimate.cargo_dues_40ft_zar)],
        ['CTO Fee', formatCurrency(estimate.cto_fee_zar)],
        ['Port Health Inspection', formatCurrency(estimate.port_health_inspection_zar)],
        ['DAFF Inspection', formatCurrency(estimate.daff_inspection_zar)],
        ['State Vet Cancellation Fee', formatCurrency(estimate.state_vet_cancellation_fee_zar)],
        ['JNB Turn In (At Cost)', formatCurrency(estimate.jnb_turn_in_zar)],
        ['Sub-Total', formatCurrency(totals.destination_charges_subtotal_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 167] },
    });

    // Customs & Duties
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Customs & Duties', 'ZAR']],
      body: [
        ['Customs Value', formatCurrency(totals.customs_value_zar)],
        ['Duties', formatCurrency(estimate.duties_zar)],
        ['Customs VAT', formatCurrency(estimate.customs_vat_zar)],
        ['Customs Declaration', formatCurrency(estimate.customs_declaration_zar)],
        ['Agency Fee (3.5% min R1187)', formatCurrency(totals.agency_fee_zar)],
        ['Sub-Total', formatCurrency(totals.customs_subtotal_zar)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [146, 64, 14] },
    });

    // Totals
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Summary', 'Amount']],
      body: [
        ['Total Shipping Cost', formatCurrency(totals.total_shipping_cost_zar)],
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
              <span style={{ color: '#666' }}>Market Rate: </span>
              <strong>{formatNumber(exchangeRate.rate, 4)}</strong>
              <span style={{ color: '#888', marginLeft: '4px', fontSize: '0.75rem' }}>(ref only - use Finex SA)</span>
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
                  {renderSelect('Payment Terms', 'payment_terms', PAYMENT_TERMS)}
                </div>
              </div>

              {/* Section: Exchange Rate & Customs Value */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#065f46', fontSize: '1rem' }}>Finex SA Exchange Rates</h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#666' }}>Enter the Finex SA rates from your daily email</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
                      USD/ZAR Rate
                    </label>
                    <input
                      type="number"
                      value={formData.roe_origin || ''}
                      onChange={(e) => handleInputChange('roe_origin', parseFloat(e.target.value) || '')}
                      className="input"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #10b981', backgroundColor: '#f0fdf4' }}
                      step="0.0001"
                      placeholder="e.g. 18.50"
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
                      EUR/ZAR Rate
                    </label>
                    <input
                      type="number"
                      value={formData.roe_eur || ''}
                      onChange={(e) => handleInputChange('roe_eur', parseFloat(e.target.value) || '')}
                      className="input"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', backgroundColor: '#eff6ff' }}
                      step="0.0001"
                      placeholder="e.g. 20.50"
                    />
                  </div>
                  {renderCurrencyInput('Origin Rate', 'origin_rate_usd', 'USD')}
                  {renderCurrencyInput('Ocean Freight', 'ocean_freight_rate_usd', 'USD')}
                </div>
              </div>

              {/* Section: Invoice Value & Customs Value */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#92400e', fontSize: '1rem' }}>Invoice Value (FOB/CIF Value)</h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#666' }}>Enter the invoice value - Customs Value will be calculated automatically</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Invoice Value', 'invoice_value_usd', 'USD')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
                      USD to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency((parseFloat(formData.invoice_value_usd) || 0) * (parseFloat(formData.roe_origin) || 0))}
                    </div>
                  </div>
                  {renderCurrencyInput('Invoice Value', 'invoice_value_eur', 'EUR')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
                      EUR to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1d4ed8' }}>
                      {formatCurrency((parseFloat(formData.invoice_value_eur) || 0) * (parseFloat(formData.roe_eur) || 0))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#fde68a', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: '#92400e' }}>Customs Value (ZAR) - Auto Calculated</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#92400e' }}>
                      {formatCurrency(calculatedTotals.customs_value_zar)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Origin Charges */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Origin Charges</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Origin Charge', 'origin_charge_usd', 'USD')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
                      USD to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency((parseFloat(formData.origin_charge_usd) || 0) * (parseFloat(formData.roe_origin) || 0))}
                    </div>
                  </div>
                  {renderCurrencyInput('Origin Charge', 'origin_charge_eur', 'EUR')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
                      EUR to ZAR - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1d4ed8' }}>
                      {formatCurrency((parseFloat(formData.origin_charge_eur) || 0) * (parseFloat(formData.roe_eur) || 0))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#dcfce7', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: '#166534' }}>Total Origin Charges (ZAR)</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#166534' }}>
                      {formatCurrency(calculatedTotals.total_origin_charges_zar)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: Local Charges (Transport/Cartage) */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Local Charges (Transport/Cartage) - ZAR</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Local Cartage: CPT to Klapmuts (<20 Ton)', 'local_cartage_cpt_klapmuts_20ton_zar')}
                  {renderCurrencyInput('Local Cartage: CPT to Klapmuts (21-28 Ton)', 'local_cartage_cpt_klapmuts_28ton_zar')}
                  {renderCurrencyInput('Transport: DBN Port to Pretoria (20FT)', 'transport_dbn_to_pretoria_20ft_zar')}
                  {renderCurrencyInput('Transport: DBN Port to Pretoria (40FT)', 'transport_dbn_to_pretoria_40ft_zar')}
                  {renderCurrencyInput('Transport: DBN Port to WHS', 'transport_dbn_to_whs_zar')}
                  {renderCurrencyInput('Unpack / Reload', 'unpack_reload_zar')}
                  {renderCurrencyInput('Storage (Per Pallet Per Day)', 'storage_zar')}
                  {renderInput('Storage Days (3 Days Free)', 'storage_days', 'number')}
                  {renderCurrencyInput('Outlying Container Depot Surcharge', 'outlying_depot_surcharge_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (Tautliner A)', 'local_cartage_dbn_whs_pretoria_opt_a_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (Tautliner B)', 'local_cartage_dbn_whs_pretoria_opt_b_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (6M Deck)', 'local_cartage_dbn_whs_pretoria_6m_zar')}
                  {renderCurrencyInput('Local Cartage: DBN WHS to PTA (12M Deck)', 'local_cartage_dbn_whs_pretoria_12m_zar')}
                  {renderCurrencyInput('Transport: PE/Coega Port to Pretoria', 'transport_pe_coega_to_pretoria_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Local Charges Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
                      {formatCurrency(calculatedTotals.local_charges_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Destination Charges (Port/Shipping) */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#1e40af', fontSize: '1rem' }}>Destination Charges - ZAR</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Shipping Line Charges (At Cost)', 'shipping_line_charges_zar')}
                  {renderCurrencyInput('Cargo Dues (20FT)', 'cargo_dues_20ft_zar')}
                  {renderCurrencyInput('Cargo Dues (40FT)', 'cargo_dues_40ft_zar')}
                  {renderCurrencyInput('CTO Fee', 'cto_fee_zar')}
                  {renderCurrencyInput('Port Health Inspection', 'port_health_inspection_zar')}
                  {renderCurrencyInput('DAFF Inspection', 'daff_inspection_zar')}
                  {renderCurrencyInput('State Vet Cancellation Fee', 'state_vet_cancellation_fee_zar')}
                  {renderCurrencyInput('JNB Turn In (At Cost)', 'jnb_turn_in_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Destination Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1e40af' }}>
                      {formatCurrency(calculatedTotals.destination_charges_subtotal_zar)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Customs & Duties */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem', color: '#92400e', fontSize: '1rem' }}>Customs & Duties - ZAR</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {renderCurrencyInput('Duties', 'duties_zar')}
                  {renderCurrencyInput('Customs VAT', 'customs_vat_zar')}
                  {renderCurrencyInput('Customs Declaration', 'customs_declaration_zar')}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Agency Fee (3.5% min R1187) - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#92400e' }}>
                      {formatCurrency(calculatedTotals.agency_fee_zar)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>Based on Customs Value x 3.5%, min R1,187</span>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      <input
                        type="checkbox"
                        checked={formData.customs_duty_not_applicable || false}
                        onChange={(e) => handleInputChange('customs_duty_not_applicable', e.target.checked)}
                      />
                      Duties N/A (Essentials)
                    </label>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#333' }}>
                      Customs Sub-Total - Auto
                    </label>
                    <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#92400e' }}>
                      {formatCurrency(calculatedTotals.customs_subtotal_zar)}
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
