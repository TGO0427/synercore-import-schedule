import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ShipmentTable from './components/ShipmentTable';
import ProductView from './components/ProductView';
import FileUpload from './components/FileUpload';
import { ExcelProcessor } from './utils/excelProcessor';

function App() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeView, setActiveView] = useState('shipping');

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shipments');
      if (!response.ok) throw new Error('Failed to fetch shipments');
      const data = await response.json();
      setShipments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    try {
      setLoading(true);
      setError(null);
      
      const processedShipments = await ExcelProcessor.parseExcelFile(file);
      
      for (const shipment of processedShipments) {
        const response = await fetch('/api/shipments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(shipment)
        });
        
        if (!response.ok) throw new Error('Failed to create shipment');
      }
      
      setSuccess(`Successfully imported ${processedShipments.length} shipments`);
      await fetchShipments();
      
    } catch (err) {
      setError(`Failed to process file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShipment = async (id, updates) => {
    try {
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Failed to update shipment');
      
      await fetchShipments();
      setSuccess('Shipment updated successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteShipment = async (id) => {
    try {
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete shipment');
      
      await fetchShipments();
      setSuccess('Shipment deleted successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'shipping':
        return (
          <div className="window-content">
            <Dashboard shipments={shipments} />
            
            <FileUpload 
              onFileUpload={handleFileUpload}
              loading={loading}
            />
            
            <ShipmentTable 
              shipments={shipments}
              onUpdateShipment={handleUpdateShipment}
              onDeleteShipment={handleDeleteShipment}
              loading={loading}
            />
          </div>
        );
      case 'products':
        return (
          <ProductView 
            shipments={shipments}
            onUpdateShipment={handleUpdateShipment}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Synercore Import Schedule</h2>
        <ul className="sidebar-nav">
          <li>
            <button 
              className={activeView === 'shipping' ? 'active' : ''}
              onClick={() => setActiveView('shipping')}
            >
              📦 Shipping Schedule
            </button>
          </li>
          <li>
            <button 
              className={activeView === 'products' ? 'active' : ''}
              onClick={() => setActiveView('products')}
            >
              📋 Product & Warehouse
            </button>
          </li>
        </ul>

        {/* Sidebar Stats */}
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Quick Stats</h4>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Total Items: {shipments.length}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
            In Transit: {shipments.filter(s => s.latestStatus === 'in_transit').length}
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            Delayed: {shipments.filter(s => s.latestStatus === 'delayed').length}
          </p>
        </div>
      </div>

      <div className="main-content">
        {error && (
          <div className="error">
            {error}
            <button 
              onClick={() => setError(null)}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="success">
            {success}
            <button 
              onClick={() => setSuccess(null)}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {renderMainContent()}
      </div>
    </div>
  );
}

export default App;