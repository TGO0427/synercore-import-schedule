// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';
import './theme.css';

// Initialize Sentry for error tracking (before rendering)
import { initializeSentry } from './config/sentry.js';
initializeSentry();

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
