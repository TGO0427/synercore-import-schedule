import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../config/api';

/**
 * Full-screen overlay that appears when the server connection is lost.
 * Auto-retries a health check every 5 seconds and dismisses when the server responds.
 */
export default function ConnectionOverlay() {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    const handleLost = () => {
      setVisible(true);
      setCountdown(5);
      startHealthCheck();
    };

    const handleRestored = () => {
      setVisible(false);
      cleanup();
    };

    window.addEventListener('connection-lost', handleLost);
    window.addEventListener('connection-restored', handleRestored);

    return () => {
      window.removeEventListener('connection-lost', handleLost);
      window.removeEventListener('connection-restored', handleRestored);
      cleanup();
    };
  }, []);

  function cleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    intervalRef.current = null;
    countdownRef.current = null;
  }

  function startHealthCheck() {
    cleanup();

    // Countdown timer (visual)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 5; // reset after reaching 0
        return prev - 1;
      });
    }, 1000);

    // Health check every 5 seconds
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl('/health'), { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          setVisible(false);
          cleanup();
          window.dispatchEvent(new CustomEvent('connection-restored'));
        }
      } catch {
        // Still offline — keep retrying
      }
    }, 5000);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
        maxWidth: '400px', width: '90%', textAlign: 'center',
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
          <span style={{
            display: 'inline-block',
            animation: 'spin 1.5s linear infinite',
          }}>
            &#x21BB;
          </span>
        </div>
        <h2 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '1.2rem' }}>
          Connection Lost
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
          The server is temporarily unavailable. Your work has been saved locally.
        </p>
        <p style={{ margin: 0, color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
          Retrying in {countdown}s...
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
