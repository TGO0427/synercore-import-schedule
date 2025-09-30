import React from 'react';
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

function SupplierCharts({ shipments, supplierName }) {
  // Prepare data for shipments by week chart
  const getShipmentsByWeekData = () => {
    if (!shipments || shipments.length === 0) return null;

    // Group shipments by week number
    const weeklyData = shipments.reduce((acc, shipment) => {
      const week = shipment.weekNumber || 0;
      if (!acc[week]) {
        acc[week] = { count: 0, cbm: 0, quantity: 0 };
      }
      acc[week].count += 1;
      acc[week].cbm += Number(shipment.cbm) || 0;
      acc[week].quantity += Number(shipment.quantity) || 0;
      return acc;
    }, {});

    // Sort by week number and prepare chart data
    const sortedWeeks = Object.keys(weeklyData)
      .map(Number)
      .sort((a, b) => a - b);

    return {
      labels: sortedWeeks.map(week => `Week ${week}`),
      datasets: [
        {
          label: 'Number of Shipments',
          data: sortedWeeks.map(week => weeklyData[week].count),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };
  };

  // Prepare data for Pallet Qty by product chart
  const getPalletQtyByProductData = () => {
    if (!shipments || shipments.length === 0) return null;

    // Group by product name and sum Pallet Qty
    const productData = shipments.reduce((acc, shipment) => {
      const product = shipment.productName || 'Unknown Product';
      if (!acc[product]) {
        acc[product] = { pallets: 0, quantity: 0, count: 0 };
      }
      acc[product].pallets += Number(shipment.cbm) || 0; // Using cbm field as pallet qty
      acc[product].quantity += Number(shipment.quantity) || 0;
      acc[product].count += 1;
      return acc;
    }, {});

    // Sort by Pallet Qty (highest first) and take top 10
    const sortedProducts = Object.entries(productData)
      .sort(([,a], [,b]) => b.pallets - a.pallets)
      .slice(0, 10);

    // Generate colors for each product
    const colors = [
      'rgba(34, 197, 94, 0.8)',
      'rgba(168, 85, 247, 0.8)', 
      'rgba(249, 115, 22, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(20, 184, 166, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(6, 182, 212, 0.8)',
      'rgba(156, 163, 175, 0.8)'
    ];

    return {
      labels: sortedProducts.map(([product]) => 
        product.length > 20 ? product.substring(0, 20) + '...' : product
      ),
      datasets: [
        {
          label: 'Pallet Quantity',
          data: sortedProducts.map(([, data]) => Math.round(data.pallets)),
          backgroundColor: colors.slice(0, sortedProducts.length),
          borderColor: colors.slice(0, sortedProducts.length).map(color => 
            color.replace('0.8', '1')
          ),
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12
          },
          padding: 20
        }
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 4,
      }
    }
  };

  const weeklyData = getShipmentsByWeekData();
  const productData = getPalletQtyByProductData();

  if (!weeklyData && !productData) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        color: '#718096' 
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
        <h3 style={{ margin: '0 0 1rem 0' }}>No Data to Chart</h3>
        <p>Upload shipment data to see beautiful charts and analytics.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ 
        marginBottom: '2rem', 
        color: '#2d3748',
        fontSize: '1.3rem',
        textAlign: 'center'
      }}>
        📊 {supplierName} Analytics
      </h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: weeklyData && productData ? '1fr 1fr' : '1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Shipments by Week Chart */}
        {weeklyData && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ 
              margin: '0 0 1rem 0', 
              color: '#374151',
              fontSize: '1.1rem',
              textAlign: 'center'
            }}>
              📅 Shipments by Week
            </h4>
            <div style={{ height: '300px' }}>
              <Bar data={weeklyData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Pallet Qty by Product Chart */}
        {productData && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ 
              margin: '0 0 1rem 0', 
              color: '#374151',
              fontSize: '1.1rem',
              textAlign: 'center'
            }}>
              🚛 Pallet Qty by Product
            </h4>
            <div style={{ height: '300px' }}>
              <Bar data={productData} options={chartOptions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplierCharts;