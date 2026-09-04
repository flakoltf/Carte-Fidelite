import { describe, expect, it } from "vitest";
import { buildLoyaltyUpdate } from "../studioRules";
import {
  PROGRAM_TYPES,
  cardTypeForProgram,
  defaultProgramRules,
  programRulesFromMerchant,
  programRulesToStudioInput,
  validateProgramRules,
} from "../studioProgramState";

// Contrat central du Studio « règles complètes » : ce que le moteur sait
// persister dans merchants.loyalty_config doit ressortir IDENTIQUE après un
// aller-retour chargement → état Studio → publish. Une clé perdue ici = un
// effacement silencieux en base (leçon statusTiers).
const FULL_CONFIGS: Record<string, Record<string, unknown>> = {
  stamp_card: { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 },
  visit_based: { milestones: [5, 20, 50] },
  tiered: { tiers: [{ name: "Bronze", at: 1 }, { name: "Argent", at: 10 }, { name: "Or", at: 30 }] },
  amount_points: { type: "amount_points", pointsPerChf: 1.5, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", maxPointsPerScan: 300 },
  points: {
    pointsPerScan: 5,
    tiers: [{ threshold: 30, reward: "Café offert" }, { threshold: 80, reward: "Menu offert" }],
    expiration: { type: "rolling", months: 12 },
    statusTiers: [{ threshold: 0, label: "Bronze" }, { threshold: 50, label: "Argent", benefit: "5% de réduction" }],
  },
};

function roundTrip(type: string, config: Record<string, unknown>) {
  const rules = programRulesFromMerchant(type, config);
  const goal = typeof config.goal === "number" ? config.goal : 10;
  const r = buildLoyaltyUpdate(programRulesToStudioInput(rules, goal));
  if (!r.ok) throw new Error(r.error);
  return r.update;
}

describe("studioProgramState — round-trip loyalty_config ↔ état Studio", () => {
  it("couvre les 5 mécaniques du moteur", () => {
    expect([...PROGRAM_TYPES].sort()).toEqual(["amount_points", "points", "stamp_card", "tiered", "visit_based"]);
  });

  for (const type of Object.keys(FULL_CONFIGS)) {
    it(`${type} : aucune clé perdue entre chargement et publication`, () => {
      const update = roundTrip(type, FULL_CONFIGS[type]);
      expect(update.loyalty_type).toBe(type);
      expect(update.loyalty_config).toEqual(FULL_CONFIGS[type]);
    });
  }

  it("stamp_card minimal : welcome/intermédiaire absents ne sont PAS inventés", () => {
    expect(roundTrip("stamp_card", { goal: 8 }).loyalty_config).toEqual({ goal: 8 });
  });

  it("amount_points sans plafond : maxPointsPerScan reste absent", () => {
    const cfg = { type: "amount_points", pointsPerChf: 1, rewardThreshold: 100, rewardLabel: "Dessert offert" };
    expect(roundTrip("amount_points", cfg).loyalty_config).toEqual(cfg);
  });

  it("points sans expiration ni statuts : expiration omise, statusTiers omis", () => {
    const cfg = { pointsPerScan: 10, tiers: [{ threshold: 100, reward: "10% de réduction" }] };
    expect(roundTrip("points", cfg).loyalty_config).toEqual(cfg);
  });
});

describe("studioProgramState — chargement tolérant", () => {
  it("type inconnu ou config nulle → défauts stamp_card", () => {
    expect(programRulesFromMerchant(null, null)).toEqual(defaultProgramRules("stamp_card"));
    expect(programRulesFromMerchant("cashback", { foo: 1 })).toEqual(defaultProgramRules("stamp_card"));
  });

  it("stamp_card : welcome_stamps=1 → tampon de bienvenue actif, intermédiaire absent → null", () => {
    expect(programRulesFromMerchant("stamp_card", { goal: 10, welcome_stamps: 1 })).toEqual({
      type: "stamp_card",
      welcomeStamp: true,
      intermediateMilestone: null,
    });
  });

  it("visit_based : paliers non entiers ignorés, config vide → défauts", () => {
    expect(programRulesFromMerchant("visit_based", { milestones: [5, "x", 20] })).toEqual({ type: "visit_based", milestones: [5, 20] });
    expect(programRulesFromMerchant("visit_based", {})).toEqual(defaultProgramRules("visit_based"));
  });

  it("tiered : niveaux mal formés ignorés", () => {
    expect(programRulesFromMerchant("tiered", { tiers: [{ name: "Or", at: 10 }, { name: 3 }] })).toEqual({
      type: "tiered",
      tiers: [{ name: "Or", at: 10 }],
    });
  });

  it("points : statusTiers sans benefit → benefit '' (état UI), expiration inconnue → none", () => {
    expect(
      programRulesFromMerchant("points", { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "x" }], expiration: { type: "weird" }, statusTiers: [{ threshold: 0, label: "Bronze" }] })
    ).toEqual({
      type: "points",
      pointsPerScan: 5,
      tiers: [{ threshold: 30, reward: "x" }],
      expiration: { type: "none" },
      statusTiers: [{ threshold: 0, label: "Bronze", benefit: "" }],
    });
  });
});

describe("studioProgramState — validation (réutilise validateLoyaltyProgram, jamais dupliquée)", () => {
  it("règles valides → aucune erreur", () => {
    expect(validateProgramRules(defaultProgramRules("tiered"), 10)).toEqual([]);
  });
  it("tiered : seuils non croissants → message du moteur", () => {
    const rules = { type: "tiered" as const, tiers: [{ name: "Argent", at: 10 }, { name: "Or", at: 5 }] };
    expect(validateProgramRules(rules, 10)).toEqual(["Seuils de niveaux strictement croissants et distincts."]);
  });
  it("stamp_card : récompense intermédiaire ≥ objectif → erreur", () => {
    const rules = { type: "stamp_card" as const, welcomeStamp: false, intermediateMilestone: 10 };
    expect(validateProgramRules(rules, 10)).toHaveLength(1);
  });
});

describe("studioProgramState — visuel dérivé de la mécanique (même mapping que les templates)", () => {
  it("tampons pour stamp_card/visit_based, points pour tiered/amount_points/points", () => {
    expect(cardTypeForProgram("stamp_card")).toBe("stamps");
    expect(cardTypeForProgram("visit_based")).toBe("stamps");
    expect(cardTypeForProgram("tiered")).toBe("points");
    expect(cardTypeForProgram("amount_points")).toBe("points");
    expect(cardTypeForProgram("points")).toBe("points");
  });
});
