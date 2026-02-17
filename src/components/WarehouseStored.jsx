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
  const [collapsedWarehouses, setCollapsedWarehouses] = useState({});
  const [editingWarehouse, setEditingWarehouse] = useState(null); // shipment id being edited
  const [editingDate, setEditingDate] = useState(null); // shipment id being date-edited
  const [editingDateValue, setEditingDateValue] = useState(''); // temp date value while editing

  // Fetch archived shipments
  useEffect(() => {
    const fetchArchivedShipments = async () => {
      try {
        setLoadingArchives(true);
        const response = await authFetch(getApiUrl('/api/shipments/archives'));
        if (!response.ok) return;

        const archives = await response.json();
        const allArchivedShipments = [];

        for (const archive of archives) {
          try {
            const archiveResponse = await authFetch(getApiUrl(`/api/shipments/archives/${archive.fileName}`));
            if (!archiveResponse.ok) continue;

            const archiveData = await archiveResponse.json();
            if (archiveData && archiveData.data) {
              const storedArchivedShipments = archiveData.data.filter(shipment =>
                shipment.latestStatus === 'stored'
              );
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
    const interval = setInterval(fetchArchivedShipments, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredAndSortedShipments = useMemo(() => {
    const allStoredShipments = [...shipments, ...archivedShipments];

    let filtered = allStoredShipments.filter(shipment => {
      const matchesSearch = searchTerm === '' ||
        shipment.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.receivingWarehouse?.toLowerCase().includes(searchTerm.toLowerCase());

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

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [shipments, archivedShipments, searchTerm, weekFilters, sortConfig]);

  // Group filtered shipments by warehouse
  const groupedByWarehouse = useMemo(() => {
    const groups = {};
    for (const s of filteredAndSortedShipments) {
      const wh = s.receivingWarehouse || 'Unassigned';
      if (!groups[wh]) groups[wh] = [];
      groups[wh].push(s);
    }
    // Sort warehouse keys: named warehouses first, Unassigned last
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
    return keys.map(k => ({ name: k, shipments: groups[k] }));
  }, [filteredAndSortedShipments]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleWeekFilter = (week) => {
    setWeekFilters(prev =>
      prev.includes(week) ? prev.filter(w => w !== week) : [...prev, week]
    );
  };

  const availableWeeks = useMemo(() => {
    const allShipments = [...shipments, ...archivedShipments];
    return [...new Set(allShipments.map(s => s.weekNumber))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));
  }, [shipments, archivedShipments]);

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const activeStoredShipments = shipments.filter(s => s.latestStatus === 'stored');
  const activeShipmentsCount = activeStoredShipments.length;

  const handleArchiveAll = async () => {
    if (activeShipmentsCount === 0) return;

    const confirmArchive = window.confirm(
      `Are you sure you want to archive all ${activeShipmentsCount} stored shipment(s)?\n\nThis will move them to the archive for record-keeping.`
    );
    if (!confirmArchive) return;

    setArchivingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const shipment of activeStoredShipments) {
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
    if (successCount > 0 && showSuccess) showSuccess(`Successfully archived ${successCount} shipment(s)`);
    if (failCount > 0 && showError) showError(`Failed to archive ${failCount} shipment(s)`);
  };

  const toggleWarehouse = (name) => {
    setCollapsedWarehouses(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleWarehouseChange = async (shipmentId, newWarehouse) => {
    setEditingWarehouse(null);
    try {
      await onUpdateShipment(shipmentId, { receivingWarehouse: newWarehouse });
      if (showSuccess) showSuccess(`Moved to ${newWarehouse}`);
    } catch (err) {
      if (showError) showError('Failed to update warehouse');
    }
  };

  const handleStoredDateChange = async (shipmentId, newDate) => {
    setEditingDate(null);
    if (!newDate) return;
    try {
      await onUpdateShipment(shipmentId, { receivingDate: newDate });
      if (showSuccess) showSuccess('Stored date updated');
    } catch (err) {
      if (showError) showError('Failed to update stored date');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <div>Loading stored shipments...</div>
      </div>
    );
  }

  const totalPallets = Math.round(filteredAndSortedShipments.reduce((sum, s) => sum + (Number(s.palletQty) || 0), 0));

  const thStyle = {
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  };

  const columns = [
    { key: 'orderRef', label: 'Order Ref' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'productName', label: 'Product' },
    { key: 'quantity', label: 'Qty' },
    { key: 'palletQty', label: 'Pallets' },
    { key: 'storedDate', label: 'Stored Date' },
    { key: null, label: '' },
  ];

  return (
    <div className="window-content">
      <div className="brand-strip" />

      {/* Compact header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy-900)' }}>Stored Stock</h2>
          <span style={{ fontSize: 12, color: 'var(--text-500)', fontWeight: 500 }}>
            {filteredAndSortedShipments.length} items &middot; {groupedByWarehouse.length} warehouses &middot; {totalPallets} pallets
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 13, width: 200, background: 'var(--surface)'
            }}
          />
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              onClick={() => setShowWeekDropdown(!showWeekDropdown)}
              style={{ fontSize: 13, padding: '6px 10px' }}
            >
              Week {weekFilters.length > 0 ? `(${weekFilters.length})` : ''} <span style={{ fontSize: 10 }}>▼</span>
            </button>
            {showWeekDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, backgroundColor: 'white',
                border: '1px solid var(--border)', borderRadius: 6, marginTop: 4,
                maxHeight: 200, overflowY: 'auto', minWidth: 120, zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                {availableWeeks.map(week => (
                  <label key={week} style={{
                    display: 'block', padding: '6px 10px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)', fontSize: 13, userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={weekFilters.includes(week)}
                      onChange={() => toggleWeekFilter(week)}
                      style={{ marginRight: 6 }}
                    />
                    Week {week}
                  </label>
                ))}
                {availableWeeks.length === 0 && (
                  <div style={{ padding: 10, color: 'var(--text-500)', textAlign: 'center', fontSize: 13 }}>
                    No weeks
                  </div>
                )}
              </div>
            )}
          </div>
          {activeShipmentsCount > 0 && (
            <button
              className="btn btn-ghost"
              onClick={handleArchiveAll}
              disabled={archivingAll}
              style={{ fontSize: 13, padding: '6px 10px' }}
            >
              {archivingAll ? 'Archiving...' : `Archive All (${activeShipmentsCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Warehouse groups */}
      {filteredAndSortedShipments.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem', color: 'var(--text-500)',
          backgroundColor: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)'
        }}>
          <h3 style={{ margin: '0 0 8px' }}>No stored shipments found</h3>
          <p style={{ margin: 0, fontSize: 14 }}>Shipments that have been received and stored will appear here grouped by warehouse.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groupedByWarehouse.map(({ name, shipments: warehouseShipments }) => {
            const isCollapsed = collapsedWarehouses[name];
            const whPallets = Math.round(warehouseShipments.reduce((sum, s) => sum + (Number(s.palletQty) || 0), 0));
            const activeCount = warehouseShipments.filter(s => !s.isArchived && s.latestStatus !== 'archived').length;
            const archivedCount = warehouseShipments.length - activeCount;

            return (
              <div key={name} className="dash-panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Warehouse header */}
                <button
                  onClick={() => toggleWarehouse(name)}
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 16px', background: 'var(--surface-2)', border: 'none',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 0.2s', fontSize: 11, color: 'var(--text-500)'
                  }}>▶</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-900)' }}>{name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-500)', fontWeight: 500 }}>
                    {warehouseShipments.length} item{warehouseShipments.length !== 1 ? 's' : ''}
                    {whPallets > 0 && <> &middot; {whPallets} pallets</>}
                    {archivedCount > 0 && <> &middot; {archivedCount} archived</>}
                  </span>
                </button>

                {/* Table */}
                {!isCollapsed && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {columns.map((col, i) => (
                            <th
                              key={i}
                              onClick={col.key ? () => handleSort(col.key) : undefined}
                              style={{ ...thStyle, cursor: col.key ? 'pointer' : 'default' }}
                            >
                              {col.label}{col.key ? getSortIcon(col.key) : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {warehouseShipments.map((shipment) => (
                          <tr
                            key={shipment.id}
                            style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                          >
                            {(() => {
                              const isArch = shipment.isArchived || shipment.latestStatus === 'archived';
                              return (<>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--accent)', fontSize: 13 }}>
                              {shipment.orderRef}
                              {isArch && (
                                <span style={{
                                  marginLeft: 6, padding: '1px 5px', borderRadius: 4,
                                  fontSize: 10, fontWeight: 600, background: 'var(--surface-2)',
                                  color: 'var(--text-500)'
                                }}>
                                  ARCHIVED
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 13 }}>{shipment.supplier}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13 }}>{shipment.productName || 'N/A'}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13 }}>{shipment.quantity || 'N/A'}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13 }}>{shipment.palletQty ? (Math.round(shipment.palletQty) || 1) : '-'}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13 }}>
                              {editingDate === shipment.id ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={editingDateValue}
                                  onChange={(e) => setEditingDateValue(e.target.value)}
                                  onBlur={() => {
                                    handleStoredDateChange(shipment.id, editingDateValue);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleStoredDateChange(shipment.id, editingDateValue);
                                    if (e.key === 'Escape') setEditingDate(null);
                                  }}
                                  style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)' }}
                                />
                              ) : (
                                <span
                                  onClick={() => {
                                    const d = shipment.receivingDate || shipment.updatedAt || shipment.estimatedArrival;
                                    setEditingDateValue(d ? new Date(d).toISOString().split('T')[0] : '');
                                    setEditingDate(shipment.id);
                                  }}
                                  style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-500)' }}
                                  title="Click to edit date"
                                >
                                  {formatDate(shipment.receivingDate || shipment.updatedAt || shipment.estimatedArrival)}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {editingWarehouse === shipment.id ? (
                                <select
                                  autoFocus
                                  defaultValue={shipment.receivingWarehouse || ''}
                                  onChange={(e) => handleWarehouseChange(shipment.id, e.target.value)}
                                  onBlur={() => setEditingWarehouse(null)}
                                  style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)' }}
                                >
                                  <option value="">Unassigned</option>
                                  <option value="PRETORIA">PRETORIA</option>
                                  <option value="KLAPMUTS">KLAPMUTS</option>
                                  <option value="OFFSITE">OFFSITE</option>
                                </select>
                              ) : (
                                <button
                                  className="btn btn-ghost"
                                  onClick={() => setEditingWarehouse(shipment.id)}
                                  style={{ fontSize: 12, padding: '4px 10px' }}
                                  title="Move to another warehouse"
                                >
                                  Move
                                </button>
                              )}
                              {!isArch && (
                                <button
                                  className="btn btn-ghost"
                                  onClick={() => onArchiveShipment ? onArchiveShipment(shipment.id) : onDeleteShipment(shipment.id)}
                                  style={{ fontSize: 12, padding: '4px 10px', marginLeft: 4 }}
                                >
                                  Archive
                                </button>
                              )}
                            </td>
                              </>);
                            })()}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WarehouseStored;
