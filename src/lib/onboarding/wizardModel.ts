// Logique pure du rendu du wizard d'onboarding (extraite d'OnboardingClient).
// Testée sans réseau ni DOM. Aucune dépendance à `window`.

const MARKETING_BASE = "https://halocard.ch";

/**
 * URL publique d'inscription d'un commerce.
 * En dev/preview le domaine vitrine n'existe pas : on reste sur l'origine
 * courante (même convention que « Ma carte », cf. dashboard/card).
 */
export function enrollUrl(slug: string, loc: { hostname: string; origin: string }): string {
  if (!loc.hostname.endsWith("halocard.ch")) return `${loc.origin}/c/${slug}`;
  return `${MARKETING_BASE}/c/${slug}`;
}

/** Domaine vitrine affiché sous le wizard (« votre future page publique »). */
export const MARKETING_HOST = MARKETING_BASE.replace("https://", "");

/** Paliers de visites saisis en texte libre → liste de nombres. */
export function parseMilestones(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((s) => Number(s));
}

export type BillingCycleUi = "monthly" | "annual";

export interface PlanPriceDisplay {
  /** Montant affiché en gros (CHF/mois ou CHF/an selon le cycle). */
  total: number;
  /** "mois" | "an". */
  unit: string;
  /** Équivalent mensuel arrondi, présent uniquement en annuel. */
  perMonth: number | null;
}

/** Prix affiché pour un palier selon le cycle (annuel = 10 mois, 2 offerts). */
export function planPriceDisplay(priceChf: number, cycle: BillingCycleUi): PlanPriceDisplay {
  if (cycle === "annual") {
    const total = priceChf * 10;
    return { total, unit: "an", perMonth: Math.round(total / 12) };
  }
  return { total: priceChf, unit: "mois", perMonth: null };
}

export interface ProgramSummaryInput {
  isAmountPoints: boolean;
  programType: "stamp_card" | "visit_based";
  goal: number;
  milestonesText: string;
}

/** Ligne de récapitulatif du programme à l'étape « mise en ligne ». */
export function programSummaryLine(p: ProgramSummaryInput): string {
  if (p.isAmountPoints) return "Carte à points — 1 point par franc dépensé";
  if (p.programType === "stamp_card") return `Carte à tampons — récompense au ${p.goal}e passage`;
  return `Paliers de visites — ${p.milestonesText}`;
}
