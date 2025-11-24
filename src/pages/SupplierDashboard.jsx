import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';

function SupplierDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('shipments');
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');

  const token = localStorage.getItem('supplier_token');

  useEffect(() => {
    fetchShipments();
    fetchReports();
  }, [filter]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const query = filter ? `?status=${filter}` : '';
      const res = await fetch(getApiUrl(`/api/supplier/shipments${query}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch shipments');
      const data = await res.json();
      setShipments(data.shipments);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      setMessage('Error loading shipments');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(getApiUrl('/api/supplier/reports'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const viewShipmentDetail = async (shipmentId) => {
    try {
      const res = await fetch(getApiUrl(`/api/supplier/shipments/${shipmentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch shipment detail');
      const data = await res.json();
      setSelectedShipment(data);
      setActiveTab('detail');
    } catch (error) {
      console.error('Error fetching shipment detail:', error);
      setMessage('Error loading shipment details');
    }
  };

  const uploadDocument = async (e) => {
    try {
      setUploadingFile(true);
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('shipmentId', selectedShipment.shipment.id);
      formData.append('documentType', e.target.dataset.type);
      formData.append('description', `${e.target.dataset.type} uploaded by supplier`);

      const res = await fetch(getApiUrl('/api/supplier/documents'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Failed to upload document');

      setMessage(`✅ ${e.target.dataset.type} uploaded successfully`);
      setTimeout(() => setMessage(''), 3000);

      // Refresh shipment detail
      const response = await fetch(getApiUrl(`/api/supplier/shipments/${selectedShipment.shipment.id}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedShipment(data);
    } catch (error) {
      console.error('Error uploading document:', error);
      setMessage('Error uploading document');
    } finally {
      setUploadingFile(false);
    }
  };

  const formatStatus = (status) => {
    const statusLabels = {
      'planned_airfreight': '✈️ Planned - Air',
      'planned_seafreight': '🚢 Planned - Sea',
      'planned_roadway': '🚚 Planned - Road',
      'in_transit_airfreight': '✈️ In Transit - Air',
      'in_transit_seaway': '🚢 In Transit - Sea',
      'in_transit_roadway': '🚚 In Transit - Road',
      'moored': '⚓ Moored',
      'berth_working': '⚙️ Berth - Working',
      'berth_complete': '✅ Berth - Complete',
      'arrived_pta': '📦 Arrived - PTA',
      'arrived_klm': '📦 Arrived - KLM',
      'arrived_offsite': '📦 Arrived - Offsite',
      'stored': '🏪 Stored',
      'received': '✅ Received',
      'inspection_failed': '❌ Inspection Failed',
      'inspection_passed': '✓ Inspection Passed'
    };
    return statusLabels[status] || status;
  };

  const getStatusColor = (status) => {
    if (status === 'received') return '#28a745';
    if (status === 'stored') return '#007bff';
    if (status.includes('in_transit')) return '#ffc107';
    if (status.includes('arrived')) return '#17a2b8';
    if (status.includes('planned')) return '#6c757d';
    if (status.includes('inspection_failed')) return '#dc3545';
    return '#6c757d';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#003d82',
        color: 'white',
        padding: '1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>📦 Supplier Portal</h1>
          <button
            onClick={onLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1rem'
      }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid #ddd'
        }}>
          {[
            { id: 'shipments', label: '📦 My Shipments' },
            { id: 'reports', label: '📊 Reports' },
            { id: 'detail', label: '📋 Shipment Detail', hidden: !selectedShipment }
          ].map(tab => (
            !tab.hidden && (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: activeTab === tab.id ? '#003d82' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#333',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  borderBottom: activeTab === tab.id ? '3px solid #0066cc' : 'none'
                }}
              >
                {tab.label}
              </button>
            )
          ))}
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
            color: message.includes('✅') ? '#155724' : '#721c24',
            borderRadius: '4px'
          }}>
            {message}
          </div>
        )}

        {/* Shipments Tab */}
        {activeTab === 'shipments' && (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label>Filter by status:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              >
                <option value="">All Statuses</option>
                <option value="in_transit_airfreight">In Transit - Air</option>
                <option value="in_transit_seaway">In Transit - Sea</option>
                <option value="arrived_pta">Arrived - PTA</option>
                <option value="stored">Stored</option>
                <option value="received">Received</option>
              </select>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Loading shipments...</p>
            ) : shipments.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>No shipments found</p>
            ) : (
              <div style={{
                display: 'grid',
                gap: '1rem'
              }}>
                {shipments.map(shipment => (
                  <div
                    key={shipment.id}
                    style={{
                      backgroundColor: 'white',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onClick={() => viewShipmentDetail(shipment.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>
                          Order: {shipment.orderRef}
                        </h3>
                        <p style={{ margin: '0.25rem 0', color: '#666' }}>
                          Product: {shipment.productName}
                        </p>
                        <p style={{ margin: '0.25rem 0', color: '#666' }}>
                          Quantity: {shipment.quantity} units ({shipment.palletQty} pallets)
                        </p>
                      </div>
                      <span style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: getStatusColor(shipment.latestStatus),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}>
                        {formatStatus(shipment.latestStatus)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && reports && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            {/* Summary Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#003d82' }}>📦 Total Shipments</h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>
                {reports.summary.total_shipments}
              </p>
            </div>

            {/* Delivered Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#28a745' }}>✅ Delivered</h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>
                {reports.summary.delivered || 0}
              </p>
            </div>

            {/* In Transit Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#ffc107' }}>✈️ In Transit</h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>
                {reports.summary.arrived || 0}
              </p>
            </div>

            {/* Documents Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#17a2b8' }}>📄 Documents Uploaded</h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>
                {reports.documents.total_documents || 0}
              </p>
            </div>

            {/* Status Breakdown */}
            <div style={{
              gridColumn: 'span 2',
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>📊 Shipments by Status</h3>
              {reports.shipmentsByStatus.map(status => (
                <div key={status.latestStatus} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #eee'
                }}>
                  <span>{formatStatus(status.latestStatus)}</span>
                  <strong>{status.count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shipment Detail Tab */}
        {activeTab === 'detail' && selectedShipment && (
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px' }}>
            <h2>{selectedShipment.shipment.orderRef}</h2>

            {/* Shipment Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {[
                { label: 'Product', value: selectedShipment.shipment.productName },
                { label: 'Quantity', value: `${selectedShipment.shipment.quantity} units` },
                { label: 'Pallets', value: selectedShipment.shipment.palletQty },
                { label: 'Status', value: formatStatus(selectedShipment.shipment.latestStatus) },
                { label: 'Expected Arrival', value: new Date(selectedShipment.shipment.expectedArrivalDate).toLocaleDateString() },
                { label: 'Destination', value: selectedShipment.shipment.finalPod || 'TBD' }
              ].map(item => (
                <div key={item.label}>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Documents */}
            <div style={{ marginBottom: '2rem' }}>
              <h3>📄 Documents</h3>
              {selectedShipment.documents.length === 0 ? (
                <p style={{ color: '#666' }}>No documents uploaded yet</p>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {selectedShipment.documents.map(doc => (
                    <div key={doc.id} style={{
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>{doc.file_name}</p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          {doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      {doc.is_verified && (
                        <span style={{
                          backgroundColor: '#d4edda',
                          color: '#155724',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                        }}>
                          ✓ Verified
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Documents */}
            <div style={{ marginBottom: '2rem' }}>
              <h3>📤 Upload Documents</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                {[
                  { type: 'POD', label: '📋 Proof of Delivery' },
                  { type: 'delivery_proof', label: '🚚 Delivery Proof' },
                  { type: 'customs', label: '📋 Customs Doc' },
                  { type: 'other', label: '📎 Other' }
                ].map(doc => (
                  <label key={doc.type} style={{
                    padding: '1rem',
                    border: '2px dashed #007bff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={uploadDocument}
                      data-type={doc.type}
                      disabled={uploadingFile}
                    />
                    {uploadingFile ? 'Uploading...' : doc.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplierDashboard;
