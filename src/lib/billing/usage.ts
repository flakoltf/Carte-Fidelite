// Jauge « cartes actives / palier » du dashboard marchand.
//
// Logique pure (testée sans réseau). Le comptage « carte active 90 j » vient
// de la même définition que la vue billing_active_cards / CGV §1 : activité
// (installation, scan, mise à jour) dans les 90 derniers jours.
//
// Principe produit : on n'INTERROMPT jamais le service au plafond — rien ne
// casse au comptoir. Le dépassement déclenche le passage de palier le mois
// suivant (CGV §6.2) ; la jauge est un levier d'information et d'upgrade.

export const BILLING_PLANS = {
  essentiel: { label: "Essentiel", cap: 200, priceChf: 69 },
  croissance: { label: "Croissance", cap: 750, priceChf: 129 },
  premium: { label: "Premium", cap: 2000, priceChf: 199 },
  custom: { label: "Sur mesure", cap: null, priceChf: null },
} as const;

export type PlanKey = keyof typeof BILLING_PLANS;

const UPGRADE_TARGET: Partial<Record<PlanKey, PlanKey>> = {
  essentiel: "croissance",
  croissance: "premium",
};

// Seuil d'alerte : à 80 % du plafond, on prévient (assez tôt pour décider,
// assez tard pour ne pas crier au loup).
export const NEAR_THRESHOLD = 0.8;

export type UsageState = "ok" | "near" | "over" | "uncapped";

export interface UsageGaugeModel {
  plan: PlanKey;
  planLabel: string;
  cap: number | null;
  activeCards: number;
  /** 0..1, plafonné à 1 pour la barre ; null si palier sans plafond. */
  ratio: number | null;
  state: UsageState;
  headline: string;
  detail: string;
  /** Présent quand un upgrade est pertinent (state near/over). */
  upgrade?: { target: PlanKey; targetLabel: string; priceChf: number | null };
}

export function normalizePlan(plan: unknown): PlanKey {
  return typeof plan === "string" && plan in BILLING_PLANS ? (plan as PlanKey) : "essentiel";
}

export function computeUsage(activeCards: number, rawPlan: unknown): UsageGaugeModel {
  const plan = normalizePlan(rawPlan);
  const { label: planLabel, cap } = BILLING_PLANS[plan];
  const cards = Math.max(0, Math.floor(activeCards));

  if (cap === null) {
    return {
      plan,
      planLabel,
      cap,
      activeCards: cards,
      ratio: null,
      state: "uncapped",
      headline: `${cards} cartes actives`,
      detail: "Palier sur mesure — sans plafond. Le comptage contractuel est figé le 1er de chaque mois.",
    };
  }

  const rawRatio = cards / cap;
  const ratio = Math.min(1, rawRatio);
  const remaining = cap - cards;
  const target = UPGRADE_TARGET[plan];
  const upgrade = target
    ? { target, targetLabel: BILLING_PLANS[target].label, priceChf: BILLING_PLANS[target].priceChf }
    : undefined;

  if (rawRatio > 1) {
    return {
      plan,
      planLabel,
      cap,
      activeCards: cards,
      ratio,
      state: "over",
      headline: "Plafond dépassé — et c'est une bonne nouvelle",
      detail: upgrade
        ? `${cards} cartes actives pour ${cap} incluses dans ${planLabel}. Vos cartes continuent de fonctionner normalement ; conformément aux CGV, votre abonnement passera en ${upgrade.targetLabel} (${upgrade.priceChf} CHF/mois) le mois prochain.`
        : `${cards} cartes actives pour ${cap} incluses dans ${planLabel}. Vos cartes continuent de fonctionner normalement — contactez-nous pour un palier sur mesure.`,
      upgrade,
    };
  }

  if (rawRatio >= NEAR_THRESHOLD) {
    return {
      plan,
      planLabel,
      cap,
      activeCards: cards,
      ratio,
      state: "near",
      headline: "Votre fidélité décolle 🎉",
      detail: upgrade
        ? `Plus que ${remaining} ${remaining > 1 ? "cartes" : "carte"} avant le plafond du palier ${planLabel}. Pour ne jamais y penser, passez en ${upgrade.targetLabel} (${upgrade.priceChf} CHF/mois) — rien ne s'interrompt en attendant.`
        : `Plus que ${remaining} ${remaining > 1 ? "cartes" : "carte"} avant le plafond du palier ${planLabel}. Contactez-nous pour un palier sur mesure — rien ne s'interrompt en attendant.`,
      upgrade,
    };
  }

  return {
    plan,
    planLabel,
    cap,
    activeCards: cards,
    ratio,
    state: "ok",
    headline: `${cards} ${cards > 1 ? "cartes actives" : "carte active"}`,
    detail: `sur ${cap} incluses dans votre palier ${planLabel}. Une carte est « active » si elle a été installée, scannée ou mise à jour dans les 90 derniers jours.`,
  };
}
