import React from 'react';

function ImportValidationPreview({ errors, preview, validCount, onProceed, onCancel, loading }) {
  const hasErrors = errors && errors.length > 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', color: hasErrors ? '#dc3545' : '#28a745' }}>
          {hasErrors ? '⚠️ Validation Issues Found' : '✅ File is Valid'}
        </h2>

        {hasErrors ? (
          <div>
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#856404' }}>
                Found {errors.length} error(s) in your file:
              </p>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                fontSize: '14px'
              }}>
                {errors.slice(0, 20).map((error, idx) => (
                  <div key={idx} style={{
                    padding: '0.5rem',
                    borderBottom: idx < 19 ? '1px solid #ffeaa7' : 'none',
                    color: '#856404'
                  }}>
                    <strong>Row {error.rowIndex}</strong> ({error.column}): {error.message}
                  </div>
                ))}
                {errors.length > 20 && (
                  <div style={{ padding: '0.5rem', color: '#856404', fontStyle: 'italic' }}>
                    ... and {errors.length - 20} more error(s)
                  </div>
                )}
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Common fixes:</p>
              <ul style={{ margin: '0', paddingLeft: '1.5rem', fontSize: '14px', color: '#666' }}>
                <li>Supplier and Order Reference columns are required</li>
                <li>Quantity must be a positive number</li>
                <li>Week Number should be between 1 and 53</li>
                <li>Warehouse must be PRETORIA, KLAPMUTS, or OFFSITE</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#c82333'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#dc3545'}
              >
                Fix Errors & Retry
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#155724'
            }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>
                ✓ {validCount} shipment(s) ready to import
              </p>
            </div>

            <div style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>Preview (first 5 rows):</p>
              <div style={{
                overflowX: 'auto',
                fontSize: '13px'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: 'white'
                }}>
                  <thead style={{ backgroundColor: '#f8f9fa' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Supplier</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Order Ref</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Product</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Qty</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Week</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Warehouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview && preview.slice(0, 5).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '0.5rem' }}>{item.supplier || item.Supplier || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{item.orderRef || item['ORDER/REF'] || item['Order/Ref'] || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{item.productName || item['PRODUCT NAME'] || item['Product Name'] || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{item.quantity || item['QUANTITY'] || item['Quantity'] || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{item.weekNumber || item['WEEK NUMBER'] || item['Week Number'] || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{item.receivingWarehouse || item['RECEIVING WAREHOUSE'] || item['Warehouse'] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={onProceed}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#218838')}
                onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#28a745')}
              >
                {loading ? 'Importing...' : 'Proceed with Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportValidationPreview;
