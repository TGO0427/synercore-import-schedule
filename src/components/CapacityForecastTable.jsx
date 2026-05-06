import React, { useMemo } from 'react';
import { CapacityForecast } from '../utils/capacityForecast';

const WAREHOUSE_NAMES = ['PRETORIA', 'KLAPMUTS', 'OFFSITE'];

function CapacityForecastTable({ shipments, currentBinsUsed, warehouseCapacities, selectedWarehouse = 'all' }) {
  const forecast = useMemo(() => {
    return CapacityForecast.generateForecast(shipments, currentBinsUsed, warehouseCapacities);
  }, [shipments, currentBinsUsed, warehouseCapacities]);

  const visibleWarehouses = selectedWarehouse === 'all'
    ? WAREHOUSE_NAMES
    : WAREHOUSE_NAMES.filter(name => name === selectedWarehouse);

  const getAlertColor = (alert) => CapacityForecast.getAlertColor(alert);
  const getAlertLabel = (alert) => CapacityForecast.getAlertLabel(alert);

  const getSiteRecommendation = (week, warehouse) => {
    const siteData = week.warehouses[warehouse];
    if (!siteData) return null;

    if (siteData.alert === 'overflow') {
      const overflow = siteData.projectedBinsUsed - siteData.capacity;
      return `${warehouse} will exceed capacity by ${overflow} bins. Urgent action needed.`;
    }

    if (siteData.alert === 'critical') {
      return `${warehouse} is critical at ${siteData.percentUsed}% capacity.`;
    }

    if (siteData.alert === 'warning') {
      return `${warehouse} is approaching capacity at ${siteData.percentUsed}%.`;
    }

    return null;
  };

  const getRowAlert = (week) => {
    if (selectedWarehouse === 'all') return week.totalAlert;
    return week.warehouses[selectedWarehouse]?.alert || 'ok';
  };

  const renderWarehouseCell = (week, warehouse) => {
    const data = week.warehouses[warehouse];
    if (!data) return null;

    return (
      <td
        key={warehouse}
        style={{
          padding: '1rem',
          textAlign: 'center',
          borderLeft: `4px solid ${getAlertColor(data.alert)}`
        }}
      >
        <div style={{ fontWeight: '600', color: '#2c3e50' }}>
          {data.projectedBinsUsed}/{data.capacity}
        </div>
        <div style={{
          fontSize: '0.8rem',
          color: getAlertColor(data.alert),
          fontWeight: '500'
        }}>
          {data.percentUsed}%
        </div>
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#e9ecef',
          borderRadius: '2px',
          marginTop: '0.25rem',
          overflow: 'hidden'
        }}>
          <div
            style={{
              width: `${Math.min(100, data.percentUsed)}%`,
              height: '100%',
              backgroundColor: getAlertColor(data.alert),
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </td>
    );
  };

  const renderRecommendation = (week) => {
    const rowAlert = getRowAlert(week);
    const recommendation = selectedWarehouse === 'all'
      ? week.recommendation?.message
      : getSiteRecommendation(week, selectedWarehouse);
    const action = selectedWarehouse === 'all' ? week.recommendation?.action : null;

    if (rowAlert === 'ok') {
      return (
        <div style={{ color: '#28a745', fontWeight: '500' }}>
          {selectedWarehouse === 'all'
            ? 'All warehouses operating normally'
            : `${selectedWarehouse} operating normally`}
        </div>
      );
    }

    return (
      <div style={{
        backgroundColor: getAlertColor(rowAlert) + '15',
        border: `1px solid ${getAlertColor(rowAlert)}`,
        borderRadius: '4px',
        padding: '0.5rem',
        color: '#2c3e50'
      }}>
        <div style={{
          fontWeight: '600',
          color: getAlertColor(rowAlert),
          marginBottom: '0.25rem'
        }}>
          {getAlertLabel(rowAlert)}
        </div>
        {recommendation && (
          <div style={{ fontSize: '0.85rem' }}>
            {recommendation}
            {action && (
              <div style={{ marginTop: '0.25rem', color: '#666' }}>
                {action}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      overflow: 'hidden',
      marginTop: '1.5rem'
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa'
      }}>
        <h3 style={{ margin: 0, color: '#2c3e50' }}>
          8-Week Capacity Forecast
        </h3>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
          {selectedWarehouse === 'all'
            ? 'Projected bin usage based on planned incoming shipments'
            : `Projected bin usage for ${selectedWarehouse} based on planned incoming shipments`}
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem'
        }}>
          <thead style={{ backgroundColor: '#f8f9fa' }}>
            <tr>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                color: '#2c3e50',
                width: '80px'
              }}>
                Week
              </th>
              {visibleWarehouses.map(warehouse => (
                <th
                  key={warehouse}
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    borderBottom: '2px solid #dee2e6',
                    fontWeight: '600',
                    color: '#2c3e50'
                  }}
                >
                  {warehouse}
                </th>
              ))}
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Alert & Recommendation
              </th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((week, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f4f8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f8f9fa'}
              >
                <td style={{
                  padding: '1rem',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  {week.label}
                </td>
                {visibleWarehouses.map(warehouse => renderWarehouseCell(week, warehouse))}
                <td style={{
                  padding: '1rem',
                  textAlign: 'left'
                }}>
                  {renderRecommendation(week)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '0.85rem',
        color: '#666'
      }}>
        <strong>Legend:</strong>
        <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: '1rem' }}>
          <div><strong style={{ color: '#28a745' }}>OK</strong>: &lt; 80% capacity</div>
          <div><strong style={{ color: '#ffc107' }}>WARNING</strong>: 80-95% capacity</div>
          <div><strong style={{ color: '#fd7e14' }}>CRITICAL</strong>: 95-100% capacity</div>
          <div><strong style={{ color: '#dc3545' }}>OVERFLOW</strong>: &gt; 100% capacity</div>
        </div>
      </div>
    </div>
  );
}

export default CapacityForecastTable;
