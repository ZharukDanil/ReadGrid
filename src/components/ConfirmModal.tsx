'use client';
import React from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Так, підтвердити',
  cancelLabel = 'Скасувати',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
        padding: '1rem',
        animation: 'confirmFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(42, 30, 26, 0.98) 0%, rgba(60, 43, 38, 0.98) 100%)',
          border: '1px solid rgba(202, 169, 138, 0.3)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          fontFamily: 'Merriweather, serif',
          animation: 'confirmScaleIn 0.25s ease',
        }}
      >
        <h3 style={{ margin: 0, color: '#f8d9a6', fontSize: '1.3rem', textAlign: 'center' }}>
          {danger ? '⚠️' : '❓'} {title}
        </h3>
        <p style={{ color: '#d8c3a5', fontSize: '1rem', lineHeight: 1.6, textAlign: 'center', margin: '1rem 0 1.8rem' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.7rem 1.4rem',
              background: 'rgba(112,84,68,0.3)',
              color: '#e0c9a6',
              border: '1px solid rgba(112,84,68,0.5)',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.7rem 1.4rem',
              background: danger
                ? 'linear-gradient(135deg, #8b4545 0%, #a55555 100%)'
                : 'linear-gradient(135deg, #4c8a52 0%, #5ba963 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.95rem',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmScaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}