import { describe, expect, it } from "vitest";
import { buildLoyaltyUpdate } from "../studioRules";

describe("buildLoyaltyUpdate — règles du Studio → update merchants", () => {
  it("stamp_card complet : type + config + reward_label", () => {
    const r = buildLoyaltyUpdate({
      type: "stamp_card",
      goal: 10,
      reward_label: "Un café offert",
      welcome_stamps: 1,
      intermediate_milestone: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update.loyalty_type).toBe("stamp_card");
      expect(r.update.loyalty_config).toEqual({ goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
      expect(r.update.reward_label).toBe("Un café offert");
    }
  });

  it("stamp_card minimal : welcome/intermédiaire omis, reward_label vide → null", () => {
    const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 8, reward_label: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update.loyalty_config).toEqual({ goal: 8 });
      expect(r.update.reward_label).toBe(null);
    }
  });

  it("réutilise validateLoyaltyProgram : objectif hors bornes → erreur", () => {
    const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 99 });
    expect(r).toEqual({ ok: false, error: "Objectif carte invalide (1 à 50)." });
  });

  it("récompense intermédiaire invalide (≥ objectif) → erreur héritée de validate", () => {
    const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 10, intermediate_milestone: 10 });
    expect(r.ok).toBe(false);
  });

  it("reward_label > 80 caractères → erreur dédiée", () => {
    const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 10, reward_label: "x".repeat(81) });
    expect(r).toEqual({ ok: false, error: "Libellé de récompense : 1 à 80 caractères." });
  });

  it("visit_based : config milestones passée à validate", () => {
    const r = buildLoyaltyUpdate({ type: "visit_based", config: { milestones: [5, 10, 20] } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.update.loyalty_type).toBe("visit_based");
      expect(r.update.loyalty_config).toEqual({ milestones: [5, 10, 20] });
    }
  });

  it("type inconnu → erreur", () => {
    expect(buildLoyaltyUpdate({ type: "bidon", goal: 10 }).ok).toBe(false);
  });

  // Important 2 (revue finale cartes-à-points) : reward_label absent du body
  // (p. ex. prefetch /api/merchant/me pas encore résolu au moment du Publier)
  // ne doit JAMAIS écraser silencieusement la récompense existante en base.
  // La route s'appuie sur l'ABSENCE de la clé dans `update` pour omettre la
  // colonne reward_label de l'UPDATE merchants (préservation).
  describe("reward_label — absence vs effacement volontaire (Important 2)", () => {
    it("clé absente → omise de l'update (préservation côté route)", () => {
      const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 10 });
      expect(r.ok).toBe(true);
      if (r.ok) expect("reward_label" in r.update).toBe(false);
    });

    it("chaîne vide explicite → null (effacement volontaire)", () => {
      const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 10, reward_label: "" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect("reward_label" in r.update).toBe(true);
        expect(r.update.reward_label).toBe(null);
      }
    });

    it("null explicite → null (effacement volontaire)", () => {
      const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 10, reward_label: null });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect("reward_label" in r.update).toBe(true);
        expect(r.update.reward_label).toBe(null);
      }
    });

    it("chaîne non vide → écrite telle quelle (trim)", () => {
      const r = buildLoyaltyUpdate({ type: "stamp_card", goal: 10, reward_label: "  Un café offert  " });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.update.reward_label).toBe("Un café offert");
    });
  });
});
