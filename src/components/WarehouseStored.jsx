import React, { useState, useMemo, useEffect } from 'react';
import { ShipmentStatus } from '../types/shipment';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

function WarehouseStored({ shipments, onUpdateShipment, onDeleteShipment, onArchiveShipment, loading, showSuccess, showError }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [weekFilters, setWeekFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'storedDate', direction: 'desc' });
  const [archivedShipments, setArchivedShipments] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [archivingAll, setArchivingAll] = useState(false);

  // Fetch archived shipments
  useEffect(() => {
    const fetchArchivedShipments = async () => {
      try {
        setLoadingArchives(true);
        const response = await authFetch(getApiUrl('/api/shipments/archives'));
        if (!response.ok) return;

        const archives = await response.json();
        const allArchivedShipments = [];

        // Fetch each archive and extract shipments with 'stored' status
        for (const archive of archives) {
          try {
            const archiveResponse = await authFetch(getApiUrl(`/api/shipments/archives/${archive.fileName}`));
            if (!archiveResponse.ok) continue;

            const archiveData = await archiveResponse.json();
            if (archiveData && archiveData.data) {
              // Filter archived shipments that have 'stored' status
              const storedArchivedShipments = archiveData.data.filter(shipment =>
                shipment.latestStatus === 'stored'
              );

              // Mark as archived and add source
              storedArchivedShipments.forEach(shipment => {
                shipment.isArchived = true;
                shipment.archiveSource = archive.fileName;
              });

              allArchivedShipments.push(...storedArchivedShipments);
            }
          } catch (error) {
            console.error(`Error fetching archive ${archive.fileName}:`, error);
          }
        }

        setArchivedShipments(allArchivedShipments);
      } catch (error) {
        console.error('Error fetching archives:', error);
      } finally {
        setLoadingArchives(false);
      }
    };

    fetchArchivedShipments();

    // Refresh archived shipments every 10 seconds to pick up updates from Archive Edit
    const interval = setInterval(fetchArchivedShipments, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredAndSortedShipments = useMemo(() => {
    // Combine active stored shipments and archived stored shipments
    const allStoredShipments = [...shipments, ...archivedShipments];

    let filtered = allStoredShipments.filter(shipment => {
      const matchesSearch = searchTerm === '' ||
        shipment.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.finalPod?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesWeek = weekFilters.length === 0 || weekFilters.includes(shipment.weekNumber);

      return matchesSearch && matchesWeek;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'storedDate') {
          aValue = new Date(a.receivingDate || a.updatedAt || a.estimatedArrival);
          bValue = new Date(b.receivingDate || b.updatedAt || b.estimatedArrival);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [shipments, archivedShipments, searchTerm, weekFilters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleWeekFilter = (week) => {
    setWeekFilters(prev =>
      prev.includes(week)
        ? prev.filter(w => w !== week)
        : [...prev, week]
    );
  };

  const availableWeeks = useMemo(() => {
    const allShipments = [...shipments, ...archivedShipments];
    return [...new Set(allShipments.map(s => s.weekNumber))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));
  }, [shipments, archivedShipments]);

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return '⚬';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      stored: 'var(--success)'
    };

    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: 'white',
        backgroundColor: statusColors[status] || 'var(--text-500)'
      }}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Get count of non-archived shipments (active shipments that can be archived)
  const activeShipmentsCount = shipments.length;

  const handleArchiveAll = async () => {
    if (activeShipmentsCount === 0) return;

    const confirmArchive = window.confirm(
      `Are you sure you want to archive all ${activeShipmentsCount} stored shipment(s)?\n\nThis will move them to the archive for record-keeping.`
    );

    if (!confirmArchive) return;

    setArchivingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const shipment of shipments) {
      try {
        if (onArchiveShipment) {
          await onArchiveShipment(shipment.id);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to archive shipment ${shipment.orderRef}:`, error);
        failCount++;
      }
    }

    setArchivingAll(false);

    if (successCount > 0 && showSuccess) {
      showSuccess(`✅ Successfully archived ${successCount} shipment(s)`);
    }
    if (failCount > 0 && showError) {
      showError(`❌ Failed to archive ${failCount} shipment(s)`);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px'
      }}>
        <div>Loading stored shipments...</div>
      </div>
    );
  }

  return (
    <div className="window-content">
      <div className="brand-strip" />
      <div style={{ marginBottom: '1rem' }}>
        <div className="page-header">
          <h2>Warehouse Storage Report</h2>
        </div>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <input
            type="text"
            placeholder="Search stored shipments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '14px',
              minWidth: '300px'
            }}
          />
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowWeekDropdown(!showWeekDropdown)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--surface-2)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📅 Week {weekFilters.length > 0 ? `(${weekFilters.length})` : ''}
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>
            {showWeekDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: 'white',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                minWidth: '120px',
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                {availableWeeks.map(week => (
                  <label key={week} style={{
                    display: 'block',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '14px',
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={weekFilters.includes(week)}
                      onChange={() => toggleWeekFilter(week)}
                      style={{ marginRight: '8px' }}
                    />
                    Week {week}
                  </label>
                ))}
                {availableWeeks.length === 0 && (
                  <div style={{ padding: '12px', color: 'var(--text-500)', textAlign: 'center' }}>
                    No weeks available
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ color: 'var(--text-500)', fontSize: '14px' }}>
            {filteredAndSortedShipments.length} stored shipment(s)
            {activeShipmentsCount > 0 && (
              <span style={{ color: 'var(--info)', marginLeft: '8px' }}>
                ({activeShipmentsCount} active)
              </span>
            )}
          </div>
          {activeShipmentsCount > 0 && (
            <button
              onClick={handleArchiveAll}
              disabled={archivingAll}
              style={{
                padding: '8px 16px',
                backgroundColor: archivingAll ? 'var(--text-500)' : 'var(--info)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: archivingAll ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: 'auto'
              }}
              onMouseEnter={(e) => !archivingAll && (e.target.style.backgroundColor = 'var(--accent-600)')}
              onMouseLeave={(e) => !archivingAll && (e.target.style.backgroundColor = 'var(--info)')}
            >
              {archivingAll ? (
                <>⏳ Archiving...</>
              ) : (
                <>📦 Archive All ({activeShipmentsCount})</>
              )}
            </button>
          )}
        </div>
      </div>

      {filteredAndSortedShipments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--text-500)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3>No stored shipments found</h3>
          <p>Shipments that have been received and stored in the warehouse will appear here for reference.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="dash-panel" style={{
            width: '100%',
            borderCollapse: 'collapse',
            padding: 0,
            overflow: 'hidden'
          }}>
            <thead style={{ backgroundColor: 'var(--surface-2)' }}>
              <tr>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('orderRef')}>
                  Order Ref {getSortIcon('orderRef')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('supplier')}>
                  Supplier {getSortIcon('supplier')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('productName')}>
                  Product {getSortIcon('productName')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('quantity')}>
                  Quantity {getSortIcon('quantity')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('receivingWarehouse')}>
                  Warehouse {getSortIcon('receivingWarehouse')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('storedDate')}>
                  Stored Date {getSortIcon('storedDate')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)'
                }}>
                  Status
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--border)'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedShipments.map((shipment) => (
                <tr key={shipment.id} style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.closest('tr').style.backgroundColor = 'var(--surface-2)'}
                onMouseLeave={(e) => e.target.closest('tr').style.backgroundColor = 'white'}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    {shipment.orderRef}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {shipment.supplier}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {shipment.productName || 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {shipment.quantity ? `${shipment.quantity} units` : 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {shipment.receivingWarehouse || 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {formatDate(shipment.receivingDate || shipment.updatedAt || shipment.estimatedArrival)}
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {getStatusBadge(shipment.latestStatus)}
                    {shipment.isArchived && (
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: 'var(--text-500)'
                      }}>
                        ARCHIVED
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => onArchiveShipment ? onArchiveShipment(shipment.id) : onDeleteShipment(shipment.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--info)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--accent-600)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--info)'}
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default WarehouseStored;