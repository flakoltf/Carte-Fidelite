import type { LoyaltyProgram } from "./types";

export type ValidateResult = { ok: true; program: LoyaltyProgram } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const strictAsc = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]);

export function validateLoyaltyProgram(type: unknown, raw: unknown): ValidateResult {
  const cfg = (raw ?? {}) as Record<string, unknown>;

  if (type === "stamp_card") {
    const goal = cfg.goal;
    if (!isInt(goal) || goal < 1 || goal > 50) return { ok: false, error: "Objectif carte invalide (1 à 50)." };
    return { ok: true, program: { type: "stamp_card", config: { goal } } };
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

  return { ok: false, error: "Type de programme inconnu." };
}
