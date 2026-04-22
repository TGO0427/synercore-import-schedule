import React, { useState, useEffect } from 'react';
import { authUtils } from '../utils/auth';
import SynercoreLogo from './SynercoreLogo';

const REMEMBERED_USERNAME_KEY = 'synercore_remembered_username';

function LoginPage({ onLogin, onForgotPassword, onPrivacy }) {
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

      {/* Split card — illustration left, form right */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          width: '100%',
          maxWidth: '920px',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        {/* LEFT: illustration panel */}
        <div
          className="login-illustration-panel"
          style={{
            flex: '1 1 420px',
            background: 'linear-gradient(135deg, #F4FAF5 0%, #E8F5E9 100%)',
            padding: '32px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
            minHeight: '540px',
          }}
        >
          <div>
            <SynercoreLogo size={40} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
            <svg
              viewBox="0 0 400 260"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', maxWidth: '480px', height: 'auto', display: 'block' }}
              aria-hidden="true"
            >
              {/* Sky band */}
              <defs>
                <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#DCEEF6" />
                  <stop offset="100%" stopColor="#F0F9FC" />
                </linearGradient>
                <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4A90A4" />
                  <stop offset="100%" stopColor="#2F6A7D" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="400" height="185" fill="url(#skyGrad)" />

              {/* Soft clouds */}
              <g fill="white" opacity="0.85">
                <ellipse cx="70" cy="35" rx="28" ry="8" />
                <ellipse cx="88" cy="30" rx="18" ry="6" />
                <ellipse cx="255" cy="22" rx="32" ry="7" />
                <ellipse cx="340" cy="45" rx="22" ry="6" />
              </g>

              {/* Distant warehouse silhouette (left shore) */}
              <g>
                <rect x="0" y="140" width="55" height="45" fill="#CFE3EB" />
                <polygon points="0,140 27,128 55,140" fill="#B3D0DA" />
                <rect x="10" y="155" width="8" height="10" fill="#8FB5C2" />
                <rect x="24" y="155" width="8" height="10" fill="#8FB5C2" />
                <rect x="38" y="155" width="8" height="10" fill="#8FB5C2" />
              </g>

              {/* Port crane (right side) */}
              <g>
                {/* Main vertical mast */}
                <rect x="318" y="75" width="8" height="130" fill="#E74C3C" />
                {/* Horizontal boom */}
                <rect x="240" y="74" width="140" height="6" fill="#E74C3C" />
                {/* Diagonal brace */}
                <polygon points="322,82 240,82 280,76 320,76" fill="#C0392B" opacity="0.6" />
                {/* Cable */}
                <line x1="275" y1="80" x2="275" y2="130" stroke="#1E293B" strokeWidth="1" />
                {/* Hook/container being lifted */}
                <rect x="266" y="130" width="18" height="12" fill="#FBBF24" />
                <line x1="266" y1="134" x2="284" y2="134" stroke="#B45309" strokeWidth="0.5" />
                {/* Base support */}
                <rect x="314" y="200" width="16" height="8" fill="#C0392B" />
                {/* Wheels under crane base */}
                <circle cx="316" cy="210" r="4" fill="#1E293B" />
                <circle cx="328" cy="210" r="4" fill="#1E293B" />
              </g>

              {/* Dock / pier */}
              <rect x="230" y="205" width="170" height="10" fill="#A0826D" />
              <rect x="230" y="205" width="170" height="3" fill="#6D5A42" />

              {/* Orange barrels on dock */}
              <g>
                <ellipse cx="258" cy="205" rx="11" ry="3" fill="#F39C12" />
                <rect x="247" y="185" width="22" height="20" fill="#E67E22" />
                <ellipse cx="258" cy="185" rx="11" ry="3" fill="#F39C12" />
                <line x1="247" y1="192" x2="269" y2="192" stroke="#B35E10" strokeWidth="0.5" />
                <line x1="247" y1="198" x2="269" y2="198" stroke="#B35E10" strokeWidth="0.5" />

                <ellipse cx="280" cy="205" rx="10" ry="3" fill="#F39C12" />
                <rect x="270" y="188" width="20" height="17" fill="#E67E22" />
                <ellipse cx="280" cy="188" rx="10" ry="3" fill="#F39C12" />
                <line x1="270" y1="194" x2="290" y2="194" stroke="#B35E10" strokeWidth="0.5" />
              </g>

              {/* Sea */}
              <rect x="0" y="185" width="400" height="75" fill="url(#seaGrad)" />
              <path d="M 0 198 Q 50 194 100 198 T 200 198 T 300 198 T 400 198" fill="none" stroke="white" strokeWidth="1" opacity="0.45" />
              <path d="M 0 215 Q 60 211 120 215 T 240 215 T 360 215" fill="none" stroke="white" strokeWidth="1" opacity="0.3" />
              <path d="M 0 232 Q 80 228 160 232 T 320 232" fill="none" stroke="white" strokeWidth="1" opacity="0.25" />

              {/* Container ship hull */}
              <path d="M 20 195 L 230 195 L 215 225 L 42 225 Z" fill="#1E293B" />
              <rect x="20" y="190" width="210" height="6" fill="#334155" />
              {/* Hull stripe */}
              <rect x="30" y="207" width="190" height="3" fill="#EF4444" />

              {/* Ship bridge (forward cabin) */}
              <rect x="25" y="158" width="22" height="37" fill="white" />
              <rect x="28" y="164" width="5" height="5" fill="#3B82F6" opacity="0.7" />
              <rect x="36" y="164" width="5" height="5" fill="#3B82F6" opacity="0.7" />
              <rect x="28" y="173" width="5" height="5" fill="#3B82F6" opacity="0.7" />
              <rect x="36" y="173" width="5" height="5" fill="#3B82F6" opacity="0.7" />
              {/* Bridge roof / antenna */}
              <rect x="30" y="153" width="12" height="5" fill="#64748B" />
              <line x1="36" y1="153" x2="36" y2="140" stroke="#334155" strokeWidth="1" />
              <circle cx="36" cy="140" r="1.5" fill="#FBBF24" />

              {/* Ship deck - first row of containers */}
              <g>
                <rect x="50" y="175" width="22" height="20" fill="#4FB84F" />
                <rect x="74" y="175" width="22" height="20" fill="#EF4444" />
                <rect x="98" y="175" width="22" height="20" fill="#FBBF24" />
                <rect x="122" y="175" width="22" height="20" fill="#3B82F6" />
                <rect x="146" y="175" width="22" height="20" fill="#4FB84F" />
                <rect x="170" y="175" width="22" height="20" fill="#EF4444" />
                <rect x="194" y="175" width="22" height="20" fill="#FBBF24" />
                {/* container door lines */}
                <line x1="61" y1="175" x2="61" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="85" y1="175" x2="85" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="109" y1="175" x2="109" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="133" y1="175" x2="133" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="157" y1="175" x2="157" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="181" y1="175" x2="181" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="205" y1="175" x2="205" y2="195" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
              </g>

              {/* Second row */}
              <g>
                <rect x="62" y="155" width="22" height="20" fill="#EF4444" />
                <rect x="86" y="155" width="22" height="20" fill="#FBBF24" />
                <rect x="110" y="155" width="22" height="20" fill="#4FB84F" />
                <rect x="134" y="155" width="22" height="20" fill="#3B82F6" />
                <rect x="158" y="155" width="22" height="20" fill="#EF4444" />
                <rect x="182" y="155" width="22" height="20" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.5" />
                <line x1="73" y1="155" x2="73" y2="175" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="97" y1="155" x2="97" y2="175" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="121" y1="155" x2="121" y2="175" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="145" y1="155" x2="145" y2="175" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="169" y1="155" x2="169" y2="175" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="193" y1="155" x2="193" y2="175" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
              </g>

              {/* Third row (smaller stack) */}
              <g>
                <rect x="86" y="135" width="22" height="20" fill="#4FB84F" />
                <rect x="110" y="135" width="22" height="20" fill="#3B82F6" />
                <rect x="134" y="135" width="22" height="20" fill="#EF4444" />
                <rect x="158" y="135" width="22" height="20" fill="#FBBF24" />
                <line x1="97" y1="135" x2="97" y2="155" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="121" y1="135" x2="121" y2="155" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="145" y1="135" x2="145" y2="155" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
                <line x1="169" y1="135" x2="169" y2="155" stroke="#1E293B" strokeWidth="0.4" opacity="0.5" />
              </g>

              {/* Foam/wake at bow */}
              <ellipse cx="22" cy="225" rx="14" ry="3" fill="white" opacity="0.6" />
              <ellipse cx="230" cy="225" rx="10" ry="2" fill="white" opacity="0.5" />
            </svg>
          </div>

          <div>
            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '20px',
                fontWeight: 700,
                color: '#166534',
                letterSpacing: '-0.01em',
              }}
            >
              Import Supply Management
            </h2>
            <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.55 }}>
              Track shipments, schedule transport, and manage every delivery from arrival to storage.
            </div>
          </div>
        </div>

        {/* RIGHT: form panel */}
        <div
          style={{
            flex: '1 1 380px',
            padding: '40px 40px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
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
        <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '13px' }}>
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#3E9B3E',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              padding: 0,
            }}
          >
            Forgot password?
          </button>
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
