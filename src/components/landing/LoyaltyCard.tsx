import type { LucideIcon } from "lucide-react";
import {
  Scissors,
  Coffee,
  UtensilsCrossed,
  Croissant,
  ShoppingBag,
  Dumbbell,
  Flower2,
  Pizza,
  Sparkles,
  Car,
} from "lucide-react";
import QRCode from "react-qr-code";

type Mechanic =
  | { kind: "stamps"; total: number; filled: number; label: string }
  | { kind: "points"; current: string; target: string; unit: string; pct: number }
  | { kind: "tier"; badge: string; next: string }
  | { kind: "cashback"; balance: string; rate: string }
  | { kind: "pass"; n: string; label: string };

export type CardData = {
  name: string;
  type: string;
  Icon: LucideIcon;
  bg: string;
  fg: string;
  accent: string;
  mechanic: Mechanic;
  reward: string;
};

function MechanicView({ m, accent }: { m: Mechanic; accent: string }) {
  if (m.kind === "stamps") {
    return (
      <div>
        <div className="flex flex-wrap gap-[6px]">
          {Array.from({ length: m.total }).map((_, i) => (
            <span
              key={i}
              className="h-[22px] w-[22px] rounded-full border"
              style={
                i < m.filled
                  ? { background: accent, borderColor: accent, boxShadow: `0 0 9px ${accent}` }
                  : { borderColor: accent, opacity: 0.45 }
              }
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] opacity-75">{m.label}</p>
      </div>
    );
  }
  if (m.kind === "points") {
    return (
      <div>
        <p className="font-display text-3xl font-light leading-none">
          {m.current}
          <span className="ml-1.5 font-sans text-[10px] uppercase tracking-[0.18em] opacity-60">
            {m.unit}
          </span>
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/20">
          <span
            className="block h-full rounded-full"
            style={{ width: `${m.pct}%`, background: accent, boxShadow: `0 0 9px ${accent}` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] opacity-70">Objectif {m.target} {m.unit}</p>
      </div>
    );
  }
  if (m.kind === "tier") {
    return (
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ background: accent, color: "#16140f" }}
        >
          ◆ {m.badge}
        </span>
        <p className="mt-2.5 text-[11px] opacity-75">{m.next}</p>
      </div>
    );
  }
  if (m.kind === "cashback") {
    return (
      <div>
        <p className="font-display text-3xl font-light">CHF {m.balance}</p>
        <span
          className="mt-2 inline-block rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]"
          style={{ borderColor: accent }}
        >
          {m.rate}
        </span>
      </div>
    );
  }
  return (
    <div>
      <p className="font-display text-4xl font-light leading-none">{m.n}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] opacity-65">{m.label}</p>
    </div>
  );
}

export function LoyaltyCard({ card, delay = 0 }: { card: CardData; delay?: number }) {
  const { name, type, Icon, bg, fg, accent, mechanic, reward } = card;
  return (
    <div
      className="group relative isolate flex aspect-[1.62/1] flex-col justify-between overflow-hidden rounded-[18px] p-5 shadow-[0_24px_48px_-22px_rgba(0,0,0,0.75)]"
      style={{ background: bg, color: fg }}
    >
      {/* holographic + sheen */}
      <span
        className="halo-holo pointer-events-none absolute inset-0 z-0 opacity-[0.32]"
        style={{ animationDelay: `${delay * -1.3}s` }}
        aria-hidden
      />
      <span
        className="halo-sheen pointer-events-none absolute -top-1/2 left-0 z-[1] h-[200%] w-[36%]"
        style={{ animationDelay: `${delay * -0.9}s` }}
        aria-hidden
      />
      {/* accent edge */}
      <span
        className="absolute inset-y-0 right-0 z-[4] w-[5px]"
        style={{ background: accent, boxShadow: `0 0 16px ${accent}` }}
        aria-hidden
      />

      <div className="relative z-[2] flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] shadow-md"
          style={{ background: accent }}
        >
          <Icon className="h-5 w-5" style={{ color: "#16140f" }} strokeWidth={2} aria-hidden />
        </span>
        <div>
          <p className="text-[16px] font-semibold leading-tight">{name}</p>
          <p className="text-[10px] uppercase tracking-[0.16em] opacity-60">{type}</p>
        </div>
      </div>

      <div className="relative z-[2]">
        <MechanicView m={mechanic} accent={accent} />
      </div>

      <div className="relative z-[2] flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] leading-snug opacity-90">{reward}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 font-display text-[11px] tracking-[0.14em] opacity-40">
            <span className="inline-block h-[7px] w-[7px] rounded-full border border-current" />
            HALO
          </p>
        </div>
        <div className="shrink-0 rounded-lg bg-white p-1.5 shadow-md">
          <QRCode value={`https://halo.ch/c/${name.toLowerCase().replace(/\s+/g, "-")}`} size={44} bgColor="#FFFFFF" fgColor="#0E0F11" />
        </div>
      </div>
    </div>
  );
}

export const SAMPLE_CARDS: CardData[] = [
  {
    name: "Studio Ciseaux", type: "Coiffeur", Icon: Scissors,
    bg: "linear-gradient(150deg,#2b2622,#15110e)", fg: "#F3EFE7", accent: "#C9A56B",
    mechanic: { kind: "stamps", total: 10, filled: 7, label: "7 / 10 coupes" },
    reward: "La 10ᵉ coupe offerte.",
  },
  {
    name: "Café Léman", type: "Café · Coffee shop", Icon: Coffee,
    bg: "linear-gradient(150deg,#3a2d23,#211710)", fg: "#F6EEE2", accent: "#D8A567",
    mechanic: { kind: "stamps", total: 9, filled: 6, label: "6 / 9 cafés" },
    reward: "Le 9ᵉ café offert.",
  },
  {
    name: "Trattoria Bella", type: "Restaurant", Icon: UtensilsCrossed,
    bg: "linear-gradient(150deg,#3a1f22,#1c0f11)", fg: "#F7ECE6", accent: "#E0734F",
    mechanic: { kind: "points", current: "1 240", target: "1 500", unit: "pts", pct: 82 },
    reward: "Plus que 260 pts → −20 CHF.",
  },
  {
    name: "Le Fournil", type: "Boulangerie", Icon: Croissant,
    bg: "linear-gradient(150deg,#4a3a26,#2a2014)", fg: "#FBF2E2", accent: "#E8B964",
    mechanic: { kind: "stamps", total: 8, filled: 4, label: "4 / 8 achats" },
    reward: "La 8ᵉ viennoiserie offerte.",
  },
  {
    name: "Maison Rive", type: "Boutique mode", Icon: ShoppingBag,
    bg: "linear-gradient(150deg,#1a1a1c,#0c0c0d)", fg: "#F3F0E9", accent: "#B9BDC2",
    mechanic: { kind: "tier", badge: "Argent", next: "Plus que 1 achat → niveau Or" },
    reward: "Niveau Or → −15% permanents.",
  },
  {
    name: "Pulse Gym", type: "Salle de sport", Icon: Dumbbell,
    bg: "linear-gradient(150deg,#16181a,#0a0b0c)", fg: "#F0F4F2", accent: "#C6F24A",
    mechanic: { kind: "pass", n: "12", label: "séances ce mois-ci" },
    reward: "15 séances → 1 coaching offert.",
  },
  {
    name: "Nüage Spa", type: "Institut de beauté", Icon: Sparkles,
    bg: "linear-gradient(150deg,#3a2a33,#221820)", fg: "#F8ECF1", accent: "#E0A6BE",
    mechanic: { kind: "cashback", balance: "24.50", rate: "5% rendu sur chaque soin" },
    reward: "Cagnotte utilisable dès 20 CHF.",
  },
  {
    name: "AquaShine", type: "Lavage auto", Icon: Car,
    bg: "linear-gradient(150deg,#1c2733,#0e151c)", fg: "#E9F1F7", accent: "#4FA3E0",
    mechanic: { kind: "stamps", total: 5, filled: 4, label: "4 / 5 lavages" },
    reward: "Le 5ᵉ lavage offert.",
  },
  {
    name: "Flora", type: "Fleuriste", Icon: Flower2,
    bg: "linear-gradient(150deg,#1f3329,#11201a)", fg: "#ECF6EF", accent: "#6FC79A",
    mechanic: { kind: "points", current: "340", target: "500", unit: "pts", pct: 68 },
    reward: "500 pts → un bouquet offert.",
  },
  {
    name: "Napoli", type: "Pizzeria", Icon: Pizza,
    bg: "linear-gradient(150deg,#3a201c,#1c0f0d)", fg: "#FBEDE6", accent: "#E2513A",
    mechanic: { kind: "stamps", total: 6, filled: 3, label: "3 / 6 pizzas" },
    reward: "La 6ᵉ pizza offerte.",
  },
];
