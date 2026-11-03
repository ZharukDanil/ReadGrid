'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const typeStyles: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
    success: { bg: 'rgba(76,138,82,0.95)', border: '#4c8a52', color: '#f4e9d8', icon: '✅' },
    error: { bg: 'rgba(139,69,69,0.95)', border: '#8b4545', color: '#f4e9d8', icon: '❌' },
    info: { bg: 'rgba(112,84,68,0.95)', border: '#705444', color: '#f8d9a6', icon: 'ℹ️' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 3000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '340px',
        }}
      >
        {toasts.map(t => {
          const s = typeStyles[t.type];
          return (
            <div
              key={t.id}
              onClick={() => removeToast(t.id)}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontFamily: 'Merriweather, serif',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'toastSlideIn 0.3s ease',
              }}
            >
              <span>{s.icon}</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}