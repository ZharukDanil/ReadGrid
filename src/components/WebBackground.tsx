'use client';
import { useEffect } from 'react';

export default function WebBackground() {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.id = "readgrid-web";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "-60";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const mouse = { x: width / 2, y: height / 2, radius: 120 };

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    type Point = { x: number; y: number; vx: number; vy: number; phase: number };
    const points: Point[] = [];
    const pointCount = 50;

    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: 85 + Math.random() * (width - 170),
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2
      });
    }

    let animationId: number;

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < pointCount; i++) {
        const p1 = points[i];
        if (p1.x <= 85 || p1.x >= width - 85) continue;

        for (let j = i + 1; j < pointCount; j++) {
          const p2 = points[j];
          if (p2.x <= 85 || p2.x >= width - 85) continue;

          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 160) {
            const alpha = 0.05 + (1 - dist / 160) * 0.15 + 0.05 * Math.sin(p1.phase + Date.now() * 0.002);
            ctx.strokeStyle = `rgba(210,180,140,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < pointCount; i++) {
        const p = points[i];

        p.x += p.vx;
        p.y += p.vy;
        p.phase += 0.01;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          p.vx -= dx * 0.0002 * force;
          p.vy -= dy * 0.0002 * force;
        }

        if (p.x > 85 && p.x < width - 85) {
          ctx.fillStyle = `rgba(210,180,140,${0.2 + 0.1 * Math.sin(p.phase)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      canvas.remove();
    };
  }, []);

  return null;
}