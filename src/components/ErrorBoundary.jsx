import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1>Something Went Wrong</h1>
            <p>We're sorry for the inconvenience. An unexpected error has occurred.</p>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                {this.state.error && (
                  <pre className="error-stack">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div className="error-actions">
              <button
                className="error-retry-btn"
                onClick={this.resetError}
              >
                Try Again
              </button>
              <button
                className="error-home-btn"
                onClick={() => window.location.href = '/'}
              >
                Go to Home
              </button>
            </div>

            {this.state.errorCount > 3 && (
              <p className="error-warning">
                Multiple errors detected. Please refresh the page or contact support if the problem persists.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
