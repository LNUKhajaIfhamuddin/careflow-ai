import { Component } from 'react';

/**
 * Fix: previously, any unexpected error thrown during rendering (a bad API
 * response shape, a null-reference bug, etc.) would unmount the entire React
 * tree and leave the user staring at a blank white page with no way to
 * recover except a hard refresh. This boundary catches render errors,
 * shows a friendly recovery screen, and logs the details to the console
 * for debugging instead of crashing silently.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('CareFlow AI encountered an unexpected error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            textAlign: 'center',
            background: 'var(--sage, #eff5f1)',
          }}
        >
          <h1 style={{ marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-muted, #5a6b64)', marginBottom: 24, maxWidth: 420 }}>
            CareFlow AI ran into an unexpected problem and couldn't display this
            page. Your data is safe — try returning to the dashboard.
          </p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            Return to dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
