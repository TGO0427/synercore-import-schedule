import React, { useState, useEffect } from 'react';
import { getMetricRating } from '../utils/webVitals';

const METRICS_STORAGE_KEY = 'synercore_perf_metrics';

function PerformanceMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Load stored metrics from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(METRICS_STORAGE_KEY) || '{}');
      if (Object.keys(stored).length > 0) {
        setMetrics(stored);
      }
    } catch (err) {
      // Ignore
    }

    // Listen for new metrics from web-vitals
    const handleMetric = (event) => {
      if (event.detail) {
        setMetrics(prev => {
          const updated = { ...prev, [event.detail.name]: event.detail };
          localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    };
    window.addEventListener('web-vital', handleMetric);
    return () => window.removeEventListener('web-vital', handleMetric);
  }, []);

  const metricDefs = [
    { key: 'LCP', label: 'Largest Contentful Paint', unit: 'ms', desc: 'Loading performance', good: '< 2.5s' },
    { key: 'INP', label: 'Interaction to Next Paint', unit: 'ms', desc: 'Interactivity', good: '< 200ms' },
    { key: 'CLS', label: 'Cumulative Layout Shift', unit: '', desc: 'Visual stability', good: '< 0.1' },
    { key: 'FCP', label: 'First Contentful Paint', unit: 'ms', desc: 'Initial render', good: '< 1.8s' },
    { key: 'TTFB', label: 'Time to First Byte', unit: 'ms', desc: 'Server response', good: '< 600ms' },
  ];

  const getRatingColor = (rating) => {
    if (rating === 'good') return 'var(--success)';
    if (rating === 'needs-improvement') return 'var(--warning)';
    if (rating === 'poor') return 'var(--danger)';
    return 'var(--text-500)';
  };

  const getRatingBg = (rating) => {
    if (rating === 'good') return 'rgba(16, 185, 129, 0.1)';
    if (rating === 'needs-improvement') return 'rgba(245, 158, 11, 0.1)';
    if (rating === 'poor') return 'rgba(239, 68, 68, 0.1)';
    return 'rgba(100, 116, 139, 0.1)';
  };

  // Also read page load time from performance API
  const pageLoadTime = typeof performance !== 'undefined' && performance.timing
    ? Math.round(performance.timing.loadEventEnd - performance.timing.navigationStart)
    : null;

  return (
    <div className="dash-panel" style={{ marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-900)' }}>
            Performance Metrics
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-500)' }}>
            Core Web Vitals &amp; page performance (admin only)
          </p>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-500)' }}>
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px' }}>
          {/* Page load time */}
          {pageLoadTime && pageLoadTime > 0 && (
            <div style={{
              padding: '8px 12px', borderRadius: '8px', marginBottom: '10px',
              background: 'var(--surface-2)', fontSize: '0.85rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: 'var(--text-700)' }}>Page Load Time</span>
              <span style={{ fontWeight: 600, color: pageLoadTime < 3000 ? 'var(--success)' : 'var(--warning)' }}>
                {(pageLoadTime / 1000).toFixed(2)}s
              </span>
            </div>
          )}

          {/* Core Web Vitals */}
          <div style={{ display: 'grid', gap: '8px' }}>
            {metricDefs.map(def => {
              const metric = metrics?.[def.key];
              const value = metric?.value ?? metric;
              const numValue = typeof value === 'object' ? value?.value : value;
              const rating = numValue != null ? getMetricRating(def.key, numValue) : 'unknown';
              const displayValue = numValue != null
                ? (def.unit === 'ms' ? `${Math.round(numValue)}ms` : numValue.toFixed(3))
                : 'Pending...';

              return (
                <div
                  key={def.key}
                  style={{
                    padding: '10px 12px', borderRadius: '8px',
                    background: getRatingBg(rating),
                    border: `1px solid ${getRatingColor(rating)}20`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-900)' }}>
                      {def.key}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-500)' }}>
                      {def.desc} (good: {def.good})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: getRatingColor(rating) }}>
                      {displayValue}
                    </div>
                    {rating !== 'unknown' && (
                      <div style={{
                        fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                        color: getRatingColor(rating),
                      }}>
                        {rating}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{
            margin: '10px 0 0', fontSize: '0.7rem', color: 'var(--text-500)', textAlign: 'center',
          }}>
            Metrics are collected from your browser session. Refresh page for updated values.
          </p>
        </div>
      )}
    </div>
  );
}

export default PerformanceMetrics;
