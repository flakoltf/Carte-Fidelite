"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Tarifs (maquette 2a) : cartes réduites à l'essentiel — nom, volume, prix,
 * CTA. Les 6 features ne sont plus répétées ×3 : elles vivent dans le bandeau
 * « Tout est toujours inclus » rendu par la section appelante. Les animations
 * gadget (tilt 3D, compteur de prix, bordure conic) sont supprimées ; seul le
 * reveal en cascade reste, énergie « artisan » du reste de la page.
 */

export type PricingTier = {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  featured: boolean;
  cta: string;
  href: string;
};

export function PricingTiers({ tiers }: { tiers: PricingTier[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier, i) => (
        <motion.div
          key={tier.name}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
          className={`relative flex flex-col rounded-[20px] bg-surface p-[30px] ${
            tier.featured ? "border-2 border-halo" : "border border-line-warm"
          }`}
        >
          {tier.featured && (
            <span className="absolute -top-3 left-[30px] rounded-full bg-halo px-3 py-1 text-[11px] font-bold tracking-[0.08em] text-white">
              RECOMMANDÉ
            </span>
          )}
          <h3 className="font-display text-[22px]">{tier.name}</h3>
          <p className="mt-1 text-[13px] text-galet-ink">{tier.tagline}</p>
          <p className="mt-5">
            <span className="font-display text-[46px] font-light leading-none tracking-[-0.02em]">
              {tier.price}
            </span>
            <span className="font-sans text-base text-galet-ink"> {tier.unit}</span>
          </p>
          <Link
            href={tier.href}
            className={`mt-7 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[15px] font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo ${
              tier.featured
                ? "bg-halo text-white hover:bg-halo-600"
                : "border border-line-warm text-onyx hover:bg-calcaire"
            }`}
          >
            {tier.cta}
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
