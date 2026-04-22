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
  const [stars, setStars] = useState([]);
  const [networkLines, setNetworkLines] = useState([]);

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBERED_USERNAME_KEY);
    if (remembered) {
      setCredentials((prev) => ({ ...prev, username: remembered }));
      setRememberMe(true);
    }

    const generatedStars = [];
    for (let i = 0; i < 100; i++) {
      generatedStars.push({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 4,
      });
    }
    setStars(generatedStars);

    const generatedLines = [];
    for (let i = 0; i < 20; i++) {
      generatedLines.push({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        width: Math.random() * 200 + 50,
        rotation: Math.random() * 360,
        delay: Math.random() * 3,
      });
    }
    setNetworkLines(generatedLines);
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
        background: 'linear-gradient(135deg, #0a2540 0%, #1a3a5c 50%, #0f2a48 100%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Stars */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {stars.map((star) => (
          <div
            key={star.id}
            style={{
              position: 'absolute',
              width: '2px',
              height: '2px',
              background: 'white',
              borderRadius: '50%',
              left: `${star.left}%`,
              top: `${star.top}%`,
              animation: 'twinkle 4s ease-in-out infinite',
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Network lines */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {networkLines.map((line) => (
          <div
            key={line.id}
            style={{
              position: 'absolute',
              background: 'linear-gradient(90deg, transparent, rgba(79, 184, 79, 0.4), transparent)',
              height: '2px',
              left: `${line.left}%`,
              top: `${line.top}%`,
              width: `${line.width}px`,
              transform: `rotate(${line.rotation}deg)`,
              animation: 'pulse 3s ease-in-out infinite',
              animationDelay: `${line.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Rotating globe background */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          opacity: 0.25,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), transparent),
                        url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>')`,
            animation: 'rotate 60s linear infinite',
          }}
        />
      </div>

      {/* Card */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          padding: '36px 40px',
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <SynercoreLogo size={44} />
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1
            style={{
              margin: '16px 0 4px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            Login Form
          </h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Import Supply Management System</div>
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

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.5); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default LoginPage;
