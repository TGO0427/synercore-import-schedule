import React, { useState, useMemo } from 'react';
import {
  calculateAllTotals,
  formatCurrency,
  formatNumber,
} from '../utils/costingCalculations';

function CostingEstimatesTable({ estimates, isAdmin, onEdit, onDelete, onDuplicate, onGeneratePDF, onEmailEstimate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  // Filter and sort estimates (exclude archived - those show under Suppliers)
  const filteredEstimates = useMemo(() => {
    return estimates
      .filter(est => {
        // Exclude archived estimates from main view
        if (est.status === 'archived') return false;
        if (!searchTerm) return true;
        const ref = (est.reference_number || '').toLowerCase();
        const supplier = (est.supplier_name || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return ref.includes(search) || supplier.includes(search);
      })
      .sort((a, b) => {
        const refA = (a.reference_number || '').toLowerCase();
        const refB = (b.reference_number || '').toLowerCase();
        if (sortDirection === 'asc') {
          return refA.localeCompare(refB);
        }
        return refB.localeCompare(refA);
      });
  }, [estimates, searchTerm, sortDirection]);

  return (
    <div className="dash-panel" style={{ overflow: 'hidden' }}>
      {/* Search and Sort Controls */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '200px', maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Search by reference or supplier..."
            aria-label="Search import costings"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          />
        </div>
        <button
          onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
          style={{
            padding: '8px 12px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          Reference {sortDirection === 'asc' ? '↑ A-Z' : '↓ Z-A'}
        </button>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          {filteredEstimates.length} of {estimates.length} estimates
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Reference</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Supplier</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Port</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Container</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', minWidth: '280px' }}>Products</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Total Landed</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Landed Cost/KG</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEstimates.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                  {searchTerm ? 'No estimates match your search.' : 'No cost estimates yet. Create your first estimate to get started.'}
                </td>
              </tr>
            ) : (
              filteredEstimates.map((est) => {
                const totals = calculateAllTotals(est);
                const products = est.products || [];
                return (
                  <tr key={est.id} style={{ borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                    <td style={{ padding: '12px 16px', color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {est.reference_number || est.id.slice(0, 8)}
                        {est.transport_mode === 'air' && (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600', backgroundColor: '#ede9fe', color: '#7c3aed' }}>AIR</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>{est.supplier_name || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      {est.transport_mode === 'air'
                        ? (est.airport_of_arrival || '-')
                        : (est.port_of_discharge || '-')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      {est.transport_mode === 'air'
                        ? (est.airline_name || '-')
                        : (est.container_type || '-')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      {products.length === 0 ? (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No products</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {products.map((p, idx) => (
                            <div key={p._id || p.name || idx} style={{
                              padding: '6px 8px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '4px',
                              borderLeft: '3px solid #f59e0b',
                              fontSize: '0.8rem'
                            }}>
                              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '2px' }}>
                                {p.name || `Product ${idx + 1}`}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', color: '#78350f', fontSize: '0.75rem' }}>
                                {p.hs_code && <span>HS: {p.hs_code}</span>}
                                {p.pack_size && <span>Size: {p.pack_size}</span>}
                                {p.pack_type && <span>Type: {p.pack_type}</span>}
                                {p.weight_kg > 0 && <span>Wt: {formatNumber(p.weight_kg)}kg</span>}
                                {p.rate_per_kg > 0 && <span>Rate: {formatNumber(p.rate_per_kg)}/{p.currency || 'USD'}</span>}
                                {p.invoice_value > 0 && <span style={{ fontWeight: '600' }}>Val: {formatNumber(p.invoice_value)} {p.currency || 'USD'}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                      {formatCurrency(totals.total_landed_cost_zar)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500', color: '#d97706' }}>
                      {formatCurrency(totals.all_in_warehouse_cost_per_kg_zar)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500',
                        backgroundColor: est.status === 'final' ? '#dcfce7' : est.status === 'archived' ? '#f3f4f6' : '#fef3c7',
                        color: est.status === 'final' ? '#166534' : est.status === 'archived' ? '#6b7280' : '#92400e'
                      }}>
                        {est.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {isAdmin && (
                          <button
                            onClick={() => onEdit(est)}
                            style={{ padding: '6px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => onGeneratePDF(est)}
                          style={{ padding: '6px 10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => onEmailEstimate(est)}
                          style={{ padding: '6px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          Email
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onDuplicate(est.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Copy
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => onDelete(est.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CostingEstimatesTable;
