'use client';
import { useEffect, useState, ReactNode } from 'react';

export default function FadeIn({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      {children}
    </div>
  );
}