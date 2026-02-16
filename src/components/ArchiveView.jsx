import React, { useState, useEffect, useMemo } from 'react';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

function ArchiveView() {
  const [archives, setArchives] = useState([]);
  const [dbArchived, setDbArchived] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveData, setArchiveData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingArchive, setEditingArchive] = useState(null);
  const [newName, setNewName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editingShipment, setEditingShipment] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  // Auto-select month with archives when archives load
  useEffect(() => {
    if (archives.length > 0 && selectedMonth) {
      const hasArchivesInSelectedMonth = archives.some(a =>
        a.archivedAt.startsWith(selectedMonth)
      );

      if (!hasArchivesInSelectedMonth) {
        // Find the most recent month with archives
        const mostRecentArchive = archives.reduce((latest, archive) =>
          !latest || archive.archivedAt > latest.archivedAt ? archive : latest
        , null);

        if (mostRecentArchive) {
          const archiveMonth = mostRecentArchive.archivedAt.substring(0, 7);
          setSelectedMonth(archiveMonth);
        }
      }
    }
  }, [archives]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'

  useEffect(() => {
    fetchArchives();
    fetchDbArchived();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      const response = await authFetch(getApiUrl('/api/shipments/archives'));
      if (!response.ok) throw new Error('Failed to fetch archives');
      const data = await response.json();
      setArchives(data);
    } catch (error) {
      console.error('Error fetching archives:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbArchived = async () => {
    try {
      const response = await authFetch(getApiUrl('/api/shipments?status=archived'));
      if (!response.ok) return;
      const result = await response.json();
      setDbArchived(result.data || result);
    } catch (error) {
      console.error('Error fetching DB archived shipments:', error);
    }
  };

  const viewArchive = async (fileName) => {
    try {
      setLoading(true);
      const response = await authFetch(getApiUrl(`/api/shipments/archives/${fileName}`));
      if (!response.ok) throw new Error('Failed to fetch archive data');
      const data = await response.json();
      setArchiveData(data);
      setSelectedArchive(fileName);
    } catch (error) {
      console.error('Error fetching archive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameArchive = async (fileName, newName) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/archives/${fileName}/rename`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName })
      });

      if (!response.ok) throw new Error('Failed to rename archive');

      // Refresh archives list
      await fetchArchives();
      setEditingArchive(null);
      setNewName('');
    } catch (error) {
      console.error('Error renaming archive:', error);
      alert('Failed to rename archive');
    }
  };

  const startEditing = (archive) => {
    setEditingArchive(archive.fileName);
    setNewName(getArchiveDisplayName(archive.fileName));
  };

  const cancelEditing = () => {
    setEditingArchive(null);
    setNewName('');
  };

  const startEditingShipment = (shipment) => {
    setEditingShipment(shipment);
    setEditFormData({ ...shipment });
  };

  const cancelEditingShipment = () => {
    setEditingShipment(null);
    setEditFormData(null);
  };

  const handleEditFieldChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const saveShipmentEdit = async () => {
    try {
      // Update the shipment in the archive data
      const updatedData = archiveData.data.map(s =>
        s.id === editingShipment.id ? editFormData : s
      );

      // Send update to server
      const response = await authFetch(getApiUrl(`/api/shipments/archives/${selectedArchive}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: updatedData })
      });

      if (!response.ok) throw new Error('Failed to update archive');

      // Update local state
      setArchiveData(prev => ({
        ...prev,
        data: updatedData
      }));

      // Close edit modal
      cancelEditingShipment();
    } catch (error) {
      console.error('Error updating shipment:', error);
      alert('Failed to update shipment');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getArchiveDisplayName = (fileName, archiveData = null) => {
    // Check for custom name first
    if (archiveData && archiveData.customName) {
      return archiveData.customName;
    }

    if (fileName.startsWith('custom_archive_')) {
      const withoutPrefix = fileName.replace('custom_archive_', '').replace('.json', '');
      const parts = withoutPrefix.split('_');
      const timestampIndex = parts.findIndex(part => part.match(/^\d{4}-\d{2}-\d{2}T/));

      if (timestampIndex > 0) {
        return parts.slice(0, timestampIndex).join(' ');
      }
      return withoutPrefix;
    } else if (fileName.startsWith('manual_archive_')) {
      const withoutPrefix = fileName.replace('manual_archive_', '').replace('.json', '');

      // Try to extract order references and timestamp
      // Format: manual_archive_ORDER1_ORDER2_2025-09-23T...
      const parts = withoutPrefix.split('_');
      const timestampIndex = parts.findIndex(part => part.match(/^\d{4}-\d{2}-\d{2}T/));

      if (timestampIndex > 0) {
        const orderRefs = parts.slice(0, timestampIndex).join(', ');
        return `Manual Archive - ${orderRefs}`;
      } else {
        // Fallback for old format without order refs
        try {
          const date = new Date(withoutPrefix);
          return `Manual Archive - ${date.toLocaleDateString()}`;
        } catch {
          return `Manual Archive - ${withoutPrefix}`;
        }
      }
    } else if (fileName.startsWith('auto_archive_arrived_')) {
      const dateStr = fileName.replace('auto_archive_arrived_', '').replace('.json', '');
      const date = new Date(dateStr);
      return `Auto Archive (Arrived) - ${date.toLocaleDateString()}`;
    } else if (fileName.startsWith('shipments_')) {
      const dateStr = fileName.replace('shipments_', '').replace('.json', '');
      const date = new Date(dateStr);
      return `Data Backup - ${date.toLocaleDateString()}`;
    }
    return fileName.replace('.json', '');
  };

  // Filter archives by selected month and exclude data backups
  const filteredArchives = useMemo(() => {
    return archives.filter(archive => {
      // Exclude Data Backup Archives (files starting with 'shipments_')
      if (archive.fileName.startsWith('shipments_')) {
        return false;
      }

      // Filter by selected month
      const archiveDate = new Date(archive.archivedAt);
      const archiveMonth = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, '0')}`;

      return archiveMonth === selectedMonth;
    }).filter(archive => {
      // Apply search filter
      return searchTerm === '' ||
        archive.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getArchiveDisplayName(archive.fileName).toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [archives, selectedMonth, searchTerm]);

  // Generate month options dynamically based on actual archives
  const monthOptions = useMemo(() => {
    if (archives.length === 0) {
      // If no archives yet, show last 12 months
      const options = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        options.push({ value, label });
      }
      return options;
    }

    // Extract unique months from archives
    const monthsSet = new Set();
    archives.forEach(archive => {
      const archiveDate = new Date(archive.archivedAt);
      const monthValue = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(monthValue);
    });

    // Convert to array and sort (newest first)
    const monthsArray = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

    // Convert to options format
    return monthsArray.map(value => {
      const [year, month] = value.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      return { value, label };
    });
  }, [archives]);

  // Calculate monthly statistics
  const monthlyStats = useMemo(() => {
    if (filteredArchives.length === 0) {
      return {
        totalArchives: 0,
        totalShipments: 0,
        archiveTypes: {},
        avgShipmentsPerArchive: 0
      };
    }

    const stats = {
      totalArchives: filteredArchives.length,
      totalShipments: filteredArchives.reduce((sum, archive) => sum + archive.totalShipments, 0),
      archiveTypes: {},
      avgShipmentsPerArchive: 0
    };

    // Count archive types
    filteredArchives.forEach(archive => {
      let type = 'Other';
      if (archive.fileName.startsWith('custom_archive_')) type = 'Custom Archive';
      else if (archive.fileName.startsWith('manual_archive_')) type = 'Manual Archive';
      else if (archive.fileName.startsWith('auto_archive_')) type = 'Auto Archive';

      stats.archiveTypes[type] = (stats.archiveTypes[type] || 0) + 1;
    });

    stats.avgShipmentsPerArchive = Math.round(stats.totalShipments / stats.totalArchives);

    return stats;
  }, [filteredArchives]);

  // Chart component for visualizing archive data
  const ArchiveChart = () => {
    if (filteredArchives.length === 0) {
      return (
        <div className="dash-panel" style={{
          textAlign: 'center',
          color: 'var(--text-500)'
        }}>
          <h3>No Archives Found</h3>
          <p>No archived shipments found for {monthOptions.find(m => m.value === selectedMonth)?.label}</p>
        </div>
      );
    }

    // Group archives by type for visualization
    const archiveTypeData = Object.entries(monthlyStats.archiveTypes).map(([type, count], index) => {
      const colors = {
        'Custom Archive': 'var(--success)',
        'Manual Archive': 'var(--info)',
        'Auto Archive': 'var(--warning)',
        'Other': '#9e9e9e'
      };

      return {
        type,
        count,
        color: colors[type] || '#9e9e9e',
        percentage: ((count / monthlyStats.totalArchives) * 100).toFixed(1)
      };
    });

    // Shipments per day for the month
    const dailyData = filteredArchives.reduce((acc, archive) => {
      const date = new Date(archive.archivedAt);
      const day = date.getDate();
      acc[day] = (acc[day] || 0) + archive.totalShipments;
      return acc;
    }, {});

    const maxShipmentsPerDay = Math.max(...Object.values(dailyData));

    return (
      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Monthly Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {monthlyStats.totalArchives}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Archives</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {monthlyStats.totalShipments.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Shipments</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {monthlyStats.avgShipmentsPerArchive}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Avg per Archive</div>
          </div>
        </div>

        {/* Archive Types Breakdown */}
        <div className="dash-panel">
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-900)' }}>Archive Types Distribution</h3>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {archiveTypeData.map(({ type, count, color, percentage }) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  minWidth: '140px',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: color,
                    borderRadius: '3px'
                  }}></div>
                  {type}
                </div>

                <div style={{
                  flex: 1,
                  position: 'relative',
                  height: '30px',
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: '15px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${color}22, ${color})`,
                    borderRadius: '15px',
                    transition: 'width 0.8s ease'
                  }}></div>

                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: parseFloat(percentage) > 30 ? 'white' : 'var(--text-900)'
                  }}>
                    {count} ({percentage}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Archive Activity */}
        <div className="dash-panel">
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-900)' }}>Archive Activity by Day</h3>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '4px',
            height: '200px',
            padding: '0 1rem',
            overflowX: 'auto'
          }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
              const shipments = dailyData[day] || 0;
              const barHeight = maxShipmentsPerDay > 0 ? (shipments / maxShipmentsPerDay) * 160 : 0;

              return (
                <div
                  key={day}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '24px',
                    flex: '0 0 auto'
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: `${barHeight}px`,
                    backgroundColor: shipments > 0 ? 'var(--success)' : 'var(--border)',
                    borderRadius: '3px 3px 0 0',
                    marginBottom: '4px',
                    position: 'relative',
                    cursor: shipments > 0 ? 'pointer' : 'default',
                    transition: 'all 0.3s ease'
                  }}
                  title={shipments > 0 ? `Day ${day}: ${shipments} shipments archived` : `Day ${day}: No archives`}
                  >
                    {shipments > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        color: 'var(--success)',
                        marginBottom: '2px'
                      }}>
                        {shipments}
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-500)',
                    fontWeight: '500'
                  }}>
                    {day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (selectedArchive && archiveData) {
    return (
      <div className="product-view">
        <div className="warehouse-summary">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>📁 Archive: {getArchiveDisplayName(selectedArchive)}</h2>
              <p>Archived on: {formatDate(archiveData.archivedAt)}</p>
              <p>Total Shipments: {archiveData.totalShipments}</p>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => { setSelectedArchive(null); setArchiveData(null); }}
            >
              ← Back to Archives
            </button>
          </div>
        </div>

        <div style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search archived shipments..."
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
          </div>

          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3>Archived Shipments ({archiveData.data.filter(shipment =>
                searchTerm === '' ||
                shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                shipment.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                shipment.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                shipment.finalPod?.toLowerCase().includes(searchTerm.toLowerCase())
              ).length})</h3>
            </div>

            {archiveData.data.filter(shipment =>
              searchTerm === '' ||
              shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              shipment.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              shipment.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              shipment.finalPod?.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((shipment) => (
              <div key={shipment.id} className="dash-panel" style={{
                border: '1px solid var(--border)'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid var(--border)'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-900)', fontSize: '1.2rem' }}>
                      {shipment.supplier}
                    </h3>
                    <div style={{ color: 'var(--text-500)', fontSize: '0.9rem' }}>
                      📦 {shipment.orderRef}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      backgroundColor: shipment.latestStatus === 'stored' ? 'var(--success)' :
                                      shipment.latestStatus === 'rejected' ? 'var(--danger)' :
                                      shipment.latestStatus === 'inspection_failed' ? 'var(--warning)' : 'var(--info)',
                      color: 'white',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}>
                      {shipment.latestStatus?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <button
                      onClick={() => startEditingShipment(shipment)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>

                {/* Basic Information */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Product
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-900)', fontWeight: '500' }}>
                      {shipment.productName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Destination
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-900)', fontWeight: '500' }}>
                      📍 {shipment.finalPod}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Quantity
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-900)', fontWeight: '500' }}>
                      {shipment.quantity?.toLocaleString()} units
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Week
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-900)', fontWeight: '500' }}>
                      Week {shipment.weekNumber}
                    </div>
                  </div>
                </div>

                {/* Workflow Timeline */}
                {(shipment.unloadingStartDate || shipment.inspectionDate || shipment.receivingDate || shipment.rejectionDate) && (
                  <div style={{
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-900)', marginBottom: '0.75rem' }}>
                      📋 Workflow Timeline
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {shipment.unloadingStartDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>🚚</span>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>Unloading Started</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-500)' }}>
                              {new Date(shipment.unloadingStartDate).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}
                      {shipment.inspectionDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>🔍</span>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                              Inspection {shipment.inspectionStatus === 'passed' ? '✅ Passed' :
                                         shipment.inspectionStatus === 'failed' ? '❌ Failed' : ''}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-500)' }}>
                              By {shipment.inspectedBy} on {new Date(shipment.inspectionDate).toLocaleDateString()}
                            </div>
                            {shipment.inspectionNotes && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                "{shipment.inspectionNotes}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {shipment.receivingDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>📋</span>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>Receiving Completed</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-500)' }}>
                              By {shipment.receivedBy} on {new Date(shipment.receivingDate).toLocaleDateString()}
                            </div>
                            {shipment.receivedQuantity !== null && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-500)' }}>
                                Received: {shipment.receivedQuantity} / {shipment.quantity} units
                              </div>
                            )}
                            {shipment.receivingNotes && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                "{shipment.receivingNotes}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {shipment.rejectionDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>↩️</span>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--danger)' }}>
                              Rejected/Returned to Supplier
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-500)' }}>
                              By {shipment.rejectedBy} on {new Date(shipment.rejectionDate).toLocaleDateString()}
                            </div>
                            {shipment.rejectionReason && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                Reason: "{shipment.rejectionReason}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                {(shipment.cbm || shipment.palletQty || shipment.forwardingAgent || shipment.vesselName) && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-500)'
                  }}>
                    {shipment.cbm && (
                      <div>
                        <span style={{ fontWeight: '500' }}>CBM:</span> {shipment.cbm}
                      </div>
                    )}
                    {shipment.palletQty && (
                      <div>
                        <span style={{ fontWeight: '500' }}>Pallets:</span> {shipment.palletQty}
                      </div>
                    )}
                    {shipment.forwardingAgent && (
                      <div>
                        <span style={{ fontWeight: '500' }}>Agent:</span> {shipment.forwardingAgent}
                      </div>
                    )}
                    {shipment.vesselName && (
                      <div>
                        <span style={{ fontWeight: '500' }}>Vessel:</span> {shipment.vesselName}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Edit Shipment Modal */}
        {editingShipment && editFormData && (
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
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>✏️ Edit Archived Shipment</h2>
                <button
                  onClick={cancelEditingShipment}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: 'var(--text-500)'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Basic Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Supplier</label>
                    <input
                      type="text"
                      value={editFormData.supplier || ''}
                      onChange={(e) => handleEditFieldChange('supplier', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Order Reference</label>
                    <input
                      type="text"
                      value={editFormData.orderRef || ''}
                      onChange={(e) => handleEditFieldChange('orderRef', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Product Name</label>
                  <input
                    type="text"
                    value={editFormData.productName || ''}
                    onChange={(e) => handleEditFieldChange('productName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Destination</label>
                    <input
                      type="text"
                      value={editFormData.finalPod || ''}
                      onChange={(e) => handleEditFieldChange('finalPod', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Warehouse</label>
                    <select
                      value={editFormData.receivingWarehouse || ''}
                      onChange={(e) => handleEditFieldChange('receivingWarehouse', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select Warehouse</option>
                      <option value="PRETORIA">PRETORIA</option>
                      <option value="KLAPMUTS">KLAPMUTS</option>
                      <option value="OFFSITE">OFFSITE</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Quantity</label>
                    <input
                      type="number"
                      value={editFormData.quantity || ''}
                      onChange={(e) => handleEditFieldChange('quantity', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>CBM</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.cbm || ''}
                      onChange={(e) => handleEditFieldChange('cbm', parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Pallet Qty</label>
                    <input
                      type="number"
                      value={editFormData.palletQty || ''}
                      onChange={(e) => handleEditFieldChange('palletQty', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Week Number</label>
                    <input
                      type="number"
                      value={editFormData.weekNumber || ''}
                      onChange={(e) => handleEditFieldChange('weekNumber', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Forwarding Agent</label>
                    <input
                      type="text"
                      value={editFormData.forwardingAgent || ''}
                      onChange={(e) => handleEditFieldChange('forwardingAgent', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Vessel Name</label>
                    <input
                      type="text"
                      value={editFormData.vesselName || ''}
                      onChange={(e) => handleEditFieldChange('vesselName', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={cancelEditingShipment}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveShipmentEdit}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="product-view">
      <div className="brand-strip" />
      <div className="warehouse-summary">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h2>Shipment Archives</h2>
            <p>View archived shipment records for {monthOptions.find(m => m.value === selectedMonth)?.label}</p>
          </div>

          {/* Month selector and view mode toggle */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {monthOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                onClick={() => setViewMode('chart')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: viewMode === 'chart' ? 'var(--info)' : 'white',
                  color: viewMode === 'chart' ? 'white' : 'var(--text-900)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📊 Chart
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: viewMode === 'table' ? 'var(--info)' : 'white',
                  color: viewMode === 'table' ? 'white' : 'var(--text-900)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📋 Table
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '2rem', minHeight: '100vh' }}>
        {loading && (
          <div className="loading">Loading archives...</div>
        )}

        {/* DB-archived shipments */}
        {!loading && dbArchived.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: 15, fontWeight: 700, color: 'var(--navy-900)' }}>
              Archived Shipments ({dbArchived.filter(s =>
                searchTerm === '' ||
                (s.orderRef || s.order_ref || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.productName || s.product_name || '').toLowerCase().includes(searchTerm.toLowerCase())
              ).length})
            </h3>
            <div className="dash-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Order Ref', 'Supplier', 'Product', 'Qty', 'Pallets', 'Warehouse', 'Archived'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)',
                          fontSize: 12, fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.3px'
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbArchived.filter(s =>
                      searchTerm === '' ||
                      (s.orderRef || s.order_ref || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (s.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (s.productName || s.product_name || '').toLowerCase().includes(searchTerm.toLowerCase())
                    ).map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--accent)', fontSize: 13 }}>{s.orderRef || s.order_ref}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.supplier}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.productName || s.product_name || 'N/A'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.quantity || 'N/A'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.palletQty || s.pallet_qty || '-'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{s.receivingWarehouse || s.receiving_warehouse || 'N/A'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatDate(s.updatedAt || s.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && archives.length === 0 && dbArchived.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-500)' }}>
            <h3>No Archives Found</h3>
            <p>Archived shipments will appear here when you archive completed or stored shipments.</p>
          </div>
        )}

        {!loading && archives.length > 0 && (
          <div>
            {/* Search bar for both views */}
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search archives..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minWidth: '300px',
                  flex: 1
                }}
              />
              <div style={{ fontSize: '14px', color: 'var(--text-500)' }}>
                Showing {filteredArchives.length} archives (Data Backup Archives excluded)
              </div>
            </div>

            {/* Chart View */}
            {viewMode === 'chart' && <ArchiveChart />}

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="shipments-table">
                <div className="table-header">
                  <h3>Available Archives ({filteredArchives.length})</h3>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Archive Date</th>
                      <th>Total Shipments</th>
                      <th>Archive Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchives.map((archive) => (
                      <tr key={archive.fileName}>
                        <td>{formatDate(archive.archivedAt)}</td>
                        <td>{archive.totalShipments}</td>
                        <td>
                          {editingArchive === archive.fileName ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  flex: 1
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRenameArchive(archive.fileName, newName);
                                  } else if (e.key === 'Escape') {
                                    cancelEditing();
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleRenameArchive(archive.fileName, newName)}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: 'var(--success)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditing}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: 'var(--danger)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                ✗
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{getArchiveDisplayName(archive.fileName)}</span>
                              <button
                                onClick={() => startEditing(archive)}
                                style={{
                                  padding: '2px 6px',
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  marginLeft: '8px'
                                }}
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-small"
                            onClick={() => viewArchive(archive.fileName)}
                          >
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ArchiveView;