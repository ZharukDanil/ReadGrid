'use client';
import React from 'react';

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // У продакшені тут можна відправляти помилку в сервіс логування
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            background: 'rgba(139,69,69,0.1)',
            border: '1px solid rgba(139,69,69,0.35)',
            borderRadius: '16px',
            margin: '2rem auto',
            maxWidth: '500px',
            fontFamily: 'Merriweather, serif',
          }}
        >
          <p style={{ fontSize: '2.5rem', margin: 0 }}>⚠️</p>
          <h3 style={{ color: '#f8d9a6', margin: '1rem 0 0.5rem' }}>
            {this.props.fallbackTitle || 'Щось пішло не так'}
          </h3>
          <p style={{ color: '#d8c3a5', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Ця частина сторінки не змогла завантажитись. Спробуйте оновити її.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.7rem 1.4rem',
              background: 'linear-gradient(135deg, #705444 0%, #8b6b57 100%)',
              color: '#f8d9a6',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 Спробувати ще раз
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}