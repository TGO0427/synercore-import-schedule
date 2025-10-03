import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function IncomingProductsChart({ shipments }) {
  const chartData = useMemo(() => {
    if (!shipments || shipments.length === 0) {
      return null;
    }

    // Group data by warehouse
    const warehouseData = {};

    shipments.forEach(shipment => {
      const warehouse = shipment.receivingWarehouse || 'Unassigned';

      if (!warehouseData[warehouse]) {
        warehouseData[warehouse] = {
          productCount: 0,
          totalQuantity: 0,
          totalPallets: 0,
          products: new Set()
        };
      }

      warehouseData[warehouse].productCount += 1;
      warehouseData[warehouse].totalQuantity += Number(shipment.quantity) || 0;
      warehouseData[warehouse].totalPallets += Number(shipment.palletQty) || 0;
      warehouseData[warehouse].products.add(shipment.productName || 'Unknown');
    });

    // Convert to arrays for Chart.js
    const warehouses = Object.keys(warehouseData).sort();
    const productCounts = warehouses.map(w => warehouseData[w].productCount);
    const quantities = warehouses.map(w => warehouseData[w].totalQuantity);
    const pallets = warehouses.map(w => Math.round(warehouseData[w].totalPallets));

    // Generate colors for warehouses
    const colors = [
      'rgba(54, 162, 235, 0.8)',   // Blue
      'rgba(255, 99, 132, 0.8)',   // Red
      'rgba(255, 205, 86, 0.8)',   // Yellow
      'rgba(75, 192, 192, 0.8)',   // Teal
      'rgba(153, 102, 255, 0.8)',  // Purple
      'rgba(255, 159, 64, 0.8)',   // Orange
      'rgba(199, 199, 199, 0.8)',  // Grey
      'rgba(83, 102, 255, 0.8)',   // Indigo
    ];

    const borderColors = colors.map(color => color.replace('0.8', '1'));

    return {
      labels: warehouses,
      datasets: [
        {
          label: 'Number of Products',
          data: productCounts,
          backgroundColor: colors[0],
          borderColor: borderColors[0],
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          label: 'Total Quantity',
          data: quantities,
          backgroundColor: colors[1],
          borderColor: borderColors[1],
          borderWidth: 1,
          yAxisID: 'y1',
        },
        {
          label: 'Total Pallets',
          data: pallets,
          backgroundColor: colors[2],
          borderColor: borderColors[2],
          borderWidth: 1,
          yAxisID: 'y2',
        },
      ],
    };
  }, [shipments]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: 'Incoming Products by Receiving Warehouse',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;

            if (label === 'Number of Products') {
              return `${label}: ${value} products`;
            } else if (label === 'Total Quantity') {
              return `${label}: ${value.toLocaleString()} units`;
            } else if (label === 'Total Pallets') {
              return `${label}: ${value} pallets`;
            }
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Receiving Warehouse',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Number of Products',
          color: 'rgba(54, 162, 235, 1)',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        ticks: {
          color: 'rgba(54, 162, 235, 1)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Total Quantity',
          color: 'rgba(255, 99, 132, 1)',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        ticks: {
          color: 'rgba(255, 99, 132, 1)',
          callback: function(value) {
            return value.toLocaleString();
          }
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y2: {
        type: 'linear',
        display: false, // Hide this axis to avoid clutter
        position: 'right',
      },
    },
  };

  if (!chartData) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <p style={{ margin: 0, color: '#6c757d' }}>No data available for chart</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginBottom: '2rem'
    }}>
      <div style={{ height: '400px' }}>
        <Bar data={chartData} options={options} />
      </div>

      {/* Summary stats below chart */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#007bff' }}>
            {chartData.labels.length}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>Warehouses</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
            {chartData.datasets[0].data.reduce((sum, val) => sum + val, 0)}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>Total Products</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc3545' }}>
            {chartData.datasets[1].data.reduce((sum, val) => sum + val, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>Total Quantity</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffc107' }}>
            {chartData.datasets[2].data.reduce((sum, val) => sum + val, 0)}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>Total Pallets</div>
        </div>
      </div>
    </div>
  );
}

export default IncomingProductsChart;