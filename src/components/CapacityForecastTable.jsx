import React, { useMemo } from 'react';
import { CapacityForecast } from '../utils/capacityForecast';

function CapacityForecastTable({ shipments, currentBinsUsed }) {
  const forecast = useMemo(() => {
    return CapacityForecast.generateForecast(shipments, currentBinsUsed);
  }, [shipments, currentBinsUsed]);

  const getAlertColor = (alert) => CapacityForecast.getAlertColor(alert);
  const getAlertLabel = (alert) => CapacityForecast.getAlertLabel(alert);

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
          📈 8-Week Capacity Forecast
        </h3>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
          Projected bin usage based on planned incoming shipments
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
              <th style={{
                padding: '1rem',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                PRETORIA
              </th>
              <th style={{
                padding: '1rem',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                KLAPMUTS
              </th>
              <th style={{
                padding: '1rem',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Offsite
              </th>
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
                {/* Week Label */}
                <td style={{
                  padding: '1rem',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  {week.label}
                </td>

                {/* PRETORIA */}
                <td style={{
                  padding: '1rem',
                  textAlign: 'center',
                  borderLeft: `4px solid ${getAlertColor(week.warehouses['PRETORIA'].alert)}`
                }}>
                  <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                    {week.warehouses['PRETORIA'].projectedBinsUsed}/{week.warehouses['PRETORIA'].capacity}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: getAlertColor(week.warehouses['PRETORIA'].alert),
                    fontWeight: '500'
                  }}>
                    {week.warehouses['PRETORIA'].percentUsed}%
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
                        width: `${Math.min(100, week.warehouses['PRETORIA'].percentUsed)}%`,
                        height: '100%',
                        backgroundColor: getAlertColor(week.warehouses['PRETORIA'].alert),
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </td>

                {/* KLAPMUTS */}
                <td style={{
                  padding: '1rem',
                  textAlign: 'center',
                  borderLeft: `4px solid ${getAlertColor(week.warehouses['KLAPMUTS'].alert)}`
                }}>
                  <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                    {week.warehouses['KLAPMUTS'].projectedBinsUsed}/{week.warehouses['KLAPMUTS'].capacity}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: getAlertColor(week.warehouses['KLAPMUTS'].alert),
                    fontWeight: '500'
                  }}>
                    {week.warehouses['KLAPMUTS'].percentUsed}%
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
                        width: `${Math.min(100, week.warehouses['KLAPMUTS'].percentUsed)}%`,
                        height: '100%',
                        backgroundColor: getAlertColor(week.warehouses['KLAPMUTS'].alert),
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </td>

                {/* Offsite */}
                <td style={{
                  padding: '1rem',
                  textAlign: 'center',
                  borderLeft: `4px solid ${getAlertColor(week.warehouses['Offsite'].alert)}`
                }}>
                  <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                    {week.warehouses['Offsite'].projectedBinsUsed}/{week.warehouses['Offsite'].capacity}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: getAlertColor(week.warehouses['Offsite'].alert),
                    fontWeight: '500'
                  }}>
                    {week.warehouses['Offsite'].percentUsed}%
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
                        width: `${Math.min(100, week.warehouses['Offsite'].percentUsed)}%`,
                        height: '100%',
                        backgroundColor: getAlertColor(week.warehouses['Offsite'].alert),
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </td>

                {/* Alert & Recommendation */}
                <td style={{
                  padding: '1rem',
                  textAlign: 'left'
                }}>
                  {week.totalAlert !== 'ok' && (
                    <div style={{
                      backgroundColor: getAlertColor(week.totalAlert) + '15',
                      border: `1px solid ${getAlertColor(week.totalAlert)}`,
                      borderRadius: '4px',
                      padding: '0.5rem',
                      color: '#2c3e50'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        color: getAlertColor(week.totalAlert),
                        marginBottom: '0.25rem'
                      }}>
                        {getAlertLabel(week.totalAlert)}
                      </div>
                      {week.recommendation && (
                        <div style={{ fontSize: '0.85rem' }}>
                          {week.recommendation.message}
                          {week.recommendation.action && (
                            <div style={{ marginTop: '0.25rem', color: '#666' }}>
                              → {week.recommendation.action}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {week.totalAlert === 'ok' && (
                    <div style={{ color: '#28a745', fontWeight: '500' }}>
                      ✓ All warehouses operating normally
                    </div>
                  )}
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
        <strong>📌 Legend:</strong>
        <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div>🟢 <strong>OK</strong>: &lt; 80% capacity</div>
          <div>🟡 <strong>WARNING</strong>: 80-95% capacity</div>
          <div>🔴 <strong>CRITICAL</strong>: 95-100% capacity</div>
          <div>🔴 <strong>OVERFLOW</strong>: &gt; 100% capacity</div>
        </div>
      </div>
    </div>
  );
}

export default CapacityForecastTable;
