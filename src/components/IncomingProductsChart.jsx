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
  const warehouseData = useMemo(() => {
    if (!shipments || shipments.length === 0) return null;

    const groups = {};
    shipments.forEach(s => {
      const wh = s.receivingWarehouse || 'Unassigned';
      if (!groups[wh]) groups[wh] = { products: 0, quantity: 0, pallets: 0 };
      groups[wh].products += 1;
      groups[wh].quantity += Number(s.quantity) || 0;
      groups[wh].pallets += Number(s.palletQty) || 0;
    });

    const warehouses = Object.keys(groups).sort();
    return {
      warehouses,
      products: warehouses.map(w => groups[w].products),
      pallets: warehouses.map(w => Math.round(groups[w].pallets)),
    };
  }, [shipments]);

  if (!warehouseData) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-500)', fontSize: 13 }}>
        No data available
      </div>
    );
  }

  const chartData = {
    labels: warehouseData.warehouses,
    datasets: [
      {
        label: 'Products',
        data: warehouseData.products,
        backgroundColor: 'rgba(5, 150, 105, 0.7)',
        borderColor: 'rgba(5, 150, 105, 1)',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        label: 'Pallets',
        data: warehouseData.pallets,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { font: { size: 11 }, boxWidth: 12, padding: 12 },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, weight: '600' } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'var(--border)' },
        ticks: { font: { size: 11 } },
      },
    },
  };

  return (
    <div className="dash-panel" style={{ padding: 16, marginBottom: 0 }}>
      <div style={{ height: 180 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

export default IncomingProductsChart;
