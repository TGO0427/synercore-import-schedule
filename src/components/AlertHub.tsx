import React, { useMemo, useState, CSSProperties, ChangeEvent } from 'react';

const SEVERITY_ORDER: Record<string, number> = { critical: 3, warning: 2, info: 1 };

interface Alert {
  id: string | number;
  title: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  read?: boolean;
  ts?: number | string;
  meta?: any;
}

interface AlertHubProps {
  open: boolean;
  onClose: () => void;
  alerts?: Alert[];
  onDismiss?: (id: string | number) => void;
  onMarkRead?: (id: string | number) => void;
}

export default function AlertHub({
  open,
  onClose,
  alerts = [],
  onDismiss,
  onMarkRead,
}: AlertHubProps) {
  const [query, setQuery] = useState<string>('');
  const [severity, setSeverity] = useState<string>('all'); // all | critical | warning | info
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);

  const filtered = useMemo(() => {
    return alerts
      .filter(a => (severity === 'all' ? true : a.severity === severity))
      .filter(a => (showUnreadOnly ? !a.read : true))
      .filter(a =>
        query.trim()
          ? (a.title + ' ' + (a.description || '')).toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] || (typeof b.ts === 'number' && typeof a.ts === 'number' ? b.ts - a.ts : 0));
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
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={severity} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSeverity(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#444' }}>
            <input type="checkbox" checked={showUnreadOnly} onChange={(e: ChangeEvent<HTMLInputElement>) => setShowUnreadOnly(e.target.checked)} />
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
          <article key={a.id} style={{ border: '1px solid #eee', borderLeft: `4px solid ${colorFor(a.severity)}`, borderRadius: 8, padding: 12, background: a.read ? '#fafafa' : '#fff' }}>
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
              <pre style={{ margin: '0 0 8px 0', fontSize: 12, color: '#555', background: '#f7f7f7', padding: 8, borderRadius: 6, overflowX: 'auto' }}>
                {JSON.stringify(a.meta, null, 2)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
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

function colorFor(sev: string): string {
  if (sev === 'critical') return '#ef4444';
  if (sev === 'warning') return '#eab308';
  return '#0ea5e9';
}

function btnStyle(bg: string): CSSProperties {
  return {
    background: bg, color: 'white', border: 'none', borderRadius: 6,
    padding: '6px 10px', cursor: 'pointer', fontSize: 12
  };
}
