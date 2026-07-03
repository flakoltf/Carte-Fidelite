"use client";

import { useState } from "react";
import Link from "next/link";
import TryItQR from "@/components/site/TryItQR";

/**
 * Configurateur de la landing (maquette 2a) : le visiteur choisit son métier
 * et voit la carte se recolorer. La carte est la version MARKETING simplifiée
 * de la maquette (avatar, nom, mécanique, récompense en or) — volontairement
 * distincte de la réplique wallet `LoyaltyCard` (anatomie de pass complète),
 * qui reste la référence sur /exemples.
 */

type Trade = {
  label: string;
  /** Fond de carte : linear-gradient 150deg (couleurs finales de la maquette). */
  bg: string;
  name: string;
  mechanic: string;
  reward: string;
};

const TRADES: Trade[] = [
  {
    label: "Café",
    bg: "linear-gradient(150deg, #4A362A, #2E211A)",
    name: "Café du Marché",
    mechanic: "Tampons — 6 / 9 cafés",
    reward: "Le 9ᵉ café offert.",
  },
  {
    label: "Coiffeur",
    bg: "linear-gradient(150deg, #4A2E44, #2C1B29)",
    name: "Salon Léa",
    mechanic: "Tampons — 3 / 5 rendez-vous",
    reward: "−20% au 5ᵉ rendez-vous.",
  },
  {
    label: "Boulangerie",
    bg: "linear-gradient(150deg, #8A6420, #5C420F)",
    name: "Boulangerie Perret",
    mechanic: "Tampons — 5 / 8 passages",
    reward: "La 8ᵉ baguette offerte.",
  },
  {
    label: "Boutique",
    bg: "linear-gradient(150deg, #14352F, #0C211D)",
    name: "Concept Sept",
    mechanic: "Paliers — statut Argent",
    reward: "−10% sur tout, dès maintenant.",
  },
];

export function CardConfigurator() {
  const [trade, setTrade] = useState(0);
  const t = TRADES[trade];

  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-mono text-xs tracking-[0.22em] text-halo">VOTRE CARTE</p>
      <h2 className="mt-5 max-w-[22ch] text-balance font-display text-4xl font-light leading-[1.06] tracking-[-0.02em] sm:text-[54px]">
        Et la vôtre, elle ressemblerait à quoi&nbsp;?
      </h2>

      {/* Puces métier — de vrais boutons, état porté par aria-pressed. */}
      <div className="mb-10 mt-9 flex flex-wrap justify-center gap-2.5">
        {TRADES.map((item, i) => {
          const active = i === trade;
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={active}
              onClick={() => setTrade(i)}
              className={`rounded-full border px-[22px] py-[11px] text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo ${
                active
                  ? "border-halo bg-halo text-white"
                  : "border-line-warm bg-surface text-onyx hover:border-halo/40"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-12">
        {/* La carte : le fond glisse en 400ms, les textes changent instantanément (voulu). */}
        <div
          className="w-full max-w-[560px] rounded-[26px] p-[34px] text-left shadow-[0_30px_60px_-25px_rgba(14,15,17,0.45)] [transition:background_400ms]"
          style={{ background: t.bg }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                aria-hidden
                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white/[0.14] font-display text-xl text-white"
              >
                {t.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-white">{t.name}</p>
                <p className="mt-0.5 text-[11px] tracking-[0.12em] text-white/55">CARTE FIDÉLITÉ</p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-white/45">№ 0001</span>
          </div>
          <p className="mb-2 mt-[30px] text-[13px] text-white/65">{t.mechanic}</p>
          <p className="font-display text-[22px] italic text-gold">{t.reward}</p>
        </div>

        {/* Essai immédiat : le QR démo existant, cadré à gauche. */}
        <div className="w-[220px]">
          <TryItQR
            align="left"
            title="Essayez, là, maintenant."
            description="Scannez : une carte démo arrive dans votre Wallet. Rien à installer."
          />
        </div>
      </div>

      <p className="mt-9 font-mono text-xs tracking-[0.06em] text-galet-ink">
        VOTRE VRAIE MAQUETTE SOUS UN JOUR OUVRÉ — OFFERT, SANS ENGAGEMENT
      </p>
      <Link
        href="/demarrer"
        className="mt-5 rounded-full bg-halo px-8 py-4 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halo"
      >
        Recevoir ma maquette
      </Link>
      <Link href="/exemples" className="mt-4 text-sm text-galet-ink transition-colors hover:text-onyx">
        Voir tous les exemples →
      </Link>
    </div>
  );
}
