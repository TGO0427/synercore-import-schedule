import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

function NotificationHistory() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchNotifications();
  }, [page, filterType]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        limit: pageSize,
        offset: page * pageSize,
        ...(filterType && { eventType: filterType })
      });

      const res = await authFetch(getApiUrl(`/api/notifications/history?${query}`));
      if (!res.ok) throw new Error('Failed to fetch notification history');
      const data = await res.json();
      setNotifications(data.notifications);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id) => {
    if (!confirm('Delete this notification?')) return;

    try {
      const res = await authFetch(getApiUrl(`/api/notifications/history/${id}`), {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete notification');
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
        return '#28a745';
      case 'failed':
        return '#dc3545';
      case 'pending':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  const formatEventType = (eventType) => {
    const labels = {
      'shipment_arrival': '📦 Shipment Arrival',
      'inspection_failed': '❌ Inspection Failed',
      'inspection_passed': '✅ Inspection Passed',
      'warehouse_capacity': '⚠️ Warehouse Capacity',
      'delayed_shipment': '🚨 Delayed Shipment',
      'post_arrival_update': '📝 Post-Arrival Update',
      'workflow_assigned': '📋 Workflow Assigned',
      'daily_digest': '📋 Daily Digest',
      'weekly_digest': '📋 Weekly Digest',
      'test_email': '🧪 Test Email'
    };
    return labels[eventType] || eventType;
  };

  if (loading && notifications.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading notification history...</p>
      </div>
    );
  }

  const maxPages = Math.ceil(total / pageSize);

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>📧 Notification History</h2>

      {/* Filter */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>Filter by Type:</label>
        <select
          value={filterType || ''}
          onChange={(e) => {
            setFilterType(e.target.value || null);
            setPage(0);
          }}
          style={{
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '1rem'
          }}
        >
          <option value="">All Events</option>
          <option value="shipment_arrival">📦 Shipment Arrival</option>
          <option value="inspection_failed">❌ Inspection Failed</option>
          <option value="inspection_passed">✅ Inspection Passed</option>
          <option value="warehouse_capacity">⚠️ Warehouse Capacity</option>
          <option value="delayed_shipment">🚨 Delayed Shipment</option>
          <option value="post_arrival_update">📝 Post-Arrival Update</option>
          <option value="workflow_assigned">📋 Workflow Assigned</option>
          <option value="daily_digest">📋 Daily Digest</option>
          <option value="weekly_digest">📋 Weekly Digest</option>
        </select>
        <span style={{ marginLeft: '1rem', color: '#666' }}>
          Total: {total} notifications
        </span>
      </div>

      {/* Notifications Table */}
      {notifications.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <p>No notifications found</p>
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          marginBottom: '2rem'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Subject</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notif) => (
                <tr key={notif.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem', fontSize: '0.9em', color: '#666' }}>
                    {formatDate(notif.sent_at)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {formatEventType(notif.event_type)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span title={notif.subject}>
                      {notif.subject.length > 50 ? notif.subject.substring(0, 50) + '...' : notif.subject}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      backgroundColor: getStatusColor(notif.status),
                      color: 'white',
                      fontSize: '0.85em',
                      fontWeight: 'bold'
                    }}>
                      {notif.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9em'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {maxPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '1rem'
        }}>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: page === 0 ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: page === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>

          <span style={{ margin: '0 1rem' }}>
            Page {page + 1} of {maxPages}
          </span>

          <button
            onClick={() => setPage(Math.min(maxPages - 1, page + 1))}
            disabled={page === maxPages - 1}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: page === maxPages - 1 ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: page === maxPages - 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationHistory;
