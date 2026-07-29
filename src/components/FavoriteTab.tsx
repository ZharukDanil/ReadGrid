'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FavoriteTab() {
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      onClick={() => router.push('/favorites')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        top: isHovered ? '0' : '-85px',
        right: '120px',
        width: '110px',
        height: '150px',
        cursor: 'pointer',
        opacity: mounted ? 1 : 0,
        transition: 'top 0.4s ease, transform 0.2s ease, opacity 0.4s ease',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '25px',
      }}      
    >
      {/* остальное без изменений */}
      <svg
        width="110"
        height="150"
        viewBox="0 0 110 150"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))',
        }}
      >
        <defs>
          <linearGradient id="bookmarkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'rgba(139,107,87,1)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'rgba(112,84,68,1)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path
          d="M 5 0 L 105 0 L 105 130 L 55 150 L 5 130 Z"
          fill="url(#bookmarkGradient)"
        />
        <path
          d="M 5 0 L 105 0 L 105 130 L 55 150 L 5 130 Z"
          fill="none"
          stroke="rgba(248,217,166,0.4)"
          strokeWidth="2"
        />
      </svg>

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          color: '#f8d9a6',
          fontWeight: 600,
          fontSize: '2rem',
          marginBottom: '5px',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          📑
        </div>
        <div style={{
          color: '#f8d9a6',
          fontWeight: 600,
          fontSize: '0.95rem',
          textAlign: 'center',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          letterSpacing: '0.5px',
        }}>
          Обране
        </div>
      </div>
    </div>
  );
}