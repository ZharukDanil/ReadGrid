'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function HomeButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Плавна поява кнопки відразу після монтування компонента
    const readyTimer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(readyTimer);
  }, [pathname]); // перезапускаємо при зміні сторінки, якщо потрібно

  if (pathname === '/') return null;

  return (
    <>
      <button
        onClick={() => router.push('/')}
        className={`home-btn ${ready ? 'ready' : ''}`}
        aria-label="На головну"
        title="На головну"
      >
        🏠
      </button>

      <style jsx>{`
        .home-btn {
          position: fixed;
          top: 20px;
          left: 110px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid #d9a866;
          background: linear-gradient(180deg, #3a2a22, #2a1e1a);
          color: #f4d99a;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          z-index: 1000;
          /* Додано плавний перехід для трансформацій при ховері */
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
        }

        /* Ефект красивої появи при завантаженні сторінки */
        .home-btn.ready {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          transition: opacity 0.35s ease, transform 0.35s ease, box-shadow 0.3s ease, visibility 0.35s ease;
        }

        .home-btn:hover {
          background: linear-gradient(180deg, #4a362a, #3a2a22);
          border-color: #f4d99a;
          transform: scale(1.08);
        }
      `}</style>
    </>
  );
}
