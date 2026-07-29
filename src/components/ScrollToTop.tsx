'use client';
import { useEffect, useState, useRef } from 'react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const handleScroll = () => {
      setVisible(window.scrollY > 150);
      setScrolling(true);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setScrolling(false), 250);
    };

    handleScroll();
    const recheck = setTimeout(handleScroll, 500);

    const readyTimer = setTimeout(() => setReady(true), 50);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(readyTimer);
      clearTimeout(recheck);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <button
        onClick={scrollToTop}
        className={`scroll-top-btn ${visible ? 'visible' : ''} ${ready ? 'ready' : ''} ${scrolling ? 'scrolling' : ''}`}
        aria-label="Повернутися наверх"
      >
        <span className="scroll-top-icon">↑</span>
        <span>Вгору</span>
      </button>

      <style jsx>{`
        .scroll-top-btn {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(-60px);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 30px;
          border: 1px solid #d9a866;
          background: linear-gradient(180deg, #3a2a22, #2a1e1a);
          color: #f4d99a;
          font-family: 'Merriweather', serif;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transition: none;
          z-index: 1000;
        }

        .scroll-top-btn.ready {
          transition: opacity 0.35s ease, transform 0.35s ease, box-shadow 0.3s ease, visibility 0.35s ease;
        }

        .scroll-top-btn.visible {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        .scroll-top-btn:hover {
          background: linear-gradient(180deg, #4a362a, #3a2a22);
          border-color: #f4d99a;
        }

        .scroll-top-icon {
          font-size: 1.1rem;
        }
      `}</style>
    </>
  );
}