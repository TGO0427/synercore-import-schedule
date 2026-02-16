import React, { useState } from 'react';
import { authUtils } from '../utils/auth';

function UserSettings({ username, onClose }) {
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const user = authUtils.getUser();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
    setMessage({ type: '', text: '' });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validation
      if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
        setMessage({ type: 'error', text: 'All fields are required' });
        setLoading(false);
        return;
      }

      if (passwords.newPassword.length < 6) {
        setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
        setLoading(false);
        return;
      }

      if (passwords.newPassword !== passwords.confirmPassword) {
        setMessage({ type: 'error', text: 'New passwords do not match' });
        setLoading(false);
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authUtils.getAuthHeader()
        },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: 'Password changed successfully! Please login again.' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });

      // Logout after 2 seconds
      setTimeout(() => {
        authUtils.clearAuth();
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '5px 10px'
          }}
        >
          ×
        </button>

        {/* Header */}
        <h2 style={{
          margin: '0 0 10px 0',
          color: '#2c3e50',
          fontSize: '24px'
        }}>
          User Settings
        </h2>

        {/* User Info */}
        <div style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '25px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Username:</strong> {user?.username || username}
          </div>
          {user?.email && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Email:</strong> {user.email}
            </div>
          )}
          {user?.fullName && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Full Name:</strong> {user.fullName}
            </div>
          )}
          <div>
            <strong>Role:</strong> <span style={{
              backgroundColor: user?.role === 'admin' ? '#059669' : '#4caf50',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              textTransform: 'uppercase'
            }}>
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        {/* Change Password Form */}
        <h3 style={{
          margin: '0 0 15px 0',
          color: '#2c3e50',
          fontSize: '18px'
        }}>
          Change Password
        </h3>

        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.current ? "text" : "password"}
                name="currentPassword"
                value={passwords.currentPassword}
                onChange={handleChange}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  paddingRight: '45px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '18px',
                  color: '#666',
                  lineHeight: '1'
                }}
                tabIndex="-1"
              >
                {showPasswords.current ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.new ? "text" : "password"}
                name="newPassword"
                value={passwords.newPassword}
                onChange={handleChange}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  paddingRight: '45px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="Enter new password (min 6 characters)"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '18px',
                  color: '#666',
                  lineHeight: '1'
                }}
                tabIndex="-1"
              >
                {showPasswords.new ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.confirm ? "text" : "password"}
                name="confirmPassword"
                value={passwords.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  paddingRight: '45px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '18px',
                  color: '#666',
                  lineHeight: '1'
                }}
                tabIndex="-1"
              >
                {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {message.text && (
            <div style={{
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '15px',
              backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
              border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
              color: message.type === 'success' ? '#155724' : '#721c24',
              fontSize: '14px'
            }}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#9ca3af' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UserSettings;
