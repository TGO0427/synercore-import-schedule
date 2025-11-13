import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

function NotificationPreferences({ onClose }) {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [testEmailSent, setTestEmailSent] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await authFetch(getApiUrl('/api/notifications/preferences'));
      if (!res.ok) throw new Error('Failed to fetch preferences');
      const data = await res.json();
      setPreferences(data);
    } catch (error) {
      setMessage('Error loading notification preferences');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    setPreferences(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleFrequencyChange = (frequency) => {
    setPreferences(prev => ({
      ...prev,
      email_frequency: frequency
    }));
  };

  const handleEmailChange = (email) => {
    setPreferences(prev => ({
      ...prev,
      email_address: email
    }));
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const res = await authFetch(getApiUrl('/api/notifications/preferences'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (!res.ok) throw new Error('Failed to save preferences');
      setMessage('✅ Notification preferences saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error saving preferences');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    try {
      setSaving(true);
      const res = await authFetch(getApiUrl('/api/notifications/test'), {
        method: 'POST'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send test email');
      }

      setTestEmailSent(true);
      setMessage('✅ Test email sent successfully');
      setTimeout(() => {
        setTestEmailSent(false);
        setMessage('');
      }, 3000);
    } catch (error) {
      setMessage('❌ ' + error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading notification preferences...</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '2rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px'
    }}>
      <h2 style={{ marginBottom: '1.5rem' }}>📧 Notification Preferences</h2>

      {message && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      {/* Email Address */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Notification Email Address
        </label>
        <input
          type="email"
          value={preferences?.email_address || ''}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder="your.email@example.com"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem'
          }}
        />
        <small style={{ color: '#666' }}>
          If empty, your account email will be used
        </small>
      </div>

      {/* Email Frequency */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Email Frequency
        </label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {['immediate', 'daily', 'weekly'].map(freq => (
            <label key={freq} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                name="frequency"
                value={freq}
                checked={preferences?.email_frequency === freq}
                onChange={() => handleFrequencyChange(freq)}
              />
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Enable/Disable Email */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={preferences?.email_enabled || false}
            onChange={() => handleToggle('email_enabled')}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <span>Enable email notifications</span>
        </label>
      </div>

      {/* Event Notifications */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Event Notifications</h3>
        <div style={{
          display: 'grid',
          gap: '1rem',
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '4px'
        }}>
          {[
            { key: 'notify_shipment_arrival', label: '📦 Shipment Arrival' },
            { key: 'notify_inspection_failed', label: '❌ Inspection Failed' },
            { key: 'notify_inspection_passed', label: '✅ Inspection Passed' },
            { key: 'notify_warehouse_capacity', label: '⚠️ Warehouse Capacity Alert' },
            { key: 'notify_delayed_shipment', label: '🚨 Delayed Shipment' },
            { key: 'notify_post_arrival_update', label: '📝 Post-Arrival Update' },
            { key: 'notify_workflow_assigned', label: '📋 Workflow Assigned' }
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preferences?.[key] || false}
                onChange={() => handleToggle(key)}
                disabled={!preferences?.email_enabled}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: preferences?.email_enabled ? 'pointer' : 'not-allowed',
                  opacity: preferences?.email_enabled ? 1 : 0.5
                }}
              />
              <span style={{ opacity: preferences?.email_enabled ? 1 : 0.7 }}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={sendTestEmail}
          disabled={saving || !preferences?.email_enabled}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving || !preferences?.email_enabled ? 'not-allowed' : 'pointer',
            opacity: saving || !preferences?.email_enabled ? 0.6 : 1,
            fontSize: '1rem'
          }}
        >
          {testEmailSent ? '📧 Test Sent' : 'Send Test Email'}
        </button>

        <button
          onClick={savePreferences}
          disabled={saving}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            fontSize: '1rem'
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>

        <button
          onClick={onClose}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default NotificationPreferences;
