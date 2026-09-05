import type { AmountPointsConfig, CycleExpiration, LoyaltyProgram, PointsConfig, PointsTier, StampCardConfig, StatusTier } from "./types";

export type ValidateResult = { ok: true; program: LoyaltyProgram } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const strictAsc = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]);

// Échéance glissante partagée stamp_card / amount_points : même forme que points
// ({ type, months }) mais fixed_date REFUSÉ (réservé aux cartes à points —
// décision produit 2026-09-05). "none"/absent → { ok, value: undefined } : la
// clé est omise de la config nettoyée.
type CycleExpirationResult = { ok: true; value?: CycleExpiration } | { ok: false; error: string };
function parseCycleExpiration(exp: unknown): CycleExpirationResult {
  if (exp === undefined || exp === null) return { ok: true };
  const e = exp as Record<string, unknown>;
  if (e.type === "none") return { ok: true };
  if (e.type === "rolling") {
    if (!isInt(e.months) || e.months < 1 || e.months > 60) return { ok: false, error: "Expiration glissante : 1 à 60 mois." };
    return { ok: true, value: { type: "rolling", months: e.months } };
  }
  if (e.type === "fixed_date") return { ok: false, error: "Expiration à date fixe : réservée aux cartes à points." };
  return { ok: false, error: "Type d'expiration inconnu." };
}

export function validateLoyaltyProgram(type: unknown, raw: unknown): ValidateResult {
  const cfg = (raw ?? {}) as Record<string, unknown>;

  if (type === "stamp_card") {
    const goal = cfg.goal;
    if (!isInt(goal) || goal < 1 || goal > 50) return { ok: false, error: "Objectif carte invalide (1 à 50)." };

    const config: StampCardConfig = { goal };

    // Tampon de bienvenue : 0 (défaut, omis) ou 1.
    const ws = cfg.welcome_stamps;
    if (ws !== undefined && ws !== 0 && ws !== 1) return { ok: false, error: "Tampon de bienvenue : 0 ou 1 uniquement." };
    if (ws === 1) config.welcome_stamps = 1;

    // Récompense intermédiaire : palier unique strictement entre 1 et l'objectif. null/absent = aucune.
    const im = cfg.intermediate_milestone;
    if (im !== undefined && im !== null) {
      if (!isInt(im) || im <= 1 || im >= goal) return { ok: false, error: "Récompense intermédiaire : un entier strictement supérieur à 1 et inférieur à l'objectif." };
      config.intermediate_milestone = im;
    }

    // Échéance glissante du cycle — la config nettoyée DOIT la porter (les
    // routes réécrivent loyalty_config depuis elle : clé perdue = effacée).
    const exp = parseCycleExpiration(cfg.expiration);
    if (!exp.ok) return exp;
    if (exp.value) config.expiration = exp.value;

    return { ok: true, program: { type: "stamp_card", config } };
  }

  if (type === "visit_based") {
    const ms = cfg.milestones;
    if (!Array.isArray(ms) || ms.length === 0 || ms.length > 10) return { ok: false, error: "Paliers : 1 à 10 valeurs." };
    if (!ms.every((m) => isInt(m) && m > 0)) return { ok: false, error: "Chaque palier doit être un entier > 0." };
    if (!strictAsc(ms as number[])) return { ok: false, error: "Paliers strictement croissants et distincts." };
    return { ok: true, program: { type: "visit_based", config: { milestones: ms as number[] } } };
  }

  if (type === "tiered") {
    const tiers = cfg.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0 || tiers.length > 6) return { ok: false, error: "Niveaux : 1 à 6." };
    const cleaned: { name: string; at: number }[] = [];
    for (const t of tiers) {
      const name = (t as Record<string, unknown>)?.name;
      const at = (t as Record<string, unknown>)?.at;
      if (typeof name !== "string" || name.trim().length < 1 || name.length > 40) return { ok: false, error: "Nom de niveau invalide (1 à 40 caractères)." };
      if (!isInt(at) || at < 1) return { ok: false, error: "Seuil de niveau invalide (entier > 0)." };
      cleaned.push({ name: name.trim(), at });
    }
    if (!strictAsc(cleaned.map((t) => t.at))) return { ok: false, error: "Seuils de niveaux strictement croissants et distincts." };
    return { ok: true, program: { type: "tiered", config: { tiers: cleaned } } };
  }

  if (type === "amount_points") {
    // pointsPerChf : nombre strictement positif (fraction autorisée, ex. 0,5 ou 2 points/CHF).
    const ppc = cfg.pointsPerChf;
    if (typeof ppc !== "number" || !Number.isFinite(ppc) || ppc <= 0) return { ok: false, error: "Points par franc : un nombre strictement positif." };

    // rewardThreshold : solde de points requis → entier ≥ 1.
    const threshold = cfg.rewardThreshold;
    if (!isInt(threshold) || threshold < 1) return { ok: false, error: "Seuil de récompense : un entier strictement positif." };

    // rewardLabel : libellé non vide (1 à 80 caractères, même borne que reward_label Studio).
    const label = cfg.rewardLabel;
    if (typeof label !== "string" || label.trim().length < 1 || label.trim().length > 80) return { ok: false, error: "Libellé de récompense : 1 à 80 caractères." };

    const config: AmountPointsConfig = {
      type: "amount_points",
      pointsPerChf: ppc,
      rewardThreshold: threshold,
      rewardLabel: label.trim(),
    };

    // maxPointsPerScan : plafond anti-fraude optionnel → entier ≥ 1 si fourni.
    const mpps = cfg.maxPointsPerScan;
    if (mpps !== undefined && mpps !== null) {
      if (!isInt(mpps) || mpps < 1) return { ok: false, error: "Plafond de points par scan : un entier supérieur ou égal à 1." };
      config.maxPointsPerScan = mpps;
    }

    // Échéance glissante du solde — même contrat de préservation que stamp_card.
    const exp = parseCycleExpiration(cfg.expiration);
    if (!exp.ok) return exp;
    if (exp.value) config.expiration = exp.value;

    return { ok: true, program: { type: "amount_points", config } };
  }

  if (type === "points") {
    const pps = cfg.pointsPerScan;
    if (!isInt(pps) || pps < 1 || pps > 1000) return { ok: false, error: "Points par scan : un entier de 1 à 1000." };

    const rawTiers = cfg.tiers;
    if (!Array.isArray(rawTiers) || rawTiers.length === 0 || rawTiers.length > 6) return { ok: false, error: "Paliers : 1 à 6." };
    const tiers: PointsTier[] = [];
    for (const t of rawTiers) {
      const threshold = (t as Record<string, unknown>)?.threshold;
      const reward = (t as Record<string, unknown>)?.reward;
      if (!isInt(threshold) || threshold < 1) return { ok: false, error: "Seuil de palier invalide (entier > 0)." };
      if (typeof reward !== "string" || reward.trim().length < 1 || reward.trim().length > 80)
        return { ok: false, error: "Offre de palier : 1 à 80 caractères." };
      tiers.push({ threshold, reward: reward.trim() });
    }
    if (!strictAsc(tiers.map((t) => t.threshold))) return { ok: false, error: "Seuils de paliers strictement croissants et distincts." };

    const config: PointsConfig = { pointsPerScan: pps, tiers };

    // Statuts clients (optionnels — absent/vide = désactivé). IMPORTANT : la
    // config nettoyée DOIT les porter — les routes (admin, publish studio)
    // réécrivent loyalty_config depuis CETTE config, une clé perdue ici serait
    // silencieusement effacée en base.
    const rawStatus = cfg.statusTiers;
    if (rawStatus !== undefined && rawStatus !== null) {
      if (!Array.isArray(rawStatus) || rawStatus.length > 5) return { ok: false, error: "Statuts clients : 5 maximum." };
      if (rawStatus.length > 0) {
        const statusTiers: StatusTier[] = [];
        for (const s of rawStatus) {
          const threshold = (s as Record<string, unknown>)?.threshold;
          const label = (s as Record<string, unknown>)?.label;
          const benefit = (s as Record<string, unknown>)?.benefit;
          if (!isInt(threshold) || threshold < 0) return { ok: false, error: "Seuil de statut invalide (entier ≥ 0)." };
          if (typeof label !== "string" || label.trim().length < 1 || label.trim().length > 40)
            return { ok: false, error: "Libellé de statut : 1 à 40 caractères." };
          if (benefit !== undefined && benefit !== null && (typeof benefit !== "string" || benefit.trim().length > 120))
            return { ok: false, error: "Avantage de statut : 120 caractères maximum." };
          const cleanBenefit = typeof benefit === "string" ? benefit.trim() : "";
          statusTiers.push({ threshold, label: label.trim(), ...(cleanBenefit ? { benefit: cleanBenefit } : {}) });
        }
        if (!strictAsc(statusTiers.map((s) => s.threshold)))
          return { ok: false, error: "Seuils de statuts strictement croissants et distincts." };
        config.statusTiers = statusTiers;
      }
    }

    const exp = cfg.expiration as Record<string, unknown> | undefined;
    if (exp !== undefined && exp !== null && (exp as { type?: unknown }).type !== "none") {
      if (exp.type === "rolling") {
        if (!isInt(exp.months) || (exp.months as number) < 1 || (exp.months as number) > 60)
          return { ok: false, error: "Expiration glissante : 1 à 60 mois." };
        config.expiration = { type: "rolling", months: exp.months as number };
      } else if (exp.type === "fixed_date") {
        const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // année non bissextile : 29/02 refusé
        const m = exp.month, d = exp.day;
        if (!isInt(m) || m < 1 || m > 12 || !isInt(d) || d < 1 || d > DAYS[(m as number) - 1])
          return { ok: false, error: "Expiration à date fixe : jour/mois invalides." };
        config.expiration = { type: "fixed_date", month: m as number, day: d as number };
      } else {
        return { ok: false, error: "Type d'expiration inconnu." };
      }
    }
    return { ok: true, program: { type: "points", config } };
  }

  return { ok: false, error: "Type de programme inconnu." };
}
