import React, { useMemo } from 'react';

/**
 * Debug panel to diagnose Supplier Performance Metrics issues
 * Shows supplier-shipment matching and metrics calculation
 */
function MetricsDebugPanel({ suppliers = [], shipments = [] }) {
  const diagnostics = useMemo(() => {
    // Log to console for debugging
    console.log('[MetricsDebugPanel] Received data:', {
      suppliersCount: suppliers.length,
      shipmentsCount: shipments.length,
      suppliers: suppliers.map(s => ({ id: s.id, name: s.name })),
      shipmentsSample: shipments.slice(0, 3).map(s => ({ supplier: s.supplier, status: s.latestStatus }))
    });

    const results = {
      totalSuppliers: suppliers.length,
      totalShipments: shipments.length,
      supplierMatches: [],
      unmatchedSuppliers: [],
      supplierNames: [...new Set(suppliers.map(s => s.name).filter(Boolean))],
      shipmentSuppliers: [...new Set(shipments.map(s => s.supplier).filter(Boolean))],
    };

    // Check each supplier's shipments
    suppliers.forEach(supplier => {
      const matchingShipments = shipments.filter(s =>
        s.supplier?.toLowerCase().trim() === supplier.name?.toLowerCase().trim()
      );

      if (matchingShipments.length > 0) {
        results.supplierMatches.push({
          supplierName: supplier.name,
          count: matchingShipments.length,
          statuses: [...new Set(matchingShipments.map(s => s.latestStatus))],
          hasArrivals: matchingShipments.some(s =>
            ['ARRIVED_PTA', 'ARRIVED_KLM', 'ARRIVED_OFFSITE', 'STORED', 'RECEIVED'].includes(s.latestStatus)
          ),
        });
      } else {
        results.unmatchedSuppliers.push(supplier.name);
      }
    });

    return results;
  }, [suppliers, shipments]);

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '2px solid #dee2e6',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '2rem',
      fontSize: '0.9rem',
      fontFamily: 'monospace'
    }}>
      <h4 style={{ marginTop: 0, color: '#2c3e50', marginBottom: '1rem' }}>
        📊 Metrics Debug Panel
      </h4>

      {/* Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', borderLeft: '4px solid #0066cc' }}>
          <div style={{ color: '#666', fontSize: '0.8rem' }}>Total Suppliers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
            {diagnostics.totalSuppliers}
          </div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', borderLeft: '4px solid #17a2b8' }}>
          <div style={{ color: '#666', fontSize: '0.8rem' }}>Total Shipments</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
            {diagnostics.totalShipments}
          </div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', borderLeft: `4px solid ${diagnostics.supplierMatches.length > 0 ? '#28a745' : '#dc3545'}` }}>
          <div style={{ color: '#666', fontSize: '0.8rem' }}>Matched Suppliers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
            {diagnostics.supplierMatches.length}
          </div>
        </div>
      </div>

      {/* Supplier Matches */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ color: '#2c3e50', marginBottom: '0.75rem' }}>✓ Suppliers with Shipments:</h5>
        {diagnostics.supplierMatches.length > 0 ? (
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '1rem',
            maxHeight: '250px',
            overflowY: 'auto'
          }}>
            {diagnostics.supplierMatches.map((match, idx) => (
              <div key={idx} style={{
                paddingBottom: '0.75rem',
                marginBottom: '0.75rem',
                borderBottom: idx < diagnostics.supplierMatches.length - 1 ? '1px solid #e9ecef' : 'none'
              }}>
                <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {match.supplierName}
                </div>
                <div style={{ color: '#666', fontSize: '0.85rem' }}>
                  Shipments: {match.count} | Has Arrivals: {match.hasArrivals ? '✓ Yes' : '✗ No'} | Statuses: {match.statuses.join(', ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            padding: '0.75rem',
            color: '#856404'
          }}>
            ⚠ No supplier shipments found. Check shipment data.
          </div>
        )}
      </div>

      {/* Unmatched Suppliers */}
      {diagnostics.unmatchedSuppliers.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h5 style={{ color: '#dc3545', marginBottom: '0.75rem' }}>✗ Suppliers without Shipments:</h5>
          <div style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            padding: '1rem'
          }}>
            {diagnostics.unmatchedSuppliers.map((name, idx) => (
              <div key={idx} style={{ color: '#721c24', marginBottom: '0.5rem' }}>
                • {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipment Suppliers vs Supplier Names */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ color: '#2c3e50', marginBottom: '0.75rem' }}>🔍 Data Source Check:</h5>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '1rem'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#2c3e50' }}>Supplier Names ({diagnostics.supplierNames.length}):</div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem' }}>
              {diagnostics.supplierNames.length > 0 ? (
                diagnostics.supplierNames.map((name, idx) => (
                  <div key={idx} style={{ color: '#666', marginBottom: '0.25rem' }}>
                    • {name}
                  </div>
                ))
              ) : (
                <div style={{ color: '#999', fontStyle: 'italic' }}>No supplier names found</div>
              )}
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '1rem'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#2c3e50' }}>Shipment Suppliers ({diagnostics.shipmentSuppliers.length}):</div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem' }}>
              {diagnostics.shipmentSuppliers.length > 0 ? (
                diagnostics.shipmentSuppliers.map((name, idx) => (
                  <div key={idx} style={{ color: '#666', marginBottom: '0.25rem' }}>
                    • {name}
                  </div>
                ))
              ) : (
                <div style={{ color: '#999', fontStyle: 'italic' }}>No shipment suppliers found</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div style={{
        backgroundColor: '#d1ecf1',
        border: '1px solid #bee5eb',
        borderRadius: '6px',
        padding: '1rem',
        color: '#0c5460'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>💡 Troubleshooting Tips:</div>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
          <li>Metrics only display for suppliers that have matching shipments</li>
          <li>Supplier names must match exactly (case-insensitive) between suppliers and shipments</li>
          <li>Check browser console for "[SupplierKPICard]" warnings if names don't match</li>
          <li>Ensure shipment data is loaded from the API</li>
          <li>Verify supplier has data before importing/creating shipments</li>
        </ul>
      </div>
    </div>
  );
}

export default MetricsDebugPanel;
