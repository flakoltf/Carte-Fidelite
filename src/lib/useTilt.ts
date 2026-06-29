"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TiltOptions = {
  /** Amplitude maximale d'inclinaison en degrés (rotateX / rotateY). */
  max?: number;
};

/**
 * Inclinaison 3D légère qui suit le curseur + position du pointeur pour un reflet.
 *
 * - Désactivé sans pointeur fin (mobile/tactile) et si `prefers-reduced-motion`.
 * - N'expose les handlers que lorsque l'effet est actif → aucun coût au survol mobile.
 * - Écrit des CSS vars sur l'élément (`--rx`, `--ry`, `--mx`, `--my`, `--glare`)
 *   consommées par le `transform` (perspective) et l'overlay de reflet.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>({ max = 10 }: TiltOptions = {}) {
  const ref = useRef<T>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mqPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(mqPointer.matches && !mqReduce.matches);
    // initial différé (async) + abonnement aux changements → conforme à set-state-in-effect
    const raf = requestAnimationFrame(update);
    mqPointer.addEventListener("change", update);
    mqReduce.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      mqPointer.removeEventListener("change", update);
      mqReduce.removeEventListener("change", update);
    };
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0 → 1
      const py = (e.clientY - r.top) / r.height; // 0 → 1
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty("--rx", `${-(py - 0.5) * 2 * max}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      el.style.setProperty("--glare", "1");
    },
    [max],
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glare", "0");
  }, []);

  return {
    ref,
    enabled,
    tiltHandlers: enabled ? { onMouseMove, onMouseLeave } : {},
  };
}
