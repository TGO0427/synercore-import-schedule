import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function IncomingProductsChart({ shipments }) {
  const weeklyData = useMemo(() => {
    if (!shipments || shipments.length === 0) return null;

    const weeks = {};
    shipments.forEach(s => {
      const wk = Number(s.weekNumber) || 0;
      if (wk === 0) return;
      if (!weeks[wk]) weeks[wk] = { products: 0, pallets: 0 };
      weeks[wk].products += 1;
      weeks[wk].pallets += Math.round(Number(s.palletQty) || 0);
    });

    const sorted = Object.keys(weeks).map(Number).sort((a, b) => a - b);
    if (sorted.length === 0) return null;

    return {
      labels: sorted.map(w => `W${w}`),
      products: sorted.map(w => weeks[w].products),
      pallets: sorted.map(w => weeks[w].pallets),
    };
  }, [shipments]);

  if (!weeklyData) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-500)', fontSize: 13 }}>
        No data available
      </div>
    );
  }

  const chartData = {
    labels: weeklyData.labels,
    datasets: [
      {
        label: 'Products',
        data: weeklyData.products,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        pointBackgroundColor: 'white',
        pointBorderColor: 'rgba(59, 130, 246, 1)',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2.5,
        tension: 0.35,
        fill: false,
      },
      {
        label: 'Pallets',
        data: weeklyData.pallets,
        borderColor: 'rgba(5, 150, 105, 1)',
        backgroundColor: 'rgba(5, 150, 105, 0.05)',
        pointBackgroundColor: 'white',
        pointBorderColor: 'rgba(5, 150, 105, 1)',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2.5,
        tension: 0.35,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          font: { size: 12, weight: '500' },
          color: 'var(--text-500)',
          boxWidth: 10,
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: true,
        text: 'Weekly Trend',
        align: 'start',
        font: { size: 14, weight: '700' },
        color: 'var(--navy-900)',
        padding: { bottom: 4 },
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: 'var(--navy-900)',
        bodyColor: 'var(--text-700)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 10,
        bodyFont: { size: 12 },
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { font: { size: 12, weight: '500' }, color: 'var(--text-500)' },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { font: { size: 11 }, color: 'var(--text-500)', stepSize: undefined },
      },
    },
  };

  return (
    <div className="dash-panel" style={{ padding: 16, marginBottom: 0 }}>
      <div style={{ height: 200 }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default IncomingProductsChart;
