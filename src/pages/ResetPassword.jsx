import React, { useState, useEffect } from 'react';
import './ResetPassword.css';

function ResetPassword({ onBack }) {
  const [token] = useState('reset-token'); // Placeholder token
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validatePassword = (pwd) => {
    return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);
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

    let hasError = false;

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (!validatePassword(password)) {
      setPasswordError('Password must be 8+ chars with uppercase, lowercase, and number');
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
      // TODO: Call API endpoint to reset password
      // const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      // const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ token, password })
      // });

      console.log('🔑 Password reset would be submitted with token:', token);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

            <form onSubmit={handleSubmit} className="reset-password-form">
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isLoading}
                  className={passwordError ? 'error' : ''}
                />
                {passwordError && <span className="error-message">{passwordError}</span>}
              </div>

              <div className="password-requirements">
                <div className="requirement-title">Password must contain:</div>
                <div className="requirement">
                  <span className={`requirement-check ${password.length >= 8 ? 'met' : ''}`}>
                    {password.length >= 8 ? '✓' : '○'}
                  </span>
                  <span>At least 8 characters</span>
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
                  disabled={isLoading}
                  className={confirmError ? 'error' : ''}
                />
                {confirmError && <span className="error-message">{confirmError}</span>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
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
