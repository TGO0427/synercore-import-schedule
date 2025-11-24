// src/SupplierPortalApp.jsx
// Standalone Supplier Portal Application
// This is a completely separate app entry point from the main Synercore app
// Suppliers ONLY have access to this portal - they cannot access the main app

import React, { useState } from 'react';
import SupplierLogin from './pages/SupplierLogin';
import './theme.css';

function SupplierPortalApp() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <SupplierLogin onClose={null} />
    </div>
  );
}

export default SupplierPortalApp;
