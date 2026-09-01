import { currentTier } from "@/lib/loyalty/engine";
import { canRedeem } from "@/lib/loyalty/stamp";
import {
  maxPointsThreshold,
  parseRedeemedTiers,
  pointsProgressionLabel,
  redeemablePointsTiers,
} from "@/lib/loyalty/points";
import type { LoyaltyProgram } from "@/lib/loyalty/types";

// Colonne « Fidélité » de la Base clients : résolution PURE de l'affichage et de
// l'action d'encaissement SELON la mécanique du programme — jamais un compteur
// de tampons en dur (bug d'origine : un programme points au seuil 200 affichait
// « 0/10 »). Mêmes conventions de valeur courante que le moteur (engine.ts) :
// stamps_count pour stamp/visit/tiered, points_balance pour amount_points/points.
export type CardLoyaltySnapshot = {
  stamps_count: number;
  points_balance?: number | null;
  redeemed_tiers?: unknown;
};

// Action d'encaissement proposable sur la ligne — alignée sur /api/redeem :
// stamp_reset (remise à zéro), points_deduct (déduction du seuil amount_points),
// tier_validate (validation d'UN palier précis du programme points).
export type RedeemAction =
  | { kind: "stamp_reset" }
  | { kind: "points_deduct" }
  | { kind: "tier_validate"; tierThreshold: number; reward: string };

export type LoyaltyCellView = {
  label: string;
  // Largeur de la barre de progression (0–100) ; null = pas de barre (tiered).
  percent: number | null;
  redeem: RedeemAction | null;
};

const pct = (value: number, target: number): number =>
  target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 100;

export function loyaltyCellView(program: LoyaltyProgram, card: CardLoyaltySnapshot): LoyaltyCellView {
  const stamps = card.stamps_count;
  const balance = card.points_balance ?? 0;

  switch (program.type) {
    case "stamp_card": {
      const { goal } = program.config;
      return {
        label: `${stamps}/${goal} tampons`,
        percent: pct(stamps, goal),
        redeem: canRedeem(stamps, goal) ? { kind: "stamp_reset" } : null,
      };
    }
    case "visit_based": {
      const next = [...program.config.milestones].sort((a, b) => a - b).find((m) => stamps < m);
      return {
        label: `${stamps} visite${stamps === 1 || stamps === 0 ? "" : "s"}`,
        percent: next === undefined ? 100 : pct(stamps, next),
        redeem: null,
      };
    }
    case "tiered": {
      const tier = currentTier(program.config.tiers, stamps);
      const next = [...program.config.tiers].sort((a, b) => a.at - b.at).find((t) => stamps < t.at);
      return {
        label: `${tier ? tier.name : "Aucun palier"} · ${stamps} visite${stamps === 1 || stamps === 0 ? "" : "s"}`,
        percent: next === undefined ? 100 : pct(stamps, next.at),
        redeem: null,
      };
    }
    case "amount_points": {
      const { rewardThreshold } = program.config;
      return {
        // Plafonné (« 200/200 », jamais « 230/200 ») — même règle que le pass.
        label: `${Math.min(balance, rewardThreshold)}/${rewardThreshold} points`,
        percent: pct(balance, rewardThreshold),
        redeem: balance >= rewardThreshold ? { kind: "points_deduct" } : null,
      };
    }
    case "points": {
      const redeemed = parseRedeemedTiers(card.redeemed_tiers);
      const nextThreshold =
        program.config.tiers.find((t) => !redeemed.includes(t.threshold))?.threshold ??
        maxPointsThreshold(program.config);
      const ready = redeemablePointsTiers(program.config, balance, redeemed);
      return {
        label: pointsProgressionLabel(program.config, balance, redeemed),
        percent: pct(Math.min(balance, nextThreshold), nextThreshold),
        redeem: ready.length > 0 ? { kind: "tier_validate", tierThreshold: ready[0].threshold, reward: ready[0].reward } : null,
      };
    }
  }
}

// Filtre « Carte pleine » : une carte n'est « prête » que selon SA mécanique.
export function isRewardReady(program: LoyaltyProgram, card: CardLoyaltySnapshot): boolean {
  return loyaltyCellView(program, card).redeem !== null;
}

export function redeemConfirmMessage(action: RedeemAction, customerName: string): string {
  switch (action.kind) {
    case "stamp_reset":
      return `Remettre la récompense de ${customerName} ? La carte repart à zéro.`;
    case "points_deduct":
      return `Remettre la récompense de ${customerName} ? Le seuil de points sera déduit de son solde.`;
    case "tier_validate":
      return `Valider le palier ${action.tierThreshold} points (${action.reward}) pour ${customerName} ?`;
  }
}

export function redeemButtonLabel(action: RedeemAction): string {
  return action.kind === "tier_validate" ? "Valider le palier" : "Récompense remise";
}
