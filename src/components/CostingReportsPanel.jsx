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

function CostingReportsPanel({ estimates, onClose }) {
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const chartRef = useRef(null);

  // Get unique products from estimates - filtered by selected supplier
  const allProducts = useMemo(() => {
    const productSet = new Set();
    estimates.forEach(est => {
      if (selectedSupplier !== 'all' && est.supplier_name !== selectedSupplier) return;
      (est.products || []).forEach(p => {
        if (p.name) productSet.add(p.name);
      });
    });
    return Array.from(productSet).sort();
  }, [estimates, selectedSupplier]);

  // Get unique suppliers from all estimates
  const allSuppliers = useMemo(() => {
    const supplierSet = new Set();
    estimates.forEach(est => {
      if (est.supplier_name) supplierSet.add(est.supplier_name);
    });
    return Array.from(supplierSet).sort();
  }, [estimates]);

  // Get chart data - costs per supplier filtered by product and supplier
  const getSupplierChartData = useMemo(() => {
    const supplierData = {};

    estimates.forEach(est => {
      const supplier = est.supplier_name || 'Unknown';
      const products = est.products || [];

      // Filter by selected supplier if not 'all'
      if (selectedSupplier !== 'all' && supplier !== selectedSupplier) return;

      // Filter by selected product if not 'all'
      const relevantProducts = selectedProduct === 'all'
        ? products
        : products.filter(p => p.name === selectedProduct);

      if (relevantProducts.length === 0 && selectedProduct !== 'all') return;

      if (!supplierData[supplier]) {
        supplierData[supplier] = {
          totalCost: 0,
          totalWeight: 0,
          costPerKg: 0,
          estimateCount: 0,
          totalInvoiceValue: 0,
        };
      }

      const totals = calculateAllTotals(est);
      const productWeight = relevantProducts.reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
      const productValue = relevantProducts.reduce((sum, p) => sum + (parseFloat(p.invoice_value) || 0), 0);
      const totalWeight = (est.products || []).reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);

      // If filtering by product, calculate proportional cost
      const weightRatio = totalWeight > 0 && selectedProduct !== 'all'
        ? productWeight / totalWeight
        : 1;

      supplierData[supplier].totalCost += (totals.total_landed_cost_zar || totals.total_in_warehouse_cost_zar || 0) * weightRatio;
      supplierData[supplier].totalWeight += productWeight || totalWeight;
      supplierData[supplier].totalInvoiceValue += productValue;
      supplierData[supplier].estimateCount += 1;
    });

    // Calculate cost per kg
    Object.keys(supplierData).forEach(supplier => {
      const data = supplierData[supplier];
      data.costPerKg = data.totalWeight > 0 ? data.totalCost / data.totalWeight : 0;
    });

    // Sort by total cost descending
    const sortedSuppliers = Object.entries(supplierData)
      .sort(([,a], [,b]) => b.totalCost - a.totalCost);

    return {
      labels: sortedSuppliers.map(([name]) => name),
      datasets: [
        {
          label: 'Total Cost (ZAR)',
          data: sortedSuppliers.map(([,data]) => data.totalCost),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'Cost per KG (ZAR)',
          data: sortedSuppliers.map(([,data]) => data.costPerKg),
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          borderColor: 'rgb(245, 158, 11)',
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'y1',
        }
      ],
      supplierDetails: sortedSuppliers.map(([name, data]) => ({ name, ...data })),
    };
  }, [estimates, selectedProduct, selectedSupplier]);

  // Filtered estimates for PDF generation (exclude archived)
  const filteredEstimates = useMemo(() => {
    return estimates.filter(est => est.status !== 'archived');
  }, [estimates]);

  const generateReportPDF = async () => {
    await generateReportPDFUtil({
      chartData: getSupplierChartData,
      selectedProduct,
      selectedSupplier,
      chartRef,
      filteredEstimates,
    });
  };

  return (
    <div className="dash-panel" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f5f3ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, color: '#5b21b6', fontSize: '1.1rem' }}>Cost Analysis by Supplier</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
        {getSupplierChartData.labels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>
            No data available for the selected filters.
          </div>
        ) : (
          <>
            <div style={{ height: '350px', marginBottom: '1.5rem' }}>
              <Bar
                ref={chartRef}
                data={{
                  labels: getSupplierChartData.labels,
                  datasets: getSupplierChartData.datasets,
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
                      text: `${selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier} | ${selectedProduct === 'all' ? 'All Products' : selectedProduct}`,
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
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Estimates</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Total Weight</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Total Cost</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Cost/KG</th>
                  </tr>
                </thead>
                <tbody>
                  {getSupplierChartData.supplierDetails.map((supplier, idx) => (
                    <tr key={supplier.name} style={{ backgroundColor: idx % 2 === 0 ? 'white' : 'var(--surface-2)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{supplier.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{supplier.estimateCount}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatNumber(supplier.totalWeight)} kg</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>{formatCurrency(supplier.totalCost)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#d97706' }}>{formatCurrency(supplier.costPerKg)}</td>
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
