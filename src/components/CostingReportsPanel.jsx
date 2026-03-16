import React, { useState, useMemo, useRef } from 'react';
import {
  calculateAllTotals,
  formatCurrency,
  formatNumber,
} from '../utils/costingCalculations';
import { generateReportPDF as generateReportPDFUtil } from '../utils/costingPdf';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Transport mode badge component
const ModeBadge = ({ mode }) => {
  const isSea = mode === 'sea';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      fontWeight: '700',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      backgroundColor: isSea ? '#dbeafe' : '#ede9fe',
      color: isSea ? '#1d4ed8' : '#7c3aed',
      border: `1px solid ${isSea ? '#93c5fd' : '#c4b5fd'}`,
    }}>
      {isSea ? 'SEA' : 'AIR'}
    </span>
  );
};

function CostingReportsPanel({ estimates, onClose }) {
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [transportModeFilter, setTransportModeFilter] = useState('all'); // 'all', 'sea', 'air'
  const chartRef = useRef(null);

  // Filter estimates by transport mode first
  const modeFilteredEstimates = useMemo(() => {
    if (transportModeFilter === 'all') return estimates;
    return estimates.filter(est => (est.transport_mode || 'sea') === transportModeFilter);
  }, [estimates, transportModeFilter]);

  // Get unique products from estimates - filtered by selected supplier and transport mode
  const allProducts = useMemo(() => {
    const productSet = new Set();
    modeFilteredEstimates.forEach(est => {
      if (selectedSupplier !== 'all' && est.supplier_name !== selectedSupplier) return;
      (est.products || []).forEach(p => {
        if (p.name) productSet.add(p.name);
      });
    });
    return Array.from(productSet).sort();
  }, [modeFilteredEstimates, selectedSupplier]);

  // Get unique suppliers from filtered estimates
  const allSuppliers = useMemo(() => {
    const supplierSet = new Set();
    modeFilteredEstimates.forEach(est => {
      if (est.supplier_name) supplierSet.add(est.supplier_name);
    });
    return Array.from(supplierSet).sort();
  }, [modeFilteredEstimates]);

  // Build per-supplier, per-mode aggregation for chart + table
  const supplierAnalysis = useMemo(() => {
    // Collect data keyed by supplier, split by mode
    const data = {}; // { supplierName: { sea: {...}, air: {...}, combined: {...} } }

    modeFilteredEstimates.forEach(est => {
      const supplier = est.supplier_name || 'Unknown';
      const mode = est.transport_mode || 'sea';
      const products = est.products || [];

      if (selectedSupplier !== 'all' && supplier !== selectedSupplier) return;

      const relevantProducts = selectedProduct === 'all'
        ? products
        : products.filter(p => p.name === selectedProduct);

      if (relevantProducts.length === 0 && selectedProduct !== 'all') return;

      if (!data[supplier]) {
        const empty = () => ({ totalCost: 0, totalWeight: 0, costPerKg: 0, estimateCount: 0, totalInvoiceValue: 0 });
        data[supplier] = { sea: empty(), air: empty(), combined: empty() };
      }

      const totals = calculateAllTotals(est);
      const productWeight = relevantProducts.reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
      const productValue = relevantProducts.reduce((sum, p) => sum + (parseFloat(p.invoice_value) || 0), 0);
      const totalWeight = products.reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);

      const weightRatio = totalWeight > 0 && selectedProduct !== 'all'
        ? productWeight / totalWeight
        : 1;

      const cost = (totals.total_landed_cost_zar || totals.total_in_warehouse_cost_zar || 0) * weightRatio;
      const weight = productWeight || totalWeight;

      // Add to mode bucket
      const bucket = data[supplier][mode];
      bucket.totalCost += cost;
      bucket.totalWeight += weight;
      bucket.totalInvoiceValue += productValue;
      bucket.estimateCount += 1;

      // Add to combined bucket
      const combined = data[supplier].combined;
      combined.totalCost += cost;
      combined.totalWeight += weight;
      combined.totalInvoiceValue += productValue;
      combined.estimateCount += 1;
    });

    // Calculate cost per kg
    Object.values(data).forEach(supplier => {
      ['sea', 'air', 'combined'].forEach(key => {
        const d = supplier[key];
        d.costPerKg = d.totalWeight > 0 ? d.totalCost / d.totalWeight : 0;
      });
    });

    // Sort by combined total cost descending
    const sorted = Object.entries(data)
      .sort(([, a], [, b]) => b.combined.totalCost - a.combined.totalCost);

    return sorted; // [ [supplierName, { sea, air, combined }], ... ]
  }, [modeFilteredEstimates, selectedProduct, selectedSupplier]);

  // Determine if we should show split sea/air series or single series
  const hasBothModes = useMemo(() => {
    if (transportModeFilter !== 'all') return false;
    let hasSea = false, hasAir = false;
    for (const [, data] of supplierAnalysis) {
      if (data.sea.estimateCount > 0) hasSea = true;
      if (data.air.estimateCount > 0) hasAir = true;
      if (hasSea && hasAir) return true;
    }
    return false;
  }, [supplierAnalysis, transportModeFilter]);

  // Build chart datasets
  const chartData = useMemo(() => {
    const labels = supplierAnalysis.map(([name]) => name);

    if (transportModeFilter === 'all' && hasBothModes) {
      // Split bars: sea total cost + air total cost, plus combined cost/kg line
      return {
        labels,
        datasets: [
          {
            label: 'Sea Freight Cost (ZAR)',
            data: supplierAnalysis.map(([, d]) => d.sea.totalCost),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 2,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: 'Air Freight Cost (ZAR)',
            data: supplierAnalysis.map(([, d]) => d.air.totalCost),
            backgroundColor: 'rgba(124, 58, 237, 0.8)',
            borderColor: 'rgb(124, 58, 237)',
            borderWidth: 2,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: 'Cost per KG (ZAR)',
            data: supplierAnalysis.map(([, d]) => d.combined.costPerKg),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: 'rgb(245, 158, 11)',
            borderWidth: 2,
            borderRadius: 4,
            yAxisID: 'y1',
          }
        ],
      };
    }

    // Single mode (or all with only one mode present): original style
    const modeColor = transportModeFilter === 'air'
      ? { bg: 'rgba(124, 58, 237, 0.8)', border: 'rgb(124, 58, 237)' }
      : { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' };

    return {
      labels,
      datasets: [
        {
          label: 'Total Cost (ZAR)',
          data: supplierAnalysis.map(([, d]) => d.combined.totalCost),
          backgroundColor: modeColor.bg,
          borderColor: modeColor.border,
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'Cost per KG (ZAR)',
          data: supplierAnalysis.map(([, d]) => d.combined.costPerKg),
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'y1',
        }
      ],
    };
  }, [supplierAnalysis, transportModeFilter, hasBothModes]);

  // Build table rows — when showing 'all' and both modes exist, break out per-mode rows
  const tableRows = useMemo(() => {
    const rows = [];
    supplierAnalysis.forEach(([name, data]) => {
      if (transportModeFilter === 'all' && hasBothModes) {
        // Show per-mode rows if the supplier has estimates in that mode
        if (data.sea.estimateCount > 0) {
          rows.push({ name, mode: 'sea', ...data.sea });
        }
        if (data.air.estimateCount > 0) {
          rows.push({ name, mode: 'air', ...data.air });
        }
      } else {
        // Single mode row
        const mode = transportModeFilter !== 'all' ? transportModeFilter : (data.sea.estimateCount > 0 ? 'sea' : 'air');
        rows.push({ name, mode, ...data.combined });
      }
    });
    return rows;
  }, [supplierAnalysis, transportModeFilter, hasBothModes]);

  // Legacy-compatible supplierDetails for PDF generation
  const getSupplierChartData = useMemo(() => {
    return {
      labels: chartData.labels,
      datasets: chartData.datasets,
      supplierDetails: supplierAnalysis.map(([name, data]) => ({
        name,
        ...data.combined,
      })),
    };
  }, [chartData, supplierAnalysis]);

  // Filtered estimates for PDF generation (exclude archived + respect transport mode filter)
  const filteredEstimates = useMemo(() => {
    return estimates.filter(est => {
      if (est.status === 'archived') return false;
      if (transportModeFilter !== 'all' && (est.transport_mode || 'sea') !== transportModeFilter) return false;
      return true;
    });
  }, [estimates, transportModeFilter]);

  const generateReportPDF = async () => {
    await generateReportPDFUtil({
      chartData: getSupplierChartData,
      selectedProduct,
      selectedSupplier,
      transportModeFilter,
      chartRef,
      filteredEstimates,
    });
  };

  // Mode toggle button style helper
  const modeButtonStyle = (value) => ({
    padding: '6px 14px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.8rem',
    letterSpacing: '0.02em',
    backgroundColor:
      transportModeFilter === value
        ? value === 'sea' ? '#1d4ed8'
          : value === 'air' ? '#7c3aed'
          : '#374151'
        : '#f3f4f6',
    color: transportModeFilter === value ? 'white' : '#6b7280',
    transition: 'all 0.15s ease',
  });

  return (
    <div className="dash-panel" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f5f3ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, color: '#5b21b6', fontSize: '1.1rem' }}>Cost Analysis by Supplier</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Transport Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-500)' }}>Mode:</label>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
                <button type="button" onClick={() => setTransportModeFilter('all')} style={modeButtonStyle('all')}>
                  All
                </button>
                <button type="button" onClick={() => setTransportModeFilter('sea')} style={modeButtonStyle('sea')}>
                  Sea
                </button>
                <button type="button" onClick={() => setTransportModeFilter('air')} style={modeButtonStyle('air')}>
                  Air
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-500)' }}>Supplier:</label>
              <select
                value={selectedSupplier}
                onChange={(e) => {
                  setSelectedSupplier(e.target.value);
                  setSelectedProduct('all'); // Reset product when supplier changes
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  minWidth: '150px',
                }}
              >
                <option value="all">All Suppliers</option>
                {allSuppliers.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-500)' }}>Product:</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  minWidth: '150px',
                }}
              >
                <option value="all">All Products</option>
                {allProducts.map(product => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generateReportPDF}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Print PDF
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: '1rem' }}>
        {chartData.labels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>
            No data available for the selected filters.
          </div>
        ) : (
          <>
            <div style={{ height: '350px', marginBottom: '1.5rem' }}>
              <Bar
                ref={chartRef}
                data={{
                  labels: chartData.labels,
                  datasets: chartData.datasets,
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    title: {
                      display: true,
                      text: `${selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier} | ${selectedProduct === 'all' ? 'All Products' : selectedProduct}${transportModeFilter !== 'all' ? ` | ${transportModeFilter === 'sea' ? 'Sea Freight' : 'Air Freight'}` : ''}`,
                      font: { size: 14 }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const value = context.raw;
                          return `${context.dataset.label}: R ${formatNumber(value, 2)}`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      type: 'linear',
                      display: true,
                      position: 'left',
                      stacked: false,
                      title: {
                        display: true,
                        text: 'Total Cost (ZAR)'
                      },
                      ticks: {
                        callback: function(value) {
                          return 'R ' + formatNumber(value, 0);
                        }
                      }
                    },
                    y1: {
                      type: 'linear',
                      display: true,
                      position: 'right',
                      title: {
                        display: true,
                        text: 'Cost per KG (ZAR)'
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                      ticks: {
                        callback: function(value) {
                          return 'R ' + formatNumber(value, 2);
                        }
                      }
                    },
                  },
                }}
              />
            </div>

            {/* Summary Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Supplier</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Mode</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Estimates</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Total Weight</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Total Cost</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Cost/KG</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, idx) => (
                    <tr key={`${row.name}-${row.mode}-${idx}`} style={{ backgroundColor: idx % 2 === 0 ? 'white' : 'var(--surface-2)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{row.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <ModeBadge mode={row.mode} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.estimateCount}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNumber(row.totalWeight)} kg</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>{formatCurrency(row.totalCost)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#d97706' }}>{formatCurrency(row.costPerKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CostingReportsPanel;
