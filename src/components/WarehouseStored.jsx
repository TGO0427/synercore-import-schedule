import React, { useState, useMemo, useEffect } from 'react';
import { ShipmentStatus } from '../types/shipment';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

function WarehouseStored({ shipments, onUpdateShipment, onDeleteShipment, onArchiveShipment, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'storedDate', direction: 'desc' });
  const [archivedShipments, setArchivedShipments] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);

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
  }, []);

  const filteredAndSortedShipments = useMemo(() => {
    // Combine active stored shipments and archived stored shipments
    const allStoredShipments = [...shipments, ...archivedShipments];

    let filtered = allStoredShipments.filter(shipment => {
      const matchesSearch = searchTerm === '' ||
        shipment.orderRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.finalPod.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'storedDate') {
          aValue = new Date(aValue || a.estimatedArrival);
          bValue = new Date(bValue || b.estimatedArrival);
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
  }, [shipments, archivedShipments, searchTerm, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return '⚬';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      stored: '#28a745'
    };

    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: 'white',
        backgroundColor: statusColors[status] || '#6c757d'
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
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '1rem', color: '#2c3e50' }}>
          📋 Warehouse Storage Report
        </h2>
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
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              minWidth: '300px'
            }}
          />
          <div style={{ color: '#666', fontSize: '14px' }}>
            {filteredAndSortedShipments.length} stored shipment(s)
          </div>
        </div>
      </div>

      {filteredAndSortedShipments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h3>No stored shipments found</h3>
          <p>Shipments that have been received and stored in the warehouse will appear here for reference.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <thead style={{ backgroundColor: '#f8f9fa' }}>
              <tr>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('orderRef')}>
                  Order Ref {getSortIcon('orderRef')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('supplier')}>
                  Supplier {getSortIcon('supplier')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('productName')}>
                  Product {getSortIcon('productName')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('quantity')}>
                  Quantity {getSortIcon('quantity')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('receivingWarehouse')}>
                  Warehouse {getSortIcon('receivingWarehouse')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6',
                  cursor: 'pointer',
                  userSelect: 'none'
                }} onClick={() => handleSort('storedDate')}>
                  Stored Date {getSortIcon('storedDate')}
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Status
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'center',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedShipments.map((shipment) => (
                <tr key={shipment.id} style={{
                  borderBottom: '1px solid #dee2e6',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.closest('tr').style.backgroundColor = '#f8f9fa'}
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
                    {formatDate(shipment.storedDate || shipment.estimatedArrival)}
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
                        backgroundColor: '#6c757d'
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
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#138496'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#17a2b8'}
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