"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTilt } from "@/lib/useTilt";

export type PricingTier = {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  featured: boolean;
  cta: string;
  href: string;
  features: string[];
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Compteur de prix 0 → montant (easeOutCubic), déclenché au reveal.
 *  Valeur initiale = montant réel → SSR / sans-JS affichent le vrai prix. */
function usePriceCounter(target: number, run: boolean, durationMs = 1000) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (!run) return;
    if (prefersReducedMotion()) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      setVal(Math.round(target * easeOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setVal(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  return val;
}

export function PricingTiers({ tiers }: { tiers: PricingTier[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const el = gridRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={gridRef} className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier, i) => (
        <PricingCard key={tier.name} tier={tier} index={i} shown={shown} />
      ))}
    </div>
  );
}

function PricingCard({ tier, index, shown }: { tier: PricingTier; index: number; shown: boolean }) {
  const { ref, enabled, tiltHandlers } = useTilt<HTMLDivElement>({ max: 10 });
  const price = Number(tier.price);
  const numeric = Number.isFinite(price);
  const display = usePriceCounter(numeric ? price : 0, shown);

  return (
    // reveal en cascade (translateY + opacity), stagger 140ms
    <div
      className="h-full transition-all duration-700 ease-[var(--ease-out)] motion-reduce:!transition-none"
      style={{
        transitionDelay: `${index * 140}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
      }}
    >
      {/* wrapper d'inclinaison 3D (desktop, pointeur fin, hors reduced-motion) */}
      <div
        ref={ref}
        {...tiltHandlers}
        className="group relative h-full [transform-style:preserve-3d] [transition:transform_160ms_var(--ease-out)] [will-change:transform]"
        style={
          enabled
            ? { transform: "perspective(1600px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))" }
            : undefined
        }
      >
        {/* tier recommandé : bordure conic-gradient animée (tokens émeraude) */}
        {tier.featured && (
          <span
            aria-hidden
            className="halo-border-spin pointer-events-none absolute -inset-px rounded-2xl"
            style={{
              background:
                "conic-gradient(from var(--halo-angle), var(--color-halo), var(--color-halo-glow), var(--color-halo-600), var(--color-halo))",
            }}
          />
        )}

        <div
          className={`relative flex h-full flex-col rounded-2xl bg-surface p-8 ${
            tier.featured ? "shadow-[0_16px_50px_-20px_rgba(13,107,94,0.35)]" : "border border-line-warm shadow-sm"
          }`}
        >
          {/* reflet lumineux suivant le pointeur (derrière le contenu, lisibilité préservée) */}
          {enabled && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-[var(--glare,0)] transition-opacity duration-200"
              style={{
                background:
                  "radial-gradient(380px circle at var(--mx,50%) var(--my,50%), color-mix(in oklab, var(--color-halo-glow) 22%, transparent), transparent 60%)",
              }}
            />
          )}

          <div className="relative flex flex-1 flex-col">
            <h3 className="font-display text-2xl">{tier.name}</h3>
            <p className="mt-1 text-sm text-galet-ink">{tier.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-light tabular-nums">{numeric ? display : tier.price}</span>
              {tier.unit && <span className="text-sm text-galet-ink">{tier.unit}</span>}
            </div>
            <ul className="mt-7 flex-1 space-y-3">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-onyx/90">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.href}
              className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo ${
                tier.featured ? "bg-halo text-white hover:bg-halo-600" : "border border-line-warm text-onyx hover:bg-calcaire"
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
