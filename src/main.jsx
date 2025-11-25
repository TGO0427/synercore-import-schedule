// src/main.jsx
console.log('🎯 main.jsx loading...');

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';
import './theme.css';

// Initialize Sentry for error tracking (before rendering)
import { initializeSentry } from './config/sentry.js';
console.log('🔧 About to call initializeSentry()');
initializeSentry();
console.log('✅ initializeSentry() completed');

const container = document.getElementById('root');
if (!container) {
  throw new Error('MAIN.JSX: Missing <div id="root"></div> in index.html');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
