import React, { useState } from 'react';
import { ShipmentStatus } from '../types/shipment';

function BulkStatusUpdate({ shipments, onBulkUpdate, onClose }) {
  const [selectedShipmentIds, setSelectedShipmentIds] = useState([]);
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSelectShipment = (id) => {
    setSelectedShipmentIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedShipmentIds.length === shipments.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(shipments.map(s => s.id));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedShipmentIds.length === 0 || !newStatus) {
      alert('Please select shipments and a new status');
      return;
    }
    setShowConfirmation(true);
  };

  const confirmUpdate = async () => {
    try {
      setIsUpdating(true);
      setShowConfirmation(false);
      await onBulkUpdate(selectedShipmentIds, newStatus);
      setSelectedShipmentIds([]);
      setNewStatus('');
      onClose();
    } catch (error) {
      alert(`Error updating shipments: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusOptions = Object.values(ShipmentStatus);
  const filteredShipments = shipments.filter(s => s.latestStatus); // Only show shipments with status

  return (
    <>
      {/* Modal Background */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>📦 Bulk Status Update</h2>
            <button
              onClick={onClose}
              disabled={isUpdating}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ✕
            </button>
          </div>

          {/* Status Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Select New Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              disabled={isUpdating}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '1rem'
              }}
            >
              <option value="">-- Choose a status --</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Shipment Selection Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontWeight: '500' }}>
                Select Shipments ({selectedShipmentIds.length} of {filteredShipments.length})
              </label>
              <button
                onClick={handleSelectAll}
                disabled={isUpdating}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => !isUpdating && (e.target.style.backgroundColor = '#5a6268')}
                onMouseLeave={(e) => !isUpdating && (e.target.style.backgroundColor = '#6c757d')}
              >
                {selectedShipmentIds.length === filteredShipments.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div style={{
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              maxHeight: '400px',
              overflowY: 'auto',
              backgroundColor: '#fff'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      borderBottom: '1px solid #dee2e6',
                      width: '50px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedShipmentIds.length === filteredShipments.length && filteredShipments.length > 0}
                        onChange={handleSelectAll}
                        disabled={isUpdating}
                      />
                    </th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid #dee2e6',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      Order Ref
                    </th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid #dee2e6',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      Supplier
                    </th>
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid #dee2e6',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      Current Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.map((shipment) => (
                    <tr key={shipment.id} style={{
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: selectedShipmentIds.includes(shipment.id) ? '#f0f7ff' : 'white',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => !selectedShipmentIds.includes(shipment.id) && (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                    onMouseLeave={(e) => !selectedShipmentIds.includes(shipment.id) && (e.currentTarget.style.backgroundColor = 'white')}>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedShipmentIds.includes(shipment.id)}
                          onChange={() => handleSelectShipment(shipment.id)}
                          disabled={isUpdating}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '13px', fontWeight: '500' }}>
                        {shipment.orderRef}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '13px' }}>
                        {shipment.supplier}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '13px' }}>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#e2e8f0',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          {shipment.latestStatus.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isUpdating}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => !isUpdating && (e.target.style.backgroundColor = '#5a6268')}
              onMouseLeave={(e) => !isUpdating && (e.target.style.backgroundColor = '#6c757d')}
            >
              Cancel
            </button>
            <button
              onClick={handleBulkUpdate}
              disabled={isUpdating || selectedShipmentIds.length === 0 || !newStatus}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: (isUpdating || selectedShipmentIds.length === 0 || !newStatus) ? '#ccc' : '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (isUpdating || selectedShipmentIds.length === 0 || !newStatus) ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => !isUpdating && selectedShipmentIds.length > 0 && newStatus && (e.target.style.backgroundColor = '#0052a3')}
              onMouseLeave={(e) => !isUpdating && selectedShipmentIds.length > 0 && newStatus && (e.target.style.backgroundColor = '#0066cc')}
            >
              {isUpdating ? 'Updating...' : `Update ${selectedShipmentIds.length} Shipment${selectedShipmentIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Confirm Bulk Update</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#666', lineHeight: '1.5' }}>
              You are about to update <strong>{selectedShipmentIds.length} shipment(s)</strong> to status <strong>{newStatus.replace(/_/g, ' ').toUpperCase()}</strong>.
            </p>
            <p style={{ margin: '0 0 1.5rem 0', color: '#999', fontSize: '13px' }}>
              This action cannot be undone. Please verify the details above.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isUpdating}
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
                onClick={confirmUpdate}
                disabled={isUpdating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isUpdating ? '#ccc' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => !isUpdating && (e.target.style.backgroundColor = '#c82333')}
                onMouseLeave={(e) => !isUpdating && (e.target.style.backgroundColor = '#dc3545')}
              >
                {isUpdating ? 'Updating...' : 'Yes, Update Shipments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BulkStatusUpdate;
