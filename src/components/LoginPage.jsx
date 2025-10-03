import React, { useState } from 'react';
import { authUtils } from '../utils/auth';

function LoginPage({ onLogin }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Simple validation
      if (!credentials.username.trim() || !credentials.password.trim()) {
        setError('Please enter both username and password');
        return;
      }

      // Call authentication API
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      // Store authentication data
      authUtils.setAuth(data.token, data.user);

      onLogin(data.user.username);
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a3d62 0%, #1e5a7d 100%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Globe Background */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        opacity: '0.3',
        pointerEvents: 'none'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), transparent),
                      url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>')`,
          position: 'relative',
          animation: 'rotate 60s linear infinite'
        }}></div>
      </div>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '480px'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            fontSize: '36px',
            fontWeight: '300',
            color: '#1a5f7a',
            marginBottom: '8px'
          }}>
            📊 Import Supply Chain Management
          </div>
          <div style={{
            fontSize: '15px',
            color: '#666',
            marginBottom: '20px'
          }}>
            Supply Chain Management System
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderBottom: '2px solid #ddd',
                fontSize: '15px',
                transition: 'border-color 0.3s ease',
                outline: 'none',
                background: 'transparent'
              }}
              onFocus={(e) => e.target.style.borderBottomColor = '#2d9f8f'}
              onBlur={(e) => e.target.style.borderBottomColor = '#ddd'}
              placeholder="Username"
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '14px',
                  paddingRight: '45px',
                  border: 'none',
                  borderBottom: '2px solid #ddd',
                  fontSize: '15px',
                  transition: 'border-color 0.3s ease',
                  outline: 'none',
                  background: 'transparent'
                }}
                onFocus={(e) => e.target.style.borderBottomColor = '#2d9f8f'}
                onBlur={(e) => e.target.style.borderBottomColor = '#ddd'}
                placeholder="Password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? 'linear-gradient(135deg, #d1d5db 0%, #e5e7eb 100%)' : 'linear-gradient(135deg, #b8dde0 0%, #d4e9eb 100%)',
              color: loading ? '#6b7280' : '#5a8a93',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = 'linear-gradient(135deg, #a5d1d4 0%, #c5e0e3 100%)';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.background = 'linear-gradient(135deg, #b8dde0 0%, #d4e9eb 100%)';
            }}
          >
            {loading && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Info message */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#495057',
            marginBottom: '8px'
          }}>
            ℹ️ First Time User?
          </div>
          <div style={{
            fontSize: '12px',
            color: '#6c757d',
            lineHeight: '1.4'
          }}>
            Contact your administrator to create an account for you.
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LoginPage;