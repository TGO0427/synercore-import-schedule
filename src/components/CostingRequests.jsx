import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';

const PRIORITY_STYLES = {
  urgent: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  high: { backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
  normal: { backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
  low: { backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' },
};

const STATUS_STYLES = {
  pending: { backgroundColor: '#fef3c7', color: '#92400e' },
  in_progress: { backgroundColor: '#dbeafe', color: '#1e40af' },
  completed: { backgroundColor: '#dcfce7', color: '#166534' },
  dismissed: { backgroundColor: '#f3f4f6', color: '#6b7280' },
};

function CostingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all'
        ? getApiUrl('/api/costing-requests')
        : getApiUrl(`/api/costing-requests?status=${statusFilter}`);
      const response = await authFetch(url);
      if (response.ok) {
        const result = await response.json();
        setRequests(result.data || []);
      } else {
        setError('Failed to load costing requests');
      }
    } catch (err) {
      console.error('Failed to fetch costing requests:', err);
      setError('Failed to load costing requests');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const response = await authFetch(getApiUrl(`/api/costing-requests/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Failed to update request:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/costing-requests/${id}`), {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error('Failed to delete request:', err);
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0b1f3a' }}>Costing Requests</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            Manage costing requests from team members
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['pending', 'in_progress', 'completed', 'dismissed', 'all'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '8px 16px',
              backgroundColor: statusFilter === status ? '#0b1f3a' : '#f3f4f6',
              color: statusFilter === status ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: statusFilter === status ? '600' : '400',
              textTransform: 'capitalize',
            }}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          No {statusFilter === 'all' ? '' : statusFilter.replace('_', ' ')} requests found.
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Requested By</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Supplier</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Product / Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Priority</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>{req.requested_by_username}</td>
                  <td style={{ padding: '12px 16px' }}>{req.supplier_name || '—'}</td>
                  <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{req.product_description || '—'}</div>
                    {req.notes && (
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                        Notes: {req.notes}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                      textTransform: 'uppercase',
                      ...(PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.normal)
                    }}>
                      {req.priority}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500',
                      textTransform: 'capitalize',
                      ...(STATUS_STYLES[req.status] || STATUS_STYLES.pending)
                    }}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', color: '#666' }}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'in_progress')}
                          style={{ padding: '5px 8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          In Progress
                        </button>
                      )}
                      {(req.status === 'pending' || req.status === 'in_progress') && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'completed')}
                          style={{ padding: '5px 8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          Complete
                        </button>
                      )}
                      {(req.status === 'pending' || req.status === 'in_progress') && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'dismissed')}
                          style={{ padding: '5px 8px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          Dismiss
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(req.id)}
                        style={{ padding: '5px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CostingRequests;
