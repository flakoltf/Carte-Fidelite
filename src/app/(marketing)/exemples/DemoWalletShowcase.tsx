"use client";

import { useState } from "react";
import ApplePassPreview from "@/app/(app)/admin/merchants/[id]/card/ApplePassPreview";
import GooglePassPreview from "@/app/(app)/admin/merchants/[id]/card/GooglePassPreview";
import { DEMO_CARDS } from "@/content/demo-cards";

/**
 * Vitrine /exemples : 4 configurations `CardDesign` réelles rendues par les
 * MÊMES composants d'aperçu que l'admin — ce que le visiteur voit est ce que
 * le studio produit, pas une illustration marketing.
 */
export default function DemoWalletShowcase() {
  const [selected, setSelected] = useState(0);
  const card = DEMO_CARDS[selected];
  // Rendu Google : couleurs propres si la carte en définit (cf. Boulangerie
  // Perret — pastel Apple assumé, foncé obligatoire côté Google).
  const googleDesign = card.googleColors
    ? { ...card.design, colors: card.googleColors }
    : card.design;

  return (
    <div className="flex flex-col items-center">
      {/* Sélecteur — mêmes conventions que les puces du configurateur. */}
      <div className="flex flex-wrap justify-center gap-2.5" role="group" aria-label="Choisir un exemple de carte">
        {DEMO_CARDS.map((c, i) => {
          const active = i === selected;
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(i)}
              className={`rounded-full border px-[22px] py-[11px] text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo ${
                active
                  ? "border-halo bg-halo text-white"
                  : "border-line-warm bg-surface text-onyx hover:border-halo/40"
              }`}
            >
              {c.title}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-sm text-galet-ink">{card.pitch}</p>

      <div className="mt-8 flex flex-col items-start justify-center gap-8 sm:flex-row">
        <figure className="flex w-full max-w-[330px] flex-col items-center gap-2.5">
          <ApplePassPreview design={card.design} sample={card.sample} />
          <figcaption className="font-mono text-[11px] tracking-[0.14em] text-galet-ink">
            APPLE WALLET
          </figcaption>
        </figure>
        <figure className="flex w-full max-w-[330px] flex-col items-center gap-2.5">
          <GooglePassPreview design={googleDesign} sample={card.sample} />
          <figcaption className="font-mono text-[11px] tracking-[0.14em] text-galet-ink">
            GOOGLE WALLET
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
