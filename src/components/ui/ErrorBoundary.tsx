import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public override state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(_: Error): Partial<State> {
        return { hasError: true };
    }

    public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo,
        });
    }

    public override render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '20px',
                    background: '#fff0f0',
                    color: '#d00000',
                    fontFamily: 'monospace',
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 999999,
                    overflowY: 'auto'
                }}>
                    <h2 style={{ margin: '0 0 10px 0' }}>🚨 React App Crashed</h2>
                    <p style={{ fontWeight: 'bold' }}>Error: {this.state.error?.toString()}</p>
                    <details open style={{ whiteSpace: 'pre-wrap' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Component Stack Trace:</summary>
                        {this.state.errorInfo?.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
