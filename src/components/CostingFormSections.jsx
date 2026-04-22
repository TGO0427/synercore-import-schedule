import React from 'react';
import {
  formatCurrency,
  formatNumber,
  CONTAINER_TYPES,
  INCO_TERMS,
  AFRICAN_PORTS,
  LOAD_TYPES,
  PORTS_OF_LOADING,
  SHIPPING_LINES,
  AIRPORTS_OF_DEPARTURE,
  AIRPORTS_OF_ARRIVAL,
  AIRLINES,
} from '../utils/costingCalculations';

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

// Info tooltip helper
const InfoTip = ({ text }) => <span className="info-tip" data-tip={text}>i</span>;

// Render input field helper
const renderInput = (formData, onInputChange, label, field, type = 'text', options = {}, tooltip) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
      {label}{tooltip && <InfoTip text={tooltip} />}
    </label>
    <input
      type={type}
      value={formData[field] || ''}
      onChange={(e) => onInputChange(field, type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
      className="input"
      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
      {...options}
    />
  </div>
);

// Render select field helper
const renderSelect = (formData, onInputChange, label, field, options, tooltip) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
      {label}{tooltip && <InfoTip text={tooltip} />}
    </label>
    <select
      value={formData[field] || ''}
      onChange={(e) => onInputChange(field, e.target.value)}
      className="select"
      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
    >
      <option value="">Select...</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// Render currency input
const renderCurrencyInput = (formData, onInputChange, label, field, currency = 'ZAR', tooltip) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
      {label} ({currency}){tooltip && <InfoTip text={tooltip} />}
    </label>
    <input
      type="number"
      value={formData[field] || ''}
      onChange={(e) => onInputChange(field, parseFloat(e.target.value) || 0)}
      className="input"
      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
      min="0"
      step="0.01"
    />
  </div>
);

function CostingFormSections({
  formData,
  calculatedTotals,
  editingId,
  suppliers,
  onInputChange,
  onAddProduct,
  onRemoveProduct,
  onUpdateProduct,
  onSubmit,
  onCancel,
  showAddSupplier,
  onToggleAddSupplier,
  newSupplierName,
  onNewSupplierNameChange,
  onCreateSupplier,
  // Calculation helpers passed from parent
  getTotalWeight,
  getCustomsTotals,
  calculateProductCustomsValues,
  calculateProductAllocation,
}) {
  // Shorthand wrappers that bind formData and onInputChange
  const input = (label, field, type = 'text', options = {}, tooltip) =>
    renderInput(formData, onInputChange, label, field, type, options, tooltip);

  const select = (label, field, options, tooltip) =>
    renderSelect(formData, onInputChange, label, field, options, tooltip);

  const currencyInput = (label, field, currency = 'ZAR', tooltip) =>
    renderCurrencyInput(formData, onInputChange, label, field, currency, tooltip);

  return (
    <form onSubmit={onSubmit} style={{ padding: '1.5rem' }}>
      {/* Section: Header Details */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#0f172a', fontSize: '1rem' }}>
          {formData.transport_mode === 'air' ? 'Shipment Details (Air Freight)' : 'Shipment Details'}
          {' '}<InfoTip text="Core shipment info: supplier, origin, ports, and shipping terms." />
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {input('Reference Number', 'reference_number')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
              Supplier
            </label>
            {showAddSupplier ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => onNewSupplierNameChange(e.target.value)}
                  placeholder="Enter supplier name..."
                  className="input"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #059669' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onCreateSupplier(); }
                    if (e.key === 'Escape') { onToggleAddSupplier(false); onNewSupplierNameChange(''); }
                  }}
                />
                <button
                  type="button"
                  onClick={onCreateSupplier}
                  style={{ padding: '8px 12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { onToggleAddSupplier(false); onNewSupplierNameChange(''); }}
                  style={{ padding: '8px 12px', backgroundColor: '#f3f4f6', color: 'var(--text-500)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={formData.supplier_name || ''}
                  onChange={(e) => onInputChange('supplier_name', e.target.value)}
                  className="select"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onToggleAddSupplier(true)}
                  style={{ padding: '8px 12px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  + New
                </button>
              </div>
            )}
          </div>
          {input('Country of Origin', 'country_of_origin')}
          {formData.transport_mode === 'air' ? (
            <>
              {select('Airport of Departure', 'airport_of_departure', AIRPORTS_OF_DEPARTURE)}
              {select('Airport of Arrival', 'airport_of_arrival', AIRPORTS_OF_ARRIVAL)}
              {select('Airline', 'airline_name', AIRLINES)}
              {input('Flight Number', 'flight_number')}
            </>
          ) : (
            <>
              {select('Port of Loading', 'port_of_loading', PORTS_OF_LOADING)}
              {select('Port of Discharge', 'port_of_discharge', AFRICAN_PORTS)}
              {select('Load Type', 'load_type', LOAD_TYPES, 'FCL = Full Container Load (exclusive use). LCL = Less than Container Load (shared).')}
              {select('Container Type', 'container_type', CONTAINER_TYPES)}
            </>
          )}
          {select('INCO Terms', 'inco_terms', INCO_TERMS, 'International Commercial Terms — defines who pays freight, insurance, and risk transfer point (e.g. FOB, CIF, EXW).')}
          {input('INCO Term Place', 'inco_term_place', 'text', {}, "The named location for the Incoterm, e.g. 'Shanghai' for FOB Shanghai.")}
          {input('Transit Time (days)', 'transit_time_days', 'number', {}, formData.transport_mode === 'air' ? 'Estimated days from departure to arrival.' : 'Estimated number of days from port of loading to port of discharge.')}
          {formData.transport_mode !== 'air' && select('Shipping Line', 'shipping_line', SHIPPING_LINES)}
          {formData.transport_mode !== 'air' && input('No. of Containers', 'quantity', 'number')}
          {input('Costing Date', 'costing_date', 'date')}
          {input('Validity Date', 'validity_date', 'date')}
          {select('Payment Terms', 'payment_terms', PAYMENT_TERMS)}
        </div>
      </div>

      {/* Section: Products in Container */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ margin: 0, color: '#92400e', fontSize: '1rem' }}>Products in Container <InfoTip text="List all products in this shipment. Invoice value auto-calculates from weight × rate/kg." /></h4>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#b45309' }}>
              Enter weight and rate/kg to auto-calculate invoice value.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Total Weight</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#78350f' }}>{formatNumber(getTotalWeight())} kg</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Total USD</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#78350f' }}>{formatCurrency((formData.products || []).reduce((sum, p) => sum + (p.currency === 'USD' ? (parseFloat(p.invoice_value) || 0) : 0), 0), 'USD')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Total EUR</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#78350f' }}>{formatCurrency((formData.products || []).reduce((sum, p) => sum + (p.currency === 'EUR' ? (parseFloat(p.invoice_value) || 0) : 0), 0), 'EUR')}</div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fbbf24', color: '#78350f' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Product Name</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>HS Code <InfoTip text="Harmonized System code — the international tariff classification that determines duty rates." /></th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Pack Size</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Pack Type</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Weight (kg)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Rate/kg <InfoTip text="Purchase price per kilogram in the selected currency." /></th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Currency</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b', backgroundColor: '#f59e0b', color: 'white' }}>Invoice Value</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Weight % <InfoTip text="This product's weight as a percentage of total shipment weight — used to allocate shared costs." /></th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Duty % <InfoTip text="General customs duty rate for this product based on its HS code." /></th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}>Sch 1 % <InfoTip text="Schedule 1 (Part 1) additional duty — an extra tariff on specific goods under SA trade policy." /></th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #f59e0b', backgroundColor: '#f59e0b', color: 'white' }}>Cost/kg (ZAR)</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #f59e0b' }}></th>
              </tr>
            </thead>
            <tbody>
              {(formData.products || []).map((product, index) => {
                const totalWeight = getTotalWeight();
                const productWeight = parseFloat(product.weight_kg) || 0;
                const weightPercent = totalWeight > 0 ? (productWeight / totalWeight * 100) : 0;
                return (
                  <tr key={product._id || index} style={{ backgroundColor: index % 2 === 0 ? '#fffbeb' : '#fef3c7' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        value={product.name || ''}
                        onChange={(e) => onUpdateProduct(index, 'name', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem' }}
                        placeholder="e.g. SHMP 26/30"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        value={product.hs_code || ''}
                        onChange={(e) => onUpdateProduct(index, 'hs_code', e.target.value)}
                        style={{ width: '100px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem' }}
                        placeholder="0306.17"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        value={product.pack_size || ''}
                        onChange={(e) => onUpdateProduct(index, 'pack_size', e.target.value)}
                        style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                        placeholder="10x1kg"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="text"
                        value={product.pack_type || ''}
                        onChange={(e) => onUpdateProduct(index, 'pack_type', e.target.value)}
                        style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                        placeholder="Carton"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        value={product.weight_kg || ''}
                        onChange={(e) => onUpdateProduct(index, 'weight_kg', parseFloat(e.target.value) || 0)}
                        style={{ width: '90px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'right' }}
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        value={product.rate_per_kg || ''}
                        onChange={(e) => onUpdateProduct(index, 'rate_per_kg', parseFloat(e.target.value) || 0)}
                        style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'right' }}
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <select
                        value={product.currency || 'USD'}
                        onChange={(e) => onUpdateProduct(index, 'currency', e.target.value)}
                        style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem' }}
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="ZAR">ZAR</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', backgroundColor: '#fde68a' }}>
                      <div style={{ padding: '6px 8px', fontWeight: '600', color: '#92400e', textAlign: 'right' }}>
                        {formatNumber(product.invoice_value || 0, 2)}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600', color: '#92400e' }}>
                      {formatNumber(weightPercent, 1)}%
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        value={product.duty_percent || ''}
                        onChange={(e) => onUpdateProduct(index, 'duty_percent', parseFloat(e.target.value) || 0)}
                        style={{ width: '60px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                        step="0.1"
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        value={product.duty_schedule1_percent || ''}
                        onChange={(e) => onUpdateProduct(index, 'duty_schedule1_percent', parseFloat(e.target.value) || 0)}
                        style={{ width: '60px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'center' }}
                        step="0.1"
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '6px 8px', backgroundColor: '#fde68a', textAlign: 'right', fontWeight: '700', color: '#92400e' }}>
                      {(() => {
                        const iv = parseFloat(product.invoice_value) || 0;
                        const currency = product.currency || 'USD';
                        const roe = currency === 'EUR' ? (parseFloat(formData.roe_eur) || 1) : currency === 'ZAR' ? 1 : (parseFloat(formData.roe_origin) || 1);
                        const customsVal = iv * roe;
                        const dutyPct = parseFloat(product.duty_percent) || 0;
                        const sch1Pct = parseFloat(product.duty_schedule1_percent) || 0;
                        const totalWithDuties = customsVal + (customsVal * dutyPct / 100) + (customsVal * sch1Pct / 100);
                        return productWeight > 0 ? formatCurrency(totalWithDuties / productWeight) : '-';
                      })()}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {formData.products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveProduct(index)}
                          style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            onClick={onAddProduct}
            style={{ padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Section: Exchange Rate & Customs Value */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#065f46', fontSize: '1rem' }}>Finex SA Exchange Rates <InfoTip text="Daily exchange rates from Finex SA. These convert foreign currency values to ZAR." /></h4>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-500)' }}>Enter the Finex SA rates from your daily email</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
              USD/ZAR Rate <InfoTip text="Today's Finex SA US Dollar to South African Rand exchange rate." />
            </label>
            <input
              type="number"
              value={formData.roe_origin || ''}
              onChange={(e) => onInputChange('roe_origin', parseFloat(e.target.value) || '')}
              className="input"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #10b981', backgroundColor: '#f0fdf4' }}
              step="0.0001"
              placeholder="e.g. 18.50"
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
              EUR/ZAR Rate <InfoTip text="Today's Finex SA Euro to South African Rand exchange rate." />
            </label>
            <input
              type="number"
              value={formData.roe_eur || ''}
              onChange={(e) => onInputChange('roe_eur', parseFloat(e.target.value) || '')}
              className="input"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', backgroundColor: '#eff6ff' }}
              step="0.0001"
              placeholder="e.g. 20.50"
            />
          </div>
        </div>
      </div>

      {/* === SEA FREIGHT SECTIONS === */}
      {formData.transport_mode !== 'air' && (
      <>
      {/* Section: Ocean Freight */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#1d4ed8', fontSize: '1rem' }}>Ocean Freight <InfoTip text="Sea freight charges from the shipping line. Enter in original currency — ZAR conversion is automatic." /></h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {currencyInput('Ocean Freight', 'ocean_freight_usd', 'USD')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
              USD to ZAR - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
              {formatCurrency((parseFloat(formData.ocean_freight_usd) || 0) * (parseFloat(formData.roe_origin) || 0))}
            </div>
          </div>
          {currencyInput('Ocean Freight', 'ocean_freight_eur', 'EUR')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
              EUR to ZAR - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1d4ed8' }}>
              {formatCurrency((parseFloat(formData.ocean_freight_eur) || 0) * (parseFloat(formData.roe_eur) || 0))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#dbeafe', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '500', color: '#1d4ed8' }}>Total Ocean Freight (ZAR)</span>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1d4ed8' }}>
              {formatCurrency(
                ((parseFloat(formData.ocean_freight_usd) || 0) * (parseFloat(formData.roe_origin) || 0)) +
                ((parseFloat(formData.ocean_freight_eur) || 0) * (parseFloat(formData.roe_eur) || 0))
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Section: Origin Charges */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Origin Charges <InfoTip text="FOB value of goods at origin. Auto-syncs from Products in Container totals under FOB / FCA / EXW. Leave 0 for CIF / CFR / CIP (value is already bundled into the invoice / freight)." /></h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {currencyInput('Origin Charge', 'origin_charge_usd', 'USD')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
              USD to ZAR - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
              {formatCurrency((parseFloat(formData.origin_charge_usd) || 0) * (parseFloat(formData.roe_origin) || 0))}
            </div>
          </div>
          {currencyInput('Origin Charge', 'origin_charge_eur', 'EUR')}
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
        <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Local Charges (Transport/Cartage) - ZAR <InfoTip text="Inland transport and handling costs within South Africa after port discharge." /></h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {currencyInput('Local Cartage: CPT to Klapmuts (<20 Ton)', 'local_cartage_cpt_klapmuts_20ton_zar')}
          {currencyInput('Local Cartage: CPT to Klapmuts (21-28 Ton)', 'local_cartage_cpt_klapmuts_28ton_zar')}
          {currencyInput('Transport: DBN Port to Pretoria (20FT)', 'transport_dbn_to_pretoria_20ft_zar')}
          {currencyInput('Transport: DBN Port to Pretoria (40FT)', 'transport_dbn_to_pretoria_40ft_zar')}
          {currencyInput('Transport: DBN Port to WHS', 'transport_dbn_to_whs_zar')}
          {currencyInput('Unpack / Reload', 'unpack_reload_zar')}
          {currencyInput('Storage (Per Pallet Per Day)', 'storage_zar')}
          {input('Storage Days (3 Days Free)', 'storage_days', 'number')}
          {currencyInput('Outlying Container Depot Surcharge', 'outlying_depot_surcharge_zar')}
          {currencyInput('Local Cartage: DBN WHS to PTA (Tautliner A)', 'local_cartage_dbn_whs_pretoria_opt_a_zar')}
          {currencyInput('Local Cartage: DBN WHS to PTA (Tautliner B)', 'local_cartage_dbn_whs_pretoria_opt_b_zar')}
          {currencyInput('Local Cartage: DBN WHS to PTA (6M Deck)', 'local_cartage_dbn_whs_pretoria_6m_zar')}
          {currencyInput('Local Cartage: DBN WHS to PTA (12M Deck)', 'local_cartage_dbn_whs_pretoria_12m_zar')}
          {currencyInput('Transport: PE/Coega Port to Pretoria', 'transport_pe_coega_to_pretoria_zar')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
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
        <h4 style={{ margin: '0 0 1rem', color: '#1e40af', fontSize: '1rem' }}>Destination Charges - ZAR <InfoTip text="Port-side fees at discharge: cargo dues, inspections, CTO, and turn-in costs." /></h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {currencyInput('Shipping Line Charges (At Cost)', 'shipping_line_charges_zar')}
          {currencyInput('Cargo Dues (20FT)', 'cargo_dues_20ft_zar')}
          {currencyInput('Cargo Dues (40FT)', 'cargo_dues_40ft_zar')}
          {currencyInput('CTO Fee', 'cto_fee_zar')}
          {currencyInput('Port Health Inspection', 'port_health_inspection_zar')}
          {currencyInput('DAFF Inspection', 'daff_inspection_zar')}
          {currencyInput('State Vet Cancellation Fee', 'state_vet_cancellation_fee_zar')}
          {currencyInput('JNB Turn In (At Cost)', 'jnb_turn_in_zar')}
          {currencyInput('Bill of Lading Fee', 'bill_of_lading_fee_zar')}
          {currencyInput('RCG Manifest Filing', 'manifest_filing_zar')}
          {currencyInput('Currency Adjustment Factor (CAF)', 'currency_adjustment_factor_zar')}
          {currencyInput('Degrouping', 'degrouping_zar')}
          {currencyInput('EDI Fee', 'edi_fee_zar')}
          {currencyInput('Communication', 'communication_dest_zar')}
          {currencyInput('Documentation Fee', 'documentation_fee_dest_zar')}
          {currencyInput('CFS LCL Handling Out', 'cfs_lcl_handling_out_zar')}
          {currencyInput('Delivery Release Order (DRO)', 'delivery_release_order_zar')}
          {currencyInput('Cartage', 'cartage_dest_zar')}
          {currencyInput('Fuel Surcharge', 'fuel_surcharge_dest_zar')}
          {currencyInput('Agency Fee', 'agency_fee_dest_zar')}
          {currencyInput('Facility Fee', 'facility_fee_zar')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
              Destination Sub-Total - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1e40af' }}>
              {formatCurrency(calculatedTotals.destination_charges_subtotal_zar)}
            </div>
          </div>
        </div>
      </div>

      </>
      )}

      {/* === AIR FREIGHT SECTIONS === */}
      {formData.transport_mode === 'air' && (
      <>
      {/* Section: Airfreight & Weight */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '2px solid #7c3aed' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#5b21b6', fontSize: '1rem' }}>Air Freight Rate & Weight <InfoTip text="Chargeable weight is the higher of actual weight or volumetric weight. Volumetric = (L×W×H×pieces) / 6000." /></h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          {currencyInput('Actual Gross Weight', 'actual_weight_kg', 'kg')}
          {input('No. of Pieces', 'number_of_pieces', 'number')}
          {currencyInput('Length', 'dimensions_length_cm', 'cm')}
          {currencyInput('Width', 'dimensions_width_cm', 'cm')}
          {currencyInput('Height', 'dimensions_height_cm', 'cm')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#5b21b6' }}>
              Volumetric Weight (auto)
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#ede9fe', borderRadius: '6px', fontWeight: '600', color: '#5b21b6' }}>
              {formatNumber(calculatedTotals.volumetric_weight_kg || 0)} kg
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#7c3aed' }}>
              Chargeable Weight (auto) <InfoTip text="Higher of actual vs volumetric weight — this is what airlines bill on." />
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#7c3aed', borderRadius: '6px', fontWeight: '700', color: 'white', fontSize: '1.1rem' }}>
              {formatNumber(calculatedTotals.chargeable_weight_kg || 0)} kg
            </div>
          </div>
        </div>

        {/* Airfreight Cost - USD + EUR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {currencyInput('Airfreight', 'airfreight_usd', 'USD')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
              USD to ZAR - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
              {formatCurrency(calculatedTotals._airfreight_usd_zar || 0)}
            </div>
          </div>
          {currencyInput('Airfreight', 'airfreight_eur', 'EUR')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#1d4ed8' }}>
              EUR to ZAR - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', fontWeight: '600', color: '#1d4ed8' }}>
              {formatCurrency(calculatedTotals._airfreight_eur_zar || 0)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '0.5rem', padding: '12px', backgroundColor: '#ede9fe', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '500', color: '#5b21b6' }}>Total Airfreight (ZAR)</span>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#5b21b6' }}>
              {formatCurrency(calculatedTotals.airfreight_total_zar || 0)}
            </span>
          </div>
        </div>

        {/* Surcharges - USD + EUR totals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
          {currencyInput('Fuel Surcharge', 'fuel_surcharge_usd', 'USD')}
          {currencyInput('Fuel Surcharge', 'fuel_surcharge_eur', 'EUR')}
          <div style={{ marginBottom: '12px', gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#5b21b6' }}>
              Fuel Surcharge Total (ZAR)
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#ede9fe', borderRadius: '6px', fontWeight: '600', color: '#5b21b6' }}>
              {formatCurrency(calculatedTotals.fuel_surcharge_total_zar || 0)}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {currencyInput('Security Surcharge', 'security_surcharge_usd', 'USD')}
          {currencyInput('Security Surcharge', 'security_surcharge_eur', 'EUR')}
          <div style={{ marginBottom: '12px', gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#5b21b6' }}>
              Security Surcharge Total (ZAR)
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#ede9fe', borderRadius: '6px', fontWeight: '600', color: '#5b21b6' }}>
              {formatCurrency(calculatedTotals.security_surcharge_total_zar || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Air Freight Origin & Local Charges */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#166534', fontSize: '1rem' }}>Origin & Local Charges <InfoTip text="Origin handling, airport fees, and local transport from airport to warehouse." /></h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {currencyInput('Origin Charges', 'airfreight_origin_charges_usd', 'USD')}
          {currencyInput('Origin Charges', 'airfreight_origin_charges_eur', 'EUR')}
          <div style={{ marginBottom: '12px', gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
              Origin Charges (ZAR) - Auto
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
              {formatCurrency(calculatedTotals.airfreight_origin_charges_zar || 0)}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
          {currencyInput('Screening Fee', 'screening_fee_zar', 'ZAR')}
          {currencyInput('AWB Fee', 'awb_fee_zar', 'ZAR', 'Air Waybill documentation fee.')}
          {currencyInput('Airline Handling Fee', 'airline_handling_fee_zar', 'ZAR')}
          {currencyInput('Airport Transfer Fee', 'airport_transfer_fee_zar', 'ZAR')}
          {currencyInput('Cartage: Airport to Warehouse', 'cartage_airport_to_whs_zar', 'ZAR')}
          {currencyInput('Insurance %', 'airfreight_insurance_percent', '%')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#166534' }}>
              Insurance Amount (ZAR)
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '6px', fontWeight: '600', color: '#166534' }}>
              {formatCurrency(calculatedTotals.airfreight_insurance_zar || 0)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', padding: '12px', backgroundColor: '#7c3aed', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '500', color: 'white' }}>Total Air Freight Cost (ZAR)</span>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white' }}>
              {formatCurrency(calculatedTotals.total_airfreight_cost_zar || 0)}
            </span>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Section: Customs VAT & Duty Summary */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 1rem', color: '#92400e', fontSize: '1rem' }}>Customs & Duties Summary <InfoTip text="SARS import duties and VAT calculated from customs value × duty rates per product." /></h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
              ROE for Customs <InfoTip text="Rate of Exchange used by SARS for customs valuation. May differ from the commercial rate." />
            </label>
            <input
              type="number"
              value={formData.roe_customs || ''}
              onChange={(e) => onInputChange('roe_customs', parseFloat(e.target.value) || '')}
              placeholder={formData.roe_origin || 'Uses USD rate'}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #f59e0b', fontSize: '0.9rem', fontWeight: '600' }}
              step="0.01"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
              Total Customs Value
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#78350f' }}>
              {formatCurrency(getCustomsTotals().totalCustomsValue)}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
              Total Duties
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#78350f' }}>
              {formatCurrency(getCustomsTotals().totalDuties + getCustomsTotals().totalSchedule1Duty)}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
              IMPORT VAT (15%) <InfoTip text="15% VAT levied on (customs value + duties + schedule 1 duty)." />
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#78350f' }}>
              {formatCurrency(getCustomsTotals().totalVat)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {currencyInput('Customs Declaration', 'customs_declaration_zar', 'ZAR', 'SARS customs processing/declaration fee charged per bill of entry.')}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
              Agency Fee ({formData.agency_fee_percentage}% min R{formData.agency_fee_min}) <InfoTip text="Clearing agent's fee — calculated as a percentage of duties + VAT, subject to a minimum." />
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#fde68a', borderRadius: '6px', fontWeight: '600', color: '#92400e' }}>
              {formatCurrency(calculatedTotals.agency_fee_zar)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#78350f', marginTop: '2px' }}>
              Based on Duties + Import VAT
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: '#92400e' }}>
              Customs Sub-Total (excl. Import VAT)
            </label>
            <div style={{ padding: '8px 12px', backgroundColor: '#b45309', borderRadius: '6px', fontWeight: '700', color: 'white', fontSize: '1.1rem' }}>
              {formatCurrency(getCustomsTotals().totalDuties + getCustomsTotals().totalSchedule1Duty + (parseFloat(formData.customs_declaration_zar) || 0) + (calculatedTotals.agency_fee_zar || 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Product Cost Allocation */}
      {formData.products && formData.products.length > 0 && getTotalWeight() > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '2px solid #10b981' }}>
          <h4 style={{ margin: '0 0 1rem', color: '#065f46', fontSize: '1rem' }}>Product Cost Allocation <InfoTip text="Breaks down the total landed cost per product. Shipping is split by weight share." /></h4>
          <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#047857' }}>
            Shipping costs allocated by weight. Each product shows its share of total costs.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#10b981', color: 'white' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600' }}>Product</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Weight</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600' }}>Share %</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Customs Value</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Duties</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Shipping Alloc.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>Transport Cost/kg</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', backgroundColor: '#059669' }}>Total Landed</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', backgroundColor: '#059669' }}>Cost/kg</th>
                </tr>
              </thead>
              <tbody>
                {(formData.products || []).map((product, index) => {
                  const allocation = calculateProductAllocation(product);
                  const customs = calculateProductCustomsValues(product);
                  const productWeight = parseFloat(product.weight_kg) || 0;
                  return (
                    <tr key={product._id || index} style={{ backgroundColor: index % 2 === 0 ? '#ecfdf5' : '#d1fae5' }}>
                      <td style={{ padding: '8px', fontWeight: '500', color: '#065f46' }}>
                        {product.name || `Product ${index + 1}`}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatNumber(productWeight)} kg
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', color: '#047857' }}>
                        {formatNumber(allocation.weightRatio * 100, 1)}%
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(customs.customsValue)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(customs.totalDuties + customs.schedule1Duty)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(allocation.allocatedShippingCost)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#047857' }}>
                        {formatCurrency(allocation.transportCostPerKg)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#065f46', backgroundColor: '#a7f3d0' }}>
                        {formatCurrency(allocation.totalProductCost)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#065f46', backgroundColor: '#a7f3d0' }}>
                        {formatCurrency(allocation.costPerKg)}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals Row */}
                <tr style={{ backgroundColor: '#059669', color: 'white', fontWeight: '700' }}>
                  <td style={{ padding: '10px 8px' }}>TOTALS</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatNumber(getTotalWeight())} kg</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>100%</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(getCustomsTotals().totalCustomsValue)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(getCustomsTotals().totalDuties + getCustomsTotals().totalSchedule1Duty)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(
                    ['CIF', 'CIP', 'CFR'].includes((formData.inco_terms || '').toUpperCase())
                      ? (calculatedTotals.local_charges_subtotal_zar || 0) + (calculatedTotals.destination_charges_subtotal_zar || 0)
                      : calculatedTotals.total_shipping_cost_zar
                  )}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(
                    getTotalWeight() > 0
                      ? (['CIF', 'CIP', 'CFR'].includes((formData.inco_terms || '').toUpperCase())
                          ? ((calculatedTotals.local_charges_subtotal_zar || 0) + (calculatedTotals.destination_charges_subtotal_zar || 0))
                          : (calculatedTotals.total_shipping_cost_zar || 0)
                        ) / getTotalWeight()
                      : 0
                  )}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(calculatedTotals.total_landed_cost_zar)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(calculatedTotals.all_in_warehouse_cost_per_kg_zar)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section: Totals Summary */}
      <div style={{ marginBottom: '1rem', padding: '10px', backgroundColor: '#0f172a', borderRadius: '6px', color: 'white' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Summary Totals</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Total Shipping Cost</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(calculatedTotals.total_shipping_cost_zar)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Total Landed Cost</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{formatCurrency(calculatedTotals.total_landed_cost_zar)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Landed Cost/KG</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>{formatCurrency(calculatedTotals.all_in_warehouse_cost_per_kg_zar)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Status</div>
            <select
              value={formData.status}
              onChange={(e) => onInputChange('status', e.target.value)}
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
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-900)' }}>
          Notes
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => onInputChange('notes', e.target.value)}
          className="input"
          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', minHeight: '80px' }}
          placeholder="Additional notes..."
        />
      </div>

      {/* Form Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={onCancel}
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
            padding: '10px 24px', backgroundColor: '#059669', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
          }}
        >
          {editingId ? 'Update Estimate' : 'Create Estimate'}
        </button>
      </div>
    </form>
  );
}

export default CostingFormSections;
