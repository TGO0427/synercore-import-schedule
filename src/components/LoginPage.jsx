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

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
            <svg
              viewBox="0 0 400 280"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', maxWidth: '360px', height: 'auto', display: 'block' }}
              aria-hidden="true"
            >
              {/* Soft decorative circles */}
              <circle cx="70" cy="60" r="50" fill="#D1F2D3" opacity="0.55" />
              <circle cx="340" cy="45" r="32" fill="#FEF3C7" opacity="0.65" />
              <circle cx="360" cy="200" r="40" fill="#D1F2D3" opacity="0.35" />

              {/* Road */}
              <line x1="20" y1="235" x2="380" y2="235" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 5" />

              {/* Stacked boxes (left of truck) */}
              <g>
                <rect x="40" y="195" width="42" height="42" rx="2" fill="#F59E0B" />
                <line x1="40" y1="216" x2="82" y2="216" stroke="#B45309" strokeWidth="1.2" />
                <line x1="61" y1="195" x2="61" y2="237" stroke="#B45309" strokeWidth="1.2" />

                <rect x="52" y="160" width="32" height="35" rx="2" fill="#EF4444" />
                <line x1="52" y1="177" x2="84" y2="177" stroke="#B91C1C" strokeWidth="1.2" />
                <line x1="68" y1="160" x2="68" y2="195" stroke="#B91C1C" strokeWidth="1.2" />
              </g>

              {/* Truck cargo box */}
              <rect x="100" y="135" width="155" height="100" rx="5" fill="white" stroke="#CBD5E1" strokeWidth="2" />
              {/* Synercore-style mark on cargo side */}
              <circle cx="178" cy="180" r="22" fill="#4FB84F" opacity="0.15" />
              <circle cx="178" cy="180" r="13" fill="none" stroke="#4FB84F" strokeWidth="2.5" />
              <circle cx="178" cy="180" r="3" fill="#4FB84F" />

              {/* Truck cab (brand green) */}
              <path d="M 255 235 L 255 165 L 278 145 L 320 145 L 320 235 Z" fill="#4FB84F" />
              <path d="M 278 150 L 316 150 L 316 175 L 278 175 Z" fill="#B5E8B8" opacity="0.75" />
              <rect x="282" y="198" width="12" height="18" rx="2" fill="#3E9B3E" />

              {/* Bumper */}
              <rect x="320" y="220" width="6" height="14" rx="1" fill="#334155" />

              {/* Wheels */}
              <g>
                <circle cx="135" cy="238" r="14" fill="#1E293B" />
                <circle cx="135" cy="238" r="5" fill="#64748B" />
                <circle cx="220" cy="238" r="14" fill="#1E293B" />
                <circle cx="220" cy="238" r="5" fill="#64748B" />
                <circle cx="298" cy="238" r="14" fill="#1E293B" />
                <circle cx="298" cy="238" r="5" fill="#64748B" />
              </g>

              {/* Pin marker */}
              <g transform="translate(345, 120)">
                <path d="M 0 0 Q 0 -18, -13 -18 Q -26 -18, -26 0 Q -26 14, -13 26 Q 0 14, 0 0 Z" fill="#4FB84F" />
                <circle cx="-13" cy="-2" r="5" fill="white" />
              </g>

              {/* Small package floating bottom-right */}
              <g>
                <rect x="320" y="248" width="18" height="14" rx="1.5" fill="#3B82F6" />
                <line x1="329" y1="248" x2="329" y2="262" stroke="#1E40AF" strokeWidth="1" />
                <line x1="320" y1="254" x2="338" y2="254" stroke="#1E40AF" strokeWidth="1" />
              </g>
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
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.5); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default LoginPage;
