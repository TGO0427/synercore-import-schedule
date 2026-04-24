import React, { useState, useEffect } from 'react';
import { authUtils } from '../utils/auth';
import SynercoreLogo from './SynercoreLogo';
import loginIllustration from '../assets/login-illustration.webp';

const REMEMBERED_USERNAME_KEY = 'synercore_remembered_username';

function LoginPage({ onLogin, onPrivacy }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBERED_USERNAME_KEY);
    if (remembered) {
      setCredentials((prev) => ({ ...prev, username: remembered }));
      setRememberMe(true);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!credentials.username.trim() || !credentials.password.trim()) {
        setError('Please enter both username and password');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      const accessToken = data.accessToken || data.token;
      const refreshToken = data.refreshToken || null;
      const expiresIn = data.expiresIn || 604800;

      authUtils.setAuth(accessToken, refreshToken, data.user, expiresIn);

      if (rememberMe) {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, credentials.username);
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      }

      onLogin(data.user.username, data.passwordExpired === true);
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    background: '#f8fafc',
    color: '#0f172a',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
    marginBottom: '6px',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F4FAF5 0%, #EDF7EE 40%, #F9FBF4 100%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft decorative blobs */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '-120px',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,184,79,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          right: '-150px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,184,79,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Layout: illustration on page bg (left) + form card (right) */}
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '40px',
        }}
      >
        {/* LEFT: illustration area — on page background, no card */}
        <div
          style={{
            flex: '1 1 500px',
            padding: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minWidth: 0,
          }}
        >
          <div>
            <SynercoreLogo size={64} />
          </div>

          <div style={{ width: '100%' }}>
            <img
              src={loginIllustration}
              alt=""
              style={{
                width: '100%',
                maxWidth: '620px',
                height: 'auto',
                display: 'block',
                userSelect: 'none',
              }}
              draggable={false}
            />
          </div>

          <div>
            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '22px',
                fontWeight: 700,
                color: '#166534',
                letterSpacing: '-0.01em',
              }}
            >
              Import Supply Management
            </h2>
            <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.55, maxWidth: '540px' }}>
              Track shipments, schedule transport, and manage every delivery from arrival to storage.
            </div>
          </div>
        </div>

        {/* RIGHT: form card */}
        <div
          style={{
            flex: '0 1 400px',
            padding: '36px 36px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08), 0 4px 10px rgba(15, 23, 42, 0.04)',
            border: '1px solid rgba(226, 232, 240, 0.6)',
          }}
        >
          <div style={{ marginBottom: '22px' }}>
            <h1
              style={{
                margin: '0 0 4px',
                fontSize: '22px',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Welcome back
            </h1>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Sign in to your account to continue
            </div>
          </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="username" style={labelStyle}>
              Username
            </label>
            <input
              id="username"
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              onFocus={(e) => {
                e.target.style.borderColor = '#4FB84F';
                e.target.style.background = '#ffffff';
                e.target.style.boxShadow = '0 0 0 3px rgba(79, 184, 79, 0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
              style={inputStyle}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4FB84F';
                  e.target.style.background = '#ffffff';
                  e.target.style.boxShadow = '0 0 0 3px rgba(79, 184, 79, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.background = '#f8fafc';
                  e.target.style.boxShadow = 'none';
                }}
                style={{ ...inputStyle, paddingRight: '44px' }}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  fontSize: '16px',
                  color: '#64748b',
                  lineHeight: 1,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: '#4FB84F', width: '15px', height: '15px', cursor: 'pointer' }}
              disabled={loading}
            />
            Remember me
          </label>

          {/* Error */}
          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? '#94a3b8' : '#4FB84F',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, transform 0.08s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(79, 184, 79, 0.35)',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = '#3E9B3E';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = '#4FB84F';
            }}
          >
            {loading && (
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Bottom links */}
        <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
          <span>Forgot password? Contact your administrator</span>
          {onPrivacy && (
            <>
              <span style={{ color: '#cbd5e1', margin: '0 10px' }}>·</span>
              <button
                type="button"
                onClick={onPrivacy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3E9B3E',
                  cursor: 'pointer',
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                Privacy notice
              </button>
            </>
          )}
        </div>

        {/* Encrypted session info */}
        <div
          style={{
            marginTop: '18px',
            padding: '12px 14px',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #d1fae5',
            fontSize: '12px',
            color: '#166534',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ display: 'block', marginBottom: '2px' }}>🔒 Secure session</strong>
          Your credentials are transmitted over an encrypted connection and are never shared.
        </div>

        {/* First time user */}
        <div
          style={{
            marginTop: '10px',
            padding: '12px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ display: 'block', marginBottom: '2px', color: '#334155' }}>
            ℹ️ First Time User?
          </strong>
          Contact your administrator to create an account for you.
        </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Neutralise Chrome/Edge autofill's yellow/mauve tint so inputs
           keep the card's own light-grey background. */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #f8fafc inset !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
    </div>
  );
}

export default LoginPage;
