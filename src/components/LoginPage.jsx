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
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Illustration band — container ship at port */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0a2540 0%, #1a3a5c 100%)',
            padding: '20px 24px 0',
            position: 'relative',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div
              style={{
                display: 'inline-block',
                background: 'white',
                padding: '8px 14px',
                borderRadius: '8px',
              }}
            >
              <SynercoreLogo size={36} />
            </div>
          </div>
          <svg
            viewBox="0 0 440 160"
            preserveAspectRatio="xMidYMax meet"
            style={{ width: '100%', height: '130px', display: 'block' }}
            aria-hidden="true"
          >
            {/* Distant stars */}
            <g fill="white" opacity="0.35">
              <circle cx="40" cy="18" r="1" />
              <circle cx="95" cy="32" r="1" />
              <circle cx="165" cy="14" r="1" />
              <circle cx="240" cy="28" r="1" />
              <circle cx="315" cy="18" r="1" />
              <circle cx="385" cy="30" r="1" />
            </g>
            {/* Port crane (background) */}
            <g opacity="0.55" stroke="#5A7A9A" fill="#5A7A9A">
              <rect x="55" y="56" width="3" height="70" />
              <rect x="36" y="56" width="60" height="3" />
              <line x1="72" y1="59" x2="72" y2="86" strokeWidth="1" />
              <rect x="69" y="86" width="6" height="5" />
              <rect x="52" y="126" width="9" height="4" />
            </g>
            {/* Port crane 2 */}
            <g opacity="0.45" stroke="#5A7A9A" fill="#5A7A9A">
              <rect x="380" y="64" width="3" height="62" />
              <rect x="362" y="64" width="55" height="3" />
              <line x1="395" y1="67" x2="395" y2="90" strokeWidth="1" />
              <rect x="392" y="90" width="6" height="5" />
            </g>
            {/* Sea line subtle */}
            <line x1="0" y1="126" x2="440" y2="126" stroke="#3E5A7A" strokeWidth="0.5" opacity="0.6" />
            {/* Ship hull */}
            <path d="M 135 130 L 335 130 L 322 148 L 148 148 Z" fill="#1E293B" />
            <rect x="135" y="126" width="200" height="5" fill="#334155" />
            {/* Bridge / cabin */}
            <rect x="300" y="98" width="26" height="28" fill="#334155" />
            <rect x="305" y="104" width="4" height="5" fill="#F8FAFC" opacity="0.75" />
            <rect x="313" y="104" width="4" height="5" fill="#F8FAFC" opacity="0.75" />
            <rect x="321" y="104" width="4" height="5" fill="#F8FAFC" opacity="0.75" />
            {/* Container stacks (bottom row) */}
            <rect x="150" y="108" width="24" height="18" fill="#4FB84F" />
            <rect x="176" y="108" width="24" height="18" fill="#EF4444" />
            <rect x="202" y="108" width="24" height="18" fill="#F59E0B" />
            <rect x="228" y="108" width="24" height="18" fill="#3B82F6" />
            <rect x="254" y="108" width="24" height="18" fill="#4FB84F" />
            <rect x="280" y="108" width="18" height="18" fill="#E5E7EB" />
            {/* Container stacks (top row) */}
            <rect x="164" y="90" width="24" height="18" fill="#E5E7EB" />
            <rect x="190" y="90" width="24" height="18" fill="#4FB84F" />
            <rect x="216" y="90" width="24" height="18" fill="#3B82F6" />
            <rect x="242" y="90" width="24" height="18" fill="#EF4444" />
            <rect x="268" y="90" width="24" height="18" fill="#F59E0B" />
            {/* Mast */}
            <line x1="313" y1="98" x2="313" y2="82" stroke="#64748B" strokeWidth="1" />
            <circle cx="313" cy="82" r="1.4" fill="#FBBF24" />
            {/* Water ripples */}
            <path d="M 120 138 Q 135 135, 150 138 T 180 138" fill="none" stroke="#3E5A7A" strokeWidth="1" opacity="0.6" />
            <path d="M 270 142 Q 285 139, 300 142 T 330 142" fill="none" stroke="#3E5A7A" strokeWidth="1" opacity="0.6" />
            <path d="M 60 152 Q 80 149, 100 152 T 140 152" fill="none" stroke="#3E5A7A" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', padding: '22px 40px 0' }}>
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            Login Form
          </h1>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '22px' }}>
            Import Supply Management System
          </div>
        </div>

        <div style={{ padding: '0 40px 36px' }}>

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
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.5); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default LoginPage;
