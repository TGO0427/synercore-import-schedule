// src/supplier-main.jsx
// Entry point for the Supplier Portal (separate from main app)
import React from 'react';
import { createRoot } from 'react-dom/client';
import SupplierPortalApp from './SupplierPortalApp.jsx';
import './index.css';
import './theme.css';

const container = document.getElementById('supplier-root');
if (!container) {
  throw new Error('SUPPLIER-MAIN.JSX: Missing <div id="supplier-root"></div> in supplier.html');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <SupplierPortalApp />
  </React.StrictMode>
);
