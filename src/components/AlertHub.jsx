import React, { useMemo, useState } from 'react';

const SEVERITY_ORDER = { critical: 3, warning: 2, info: 1 };

export default function AlertHub({
  open,
  onClose,
  alerts = [],
  onDismiss,
  onMarkRead,
  onNavigate,
}) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all'); // all | critical | warning | info
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    return alerts
      .filter(a => (severity === 'all' ? true : a.severity === severity))
      .filter(a => (showUnreadOnly ? !a.read : true))
      .filter(a =>
        query.trim()
          ? (a.title + ' ' + (a.description || '')).toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] || (b.ts || 0) - (a.ts || 0));
  }, [alerts, query, severity, showUnreadOnly]);

  if (!open) return null;

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0, right: 0, height: '100vh', width: 420, maxWidth: '95vw',
        background: '#fff', color: '#222', borderLeft: '1px solid #e5e7eb',
        boxShadow: 'rgba(0,0,0,0.08) -8px 0 24px', zIndex: 1000, display: 'flex', flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 16 }}>Alert Hub</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>{filtered.length} shown</span>
        <button onClick={onClose} style={{ marginLeft: 8, border: '1px solid #ddd', background: '#f8f9fa', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
          Close
        </button>
      </div>

      {/* Controls */}
      <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'grid', gap: 8 }}>
        <input
          placeholder="Search alerts…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#444' }}>
            <input type="checkbox" checked={showUnreadOnly} onChange={e => setShowUnreadOnly(e.target.checked)} />
            Unread only
          </label>
        </div>
      </div>

      {/* List */}
      <div style={{ overflow: 'auto', padding: 12, display: 'grid', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 12, border: '1px dashed #ddd', borderRadius: 8, color: '#666', textAlign: 'center' }}>
            No alerts match your filters.
          </div>
        )}
        {filtered.map(a => (
          <article
            key={a.id}
            style={{
              border: '1px solid #eee', borderLeft: `4px solid ${colorFor(a.severity)}`,
              borderRadius: 8, padding: 12, background: a.read ? '#fafafa' : '#fff',
              cursor: a.meta?.orderRef && onNavigate ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            onClick={() => {
              if (a.meta?.orderRef && onNavigate) {
                onMarkRead?.(a.id);
                onNavigate('shipping', { searchTerm: a.meta.orderRef });
                onClose();
              }
            }}
            onMouseEnter={e => { if (a.meta?.orderRef && onNavigate) e.currentTarget.style.background = '#f0f7ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = a.read ? '#fafafa' : '#fff'; }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: colorFor(a.severity)
              }} />
              <strong style={{ fontSize: 14 }}>{a.title}</strong>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
                {a.ts ? new Date(a.ts).toLocaleString() : ''}
              </span>
            </div>
            {a.description && (
              <p style={{ margin: '6px 0 8px 0', fontSize: 13, color: '#444' }}>{a.description}</p>
            )}
            {a.meta && (
              <div style={{ margin: '0 0 8px 0', fontSize: 12, color: '#555', background: '#f7f7f7', padding: 8, borderRadius: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {a.meta.orderRef && <span><strong>Ref:</strong> {a.meta.orderRef}</span>}
                {a.meta.supplier && <span><strong>Supplier:</strong> {a.meta.supplier}</span>}
                {a.meta.product && <span><strong>Product:</strong> {a.meta.product}</span>}
                {a.meta.week && <span><strong>Week:</strong> {a.meta.week}</span>}
                {a.meta.status && <span><strong>Status:</strong> {a.meta.status.replace(/_/g, ' ')}</span>}
                {a.meta.finalPod && <span><strong>POD:</strong> {a.meta.finalPod}</span>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
              {a.meta?.orderRef && onNavigate && (
                <button onClick={() => {
                  onMarkRead?.(a.id);
                  onNavigate('shipping', { searchTerm: a.meta.orderRef });
                  onClose();
                }} style={btnStyle('#059669')}>View Shipment</button>
              )}
              {!a.read && (
                <button onClick={() => onMarkRead?.(a.id)} style={btnStyle('#0ea5e9')}>Mark read</button>
              )}
              <button onClick={() => onDismiss?.(a.id)} style={btnStyle('#ef4444')}>Dismiss</button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function colorFor(sev) {
  if (sev === 'critical') return '#ef4444';
  if (sev === 'warning') return '#eab308';
  return '#0ea5e9';
}

function btnStyle(bg) {
  return {
    background: bg, color: 'white', border: 'none', borderRadius: 6,
    padding: '6px 10px', cursor: 'pointer', fontSize: 12
  };
}