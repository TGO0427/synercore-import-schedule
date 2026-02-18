import React, { useState, useEffect } from 'react';
import './ResetPassword.css';

function ResetPassword({ onBack }) {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Extract token and email from URL query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    const resetEmail = params.get('email');

    if (!resetToken || !resetEmail) {
      setTokenError('Invalid or missing reset link. Please request a new password reset.');
    } else {
      setToken(resetToken);
      setEmail(decodeURIComponent(resetEmail));
    }
  }, []);

  const validatePassword = (pwd) => {
    return pwd.length >= 6 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setPasswordError('');
  };

  const handleConfirmChange = (e) => {
    setConfirmPassword(e.target.value);
    setConfirmError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setConfirmError('');

    if (tokenError) {
      return;
    }

    let hasError = false;

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (!validatePassword(password)) {
      setPasswordError('Password must be 6+ chars with uppercase, lowercase, and number');
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password');
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmError('Passwords do not match');
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      setSubmitted(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      setPasswordError('Failed to reset password. Please try again.');
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reset-password-container">
      <div className="reset-password-content">
        <button
          className="reset-password-back-btn"
          onClick={onBack}
          disabled={isLoading}
        >
          ← Back to Login
        </button>

        {!submitted ? (
          <>
            <div className="reset-password-header">
              <h1>Create New Password</h1>
              <p>Enter a new password for your account</p>
            </div>

            {tokenError && (
              <div className="error-alert">
                <p>{tokenError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="reset-password-form" disabled={!!tokenError}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isLoading || !!tokenError}
                  className={passwordError ? 'error' : ''}
                />
                {passwordError && <span className="error-message">{passwordError}</span>}
              </div>

              <div className="password-requirements">
                <div className="requirement-title">Password must contain:</div>
                <div className="requirement">
                  <span className={`requirement-check ${password.length >= 6 ? 'met' : ''}`}>
                    {password.length >= 6 ? '✓' : '○'}
                  </span>
                  <span>At least 6 characters</span>
                </div>
                <div className="requirement">
                  <span className={`requirement-check ${/[A-Z]/.test(password) ? 'met' : ''}`}>
                    {/[A-Z]/.test(password) ? '✓' : '○'}
                  </span>
                  <span>One uppercase letter</span>
                </div>
                <div className="requirement">
                  <span className={`requirement-check ${/[a-z]/.test(password) ? 'met' : ''}`}>
                    {/[a-z]/.test(password) ? '✓' : '○'}
                  </span>
                  <span>One lowercase letter</span>
                </div>
                <div className="requirement">
                  <span className={`requirement-check ${/\d/.test(password) ? 'met' : ''}`}>
                    {/\d/.test(password) ? '✓' : '○'}
                  </span>
                  <span>One number</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={handleConfirmChange}
                  disabled={isLoading || !!tokenError}
                  className={confirmError ? 'error' : ''}
                />
                {confirmError && <span className="error-message">{confirmError}</span>}
              </div>

              <button
                type="submit"
                disabled={isLoading || !!tokenError}
                className="submit-btn"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        ) : (
          <div className="success-container">
            <div className="success-icon">✓</div>
            <h2>Success!</h2>
            <p>Your password has been reset successfully.</p>
            <p>Redirecting to login...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
