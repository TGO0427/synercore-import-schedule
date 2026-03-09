import React, { useState } from 'react';
import ResizableModal from './ResizableModal';
import { getApiUrl } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';

function ArchiveDialogs({
  showAutoArchive,
  onCloseAutoArchive,
  showManualArchive,
  onCloseManualArchive,
  selectedShipments,
  shipments,
  onArchiveComplete
}) {
  const { showSuccess, showError, showWarning, confirm: confirmAction } = useNotification();
  const [autoArchiveStats, setAutoArchiveStats] = useState(null);
  const [autoArchiveLoading, setAutoArchiveLoading] = useState(false);
  const [autoArchiveDays, setAutoArchiveDays] = useState(30);
  const [manualArchiveLoading, setManualArchiveLoading] = useState(false);

  const fetchAutoArchiveStats = async () => {
    try {
      setAutoArchiveLoading(true);
      const response = await fetch(getApiUrl(`/api/shipments/auto-archive/stats?daysOld=${autoArchiveDays}`));
      if (response.ok) {
        const stats = await response.json();
        setAutoArchiveStats(stats);
      } else {
        console.error('Failed to fetch auto-archive stats');
      }
    } catch (error) {
      console.error('Error fetching auto-archive stats:', error);
    } finally {
      setAutoArchiveLoading(false);
    }
  };

  const performAutoArchive = async () => {
    if (!autoArchiveStats?.eligibleForArchive) {
      showWarning('No shipments eligible for auto-archive.');
      return;
    }

    if (!(await confirmAction({ title: 'Archive Shipments', message: `Are you sure you want to archive ${autoArchiveStats.eligibleForArchive} old ARRIVED shipments?`, type: 'warning', confirmText: 'Archive' }))) {
      return;
    }

    try {
      setAutoArchiveLoading(true);
      const response = await fetch(getApiUrl('/api/shipments/auto-archive/perform'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ daysOld: autoArchiveDays }),
      });

      if (response.ok) {
        const result = await response.json();
        showSuccess(`Successfully archived ${result.archivedCount} shipments`);
        onCloseAutoArchive();
        setAutoArchiveStats(null);
        onArchiveComplete();
      } else {
        const error = await response.json();
        console.error('Failed to perform auto-archive:', error);
        showError('Failed to perform auto-archive. Please try again.');
      }
    } catch (error) {
      console.error('Error performing auto-archive:', error);
      showError('Error performing auto-archive. Please try again.');
    } finally {
      setAutoArchiveLoading(false);
    }
  };

  const performManualArchive = async () => {
    if (selectedShipments.length === 0) {
      showWarning('No shipments selected for archive.');
      onCloseManualArchive();
      return;
    }

    const arrivedShipments = selectedShipments.filter(id => {
      const shipment = shipments.find(s => s.id === id);
      return shipment && (shipment.latestStatus === 'arrived_pta' || shipment.latestStatus === 'arrived_klm' || shipment.latestStatus === 'arrived_offsite');
    });

    if (arrivedShipments.length === 0) {
      showWarning('No ARRIVED shipments selected for archive.');
      onCloseManualArchive();
      return;
    }

    try {
      setManualArchiveLoading(true);
      const response = await fetch(getApiUrl('/api/shipments/manual-archive'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipmentIds: arrivedShipments }),
      });

      if (response.ok) {
        const result = await response.json();
        showSuccess(`Successfully archived ${result.archivedCount} shipments`);
        onCloseManualArchive();
        onArchiveComplete();
      } else {
        const error = await response.json();
        console.error('Failed to perform manual archive:', error);
        showError('Failed to perform manual archive. Please try again.');
      }
    } catch (error) {
      console.error('Error performing manual archive:', error);
      showError('Error performing manual archive. Please try again.');
    } finally {
      setManualArchiveLoading(false);
    }
  };

  return (
    <>
      {/* Auto-Archive Dialog */}
      {showAutoArchive && (
        <ResizableModal
          title="Auto-Archive Old ARRIVED Shipments"
          isOpen={showAutoArchive}
          onClose={() => {
            onCloseAutoArchive();
            setAutoArchiveStats(null);
          }}
          initialWidth={600}
          minWidth={400}
          minHeight={300}
        >
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                Archive shipments older than (days):
              </label>
              <input
                type="number"
                value={autoArchiveDays}
                onChange={(e) => setAutoArchiveDays(parseInt(e.target.value) || 30)}
                className="input"
                style={{
                  width: '100px'
                }}
                min="1"
                max="365"
              />
              <span style={{ marginLeft: '0.5rem', color: 'var(--text-500)', fontSize: '0.9rem' }}>
                days
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={fetchAutoArchiveStats}
                disabled={autoArchiveLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: autoArchiveLoading ? '#ccc' : '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: autoArchiveLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {autoArchiveLoading ? '\uD83D\uDD04 Loading...' : '\uD83D\uDD0D Check Eligible Shipments'}
              </button>
            </div>

            {autoArchiveStats && (
              <div style={{
                backgroundColor: 'var(--surface-2)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #e9ecef'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-900)' }}>Archive Statistics</h4>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Eligible for archive:</strong> {autoArchiveStats.eligibleForArchive} shipments
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Total ARRIVED:</strong> {autoArchiveStats.totalArrived} shipments
                </div>

                {autoArchiveStats.eligibleShipments.length > 0 && (
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-500)' }}>Shipments to be archived:</h5>
                    <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                      {autoArchiveStats.eligibleShipments.map((shipment, index) => (
                        <div key={shipment.id || shipment.orderRef || index} style={{
                          padding: '0.5rem',
                          backgroundColor: 'white',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          marginBottom: '0.25rem',
                          fontSize: '0.85rem'
                        }}>
                          <div><strong>{shipment.supplier}</strong> - {shipment.orderRef}</div>
                          <div style={{ color: 'var(--text-500)' }}>
                            Arrived: {new Date(shipment.arrivedDate).toLocaleDateString()}
                            ({shipment.daysOld} days ago)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  onCloseAutoArchive();
                  setAutoArchiveStats(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>

              {autoArchiveStats?.eligibleForArchive > 0 && (
                <button
                  onClick={performAutoArchive}
                  disabled={autoArchiveLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: autoArchiveLoading ? '#ccc' : 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: autoArchiveLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {autoArchiveLoading ? '\uD83D\uDD04 Archiving...' : `\uD83D\uDCC1 Archive ${autoArchiveStats.eligibleForArchive} Shipments`}
                </button>
              )}
            </div>
        </ResizableModal>
      )}

      {/* Manual Archive Dialog */}
      {showManualArchive && (
        <ResizableModal
          title="Manual Archive Confirmation"
          isOpen={showManualArchive}
          onClose={onCloseManualArchive}
          initialWidth={500}
          minWidth={350}
          minHeight={250}
        >
            <p>
              You are about to archive <strong>{selectedShipments.length}</strong> selected ARRIVED shipments.
              This action cannot be undone.
            </p>
            <p>The shipments will be removed from the active list and saved to an archive file.</p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                onClick={onCloseManualArchive}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={manualArchiveLoading}
              >
                Cancel
              </button>
              <button
                onClick={performManualArchive}
                disabled={manualArchiveLoading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: manualArchiveLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {manualArchiveLoading ? '\uD83D\uDD04 Archiving...' : `\uD83D\uDCC1 Archive ${selectedShipments.length} Shipments`}
              </button>
            </div>
        </ResizableModal>
      )}
    </>
  );
}

export default ArchiveDialogs;
