import React, { useState } from 'react';
import { getApiUrl } from '../config/api';
import SupplierDashboard from './SupplierDashboard';

function SupplierLogin({ onClose }) {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('supplier_token'));
  const [activeForm, setActiveForm] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    supplierId: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: ''
  });

  // If logged in, show dashboard
  if (isLoggedIn) {
    return <SupplierDashboard onLogout={() => {
      localStorage.removeItem('supplier_token');
      localStorage.removeItem('supplier_user');
      setIsLoggedIn(false);
      setMessage('');
    }} />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('');

      const res = await fetch(getApiUrl('/api/supplier/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('supplier_token', data.token);
      localStorage.setItem('supplier_user', JSON.stringify(data.user));
      setIsLoggedIn(true);
      setMessage('');
    } catch (error) {
      console.error('Login error:', error);
      setMessage('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('');

      // Validation
      if (!registerForm.supplierId || !registerForm.email || !registerForm.password) {
        throw new Error('All fields are required');
      }

      if (registerForm.password !== registerForm.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (registerForm.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const res = await fetch(getApiUrl('/api/supplier/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: registerForm.supplierId,
          email: registerForm.email,
          password: registerForm.password,
          companyName: registerForm.companyName
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setMessage('✅ Account created successfully! Please log in.');
      setRegisterForm({
        supplierId: '',
        email: '',
        password: '',
        confirmPassword: '',
        companyName: ''
      });
      setTimeout(() => setActiveForm('login'), 2000);
    } catch (error) {
      console.error('Registration error:', error);
      setMessage('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #003d82 0%, #0066cc 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '450px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#003d82',
          color: 'white',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>📦 Supplier Portal</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Track your shipments</p>
        </div>

        {/* Form Container */}
        <div style={{ padding: '2rem' }}>
          {/* Message */}
          {message && (
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
              color: message.includes('✅') ? '#155724' : '#721c24',
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}>
              {message}
            </div>
          )}

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            borderBottom: '2px solid #f0f0f0'
          }}>
            <button
              onClick={() => {
                setActiveForm('login');
                setMessage('');
              }}
              style={{
                flex: 1,
                padding: '1rem',
                backgroundColor: activeForm === 'login' ? '#003d82' : 'transparent',
                color: activeForm === 'login' ? 'white' : '#666',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeForm === 'login' ? 'bold' : 'normal',
                borderBottom: activeForm === 'login' ? '3px solid #0066cc' : 'none'
              }}
            >
              🔑 Login
            </button>
            <button
              onClick={() => {
                setActiveForm('register');
                setMessage('');
              }}
              style={{
                flex: 1,
                padding: '1rem',
                backgroundColor: activeForm === 'register' ? '#003d82' : 'transparent',
                color: activeForm === 'register' ? 'white' : '#666',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeForm === 'register' ? 'bold' : 'normal',
                borderBottom: activeForm === 'register' ? '3px solid #0066cc' : 'none'
              }}
            >
              📝 Register
            </button>
          </div>

          {/* Login Form */}
          {activeForm === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="your-email@company.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '2.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      padding: '0'
                    }}
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#003d82',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Logging in...' : '🔓 Login'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {activeForm === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Supplier ID
                </label>
                <input
                  type="text"
                  value={registerForm.supplierId}
                  onChange={(e) => setRegisterForm({ ...registerForm, supplierId: e.target.value })}
                  placeholder="Your company's ID in the system"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  value={registerForm.companyName}
                  onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })}
                  placeholder="Your company name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  placeholder="your-email@company.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Password (min 8 characters)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '2.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      padding: '0'
                    }}
                    title={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '2.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      padding: '0'
                    }}
                    title={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#003d82',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Creating account...' : '✍️ Create Account'}
              </button>
            </form>
          )}

          {/* Back Button - Only show if onClose is provided */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6268'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
              title="Return to main application"
            >
              ← Back to Main App
            </button>
          )}

          {/* Footer */}
          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #eee',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.9rem'
          }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Need help? Contact support@synercore.com
            </p>
            <p style={{ margin: 0 }}>
              Secure login • Your data is encrypted • Privacy guaranteed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupplierLogin;
