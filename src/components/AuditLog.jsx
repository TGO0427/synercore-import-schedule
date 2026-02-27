import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

const PAGE_SIZE = 50;

function formatChanges(changes) {
  if (!changes || typeof changes !== 'object') return '';
  const entries = Object.entries(changes);
  if (entries.length === 0) return '';

  return entries
    .filter(([key]) => key !== 'updatedAt' && key !== 'createdAt')
    .map(([key, value]) => {
      if (value && typeof value === 'object' && value.from !== undefined && value.to !== undefined) {
        return `${key}: ${value.from} \u2192 ${value.to}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(', ');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const actionColors = {
  create: '#10b981',
  update: '#3b82f6',
  delete: '#ef4444',
  archive: '#f59e0b',
  restore: '#8b5cf6',
};

function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const res = await authFetch(getApiUrl(`/api/audit?${params.toString()}`));
      if (!res.ok) throw new Error('Failed to fetch audit log');
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entityType, action, startDate, endDate, page]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [entityType, action, startDate, endDate]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: 'var(--text-900)', fontSize: '1.5rem', fontWeight: 700 }}>
          Activity Log
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-500)', fontSize: '0.875rem' }}>
          Track all changes made to shipments and suppliers
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-1)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Entity Type
          </label>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-900)',
              fontSize: '0.875rem',
              minWidth: '140px',
            }}
          >
            <option value="">All</option>
            <option value="shipment">Shipment</option>
            <option value="supplier">Supplier</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Action
          </label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-900)',
              fontSize: '0.875rem',
              minWidth: '140px',
            }}
          >
            <option value="">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="archive">Archive</option>
            <option value="restore">Restore</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-900)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-900)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => {
              setEntityType('');
              setAction('');
              setStartDate('');
              setEndDate('');
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-700)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results summary */}
      <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-500)' }}>
        {loading ? 'Loading...' : `${total} entries found`}
        {totalPages > 1 && ` \u2022 Page ${page + 1} of ${totalPages}`}
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius)',
          color: 'var(--danger)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-1)',
        overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)' }}>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Entity</th>
              <th style={{ ...thStyle, minWidth: '250px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && entries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>
                  Loading audit log...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-500)' }}>
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <span style={{ whiteSpace: 'nowrap' }}>{formatDate(entry.created_at)}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: 'var(--text-900)' }}>{entry.username}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      backgroundColor: `${actionColors[entry.action] || '#64748b'}22`,
                      color: actionColors[entry.action] || '#64748b',
                    }}>
                      {entry.action}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        backgroundColor: entry.entity_type === 'shipment' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: entry.entity_type === 'shipment' ? '#3b82f6' : '#10b981',
                        marginRight: '0.5rem',
                      }}>
                        {entry.entity_type}
                      </span>
                      <span style={{ color: 'var(--text-700)' }}>{entry.entity_label || entry.entity_id}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-500)', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                      {formatChanges(entry.changes)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '1rem',
          padding: '0.75rem',
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: page === 0 ? 'var(--surface-2)' : 'var(--surface)',
              color: page === 0 ? 'var(--text-500)' : 'var(--text-900)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: page === 0 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: page >= totalPages - 1 ? 'var(--surface-2)' : 'var(--surface)',
              color: page >= totalPages - 1 ? 'var(--text-500)' : 'var(--text-900)',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: page >= totalPages - 1 ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-500)',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  color: 'var(--text-700)',
  verticalAlign: 'top',
};

export default AuditLog;
