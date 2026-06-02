"use client";
import { useEffect, useRef } from "react";
import { useHaloMotion } from "./useHaloMotion";

/** Confettis sobres emeraude/or sur un canvas leger. Respecte reduced-motion. */
export function Celebrate({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reduced } = useHaloMotion();
  useEffect(() => {
    if (!fire || reduced) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = (cv.width = cv.offsetWidth);
    const H = (cv.height = cv.offsetHeight);
    const colors = ["#0D6B5E", "#1FB89A", "#C9A56B"];
    const parts = Array.from({ length: 80 }, (_, i) => ({
      x: W / 2,
      y: H / 2,
      r: 3 + (i % 3),
      a: (i / 80) * Math.PI * 2,
      v: 2 + (i % 5),
      c: colors[i % 3],
      life: 1,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.x += Math.cos(p.a) * p.v;
        p.y += Math.sin(p.a) * p.v + 1.2;
        p.life -= 0.012;
        if (p.life > 0) {
          alive = true;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [fire, reduced]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
