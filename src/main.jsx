// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './theme.css';

console.log('MAIN.JSX: Bootstrapping React…');

const container = document.getElementById('root');
if (!container) {
  throw new Error('MAIN.JSX: Missing <div id="root"></div> in index.html');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('MAIN.JSX: React app rendered!');
