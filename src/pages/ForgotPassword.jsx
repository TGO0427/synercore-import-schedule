import React, { useState } from 'react';
import './ForgotPassword.css';

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');

    if (!email) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      return;
    }

    try {
      setIsLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reset email');
      }

      setSubmitted(true);
    } catch (error) {
      setEmailError('Failed to send reset email. Please try again.');
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-content">
        <button
          className="forgot-password-back-btn"
          onClick={onBack}
          disabled={isLoading}
        >
          ← Back to Login
        </button>

        {!submitted ? (
          <>
            <div className="forgot-password-header">
              <h1>Reset Password</h1>
              <p>Enter your email address and we'll send you a link to reset your password</p>
            </div>

            <form onSubmit={handleSubmit} className="forgot-password-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  className={emailError ? 'error' : ''}
                />
                {emailError && <span className="error-message">{emailError}</span>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="submit-btn"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div className="success-container">
            <div className="success-icon">✓</div>
            <h2>Email Sent!</h2>
            <p>We've sent password reset instructions to <strong>{email}</strong>.</p>
            <p>Please check your inbox and follow the link to create a new password.</p>
            <p className="support-text">Didn't receive the email? Check your spam folder or contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
