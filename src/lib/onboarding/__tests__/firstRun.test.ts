import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isFirstRunMerchant, type FirstRunMerchant } from "../firstRun";

// Horloge fixe pour des bornes 24 h déterministes (« créé < 24 h »).
const NOW = Date.parse("2026-06-23T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;

// Marchand de référence : ancien (>24 h) ET pleinement configuré → PAS premier
// passage. Chaque test ne renverse qu'un seul critère à la fois.
function configuredMerchant(over: Partial<FirstRunMerchant> = {}): FirstRunMerchant {
  return {
    created_at: new Date(NOW - 3 * DAY).toISOString(),
    loyalty_type: "stamp_card",
    reward_label: "Le 10e café offert",
    logo_url: "https://cdn.halocard.ch/logo.png",
    ...over,
  };
}

describe("isFirstRunMerchant", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renvoie false quand le marchand est ancien ET pleinement configuré", () => {
    expect(isFirstRunMerchant(configuredMerchant())).toBe(false);
  });

  describe("critère « créé il y a moins de 24 h »", () => {
    it("vrai juste en dessous de 24 h, même si tout est rempli", () => {
      const m = configuredMerchant({ created_at: new Date(NOW - (DAY - HOUR)).toISOString() });
      expect(isFirstRunMerchant(m)).toBe(true);
    });

    it("vrai pour une création à l'instant", () => {
      const m = configuredMerchant({ created_at: new Date(NOW).toISOString() });
      expect(isFirstRunMerchant(m)).toBe(true);
    });

    it("faux exactement à 24 h (borne stricte) quand tout est rempli", () => {
      const m = configuredMerchant({ created_at: new Date(NOW - DAY).toISOString() });
      expect(isFirstRunMerchant(m)).toBe(false);
    });

    it("traite une date future (décalage d'horloge) comme récente", () => {
      const m = configuredMerchant({ created_at: new Date(NOW + HOUR).toISOString() });
      expect(isFirstRunMerchant(m)).toBe(true);
    });

    it("une date illisible ne compte pas comme récente (les autres critères décident)", () => {
      const m = configuredMerchant({ created_at: "pas une date" });
      expect(isFirstRunMerchant(m)).toBe(false);
    });
  });

  describe("critère « loyalty_type absent »", () => {
    it("vrai quand null", () => {
      expect(isFirstRunMerchant(configuredMerchant({ loyalty_type: null }))).toBe(true);
    });
    it("vrai quand undefined (clé absente)", () => {
      expect(isFirstRunMerchant(configuredMerchant({ loyalty_type: undefined }))).toBe(true);
    });
    it("vrai quand chaîne vide ou espaces", () => {
      expect(isFirstRunMerchant(configuredMerchant({ loyalty_type: "" }))).toBe(true);
      expect(isFirstRunMerchant(configuredMerchant({ loyalty_type: "   " }))).toBe(true);
    });
  });

  describe("critère « reward_label vide »", () => {
    it("vrai quand null", () => {
      expect(isFirstRunMerchant(configuredMerchant({ reward_label: null }))).toBe(true);
    });
    it("vrai quand undefined (clé absente)", () => {
      expect(isFirstRunMerchant(configuredMerchant({ reward_label: undefined }))).toBe(true);
    });
    it("vrai quand chaîne vide ou espaces seuls", () => {
      expect(isFirstRunMerchant(configuredMerchant({ reward_label: "" }))).toBe(true);
      expect(isFirstRunMerchant(configuredMerchant({ reward_label: "   " }))).toBe(true);
    });
  });

  it("logo_url n'entre pas dans la décision (présent ou absent, sans effet)", () => {
    // Ancien + configuré : reste false quel que soit le logo.
    expect(isFirstRunMerchant(configuredMerchant({ logo_url: null }))).toBe(false);
    expect(isFirstRunMerchant(configuredMerchant({ logo_url: undefined }))).toBe(false);
  });

  it("cumule les critères : récent ET non configuré reste un premier passage", () => {
    const m: FirstRunMerchant = {
      created_at: new Date(NOW).toISOString(),
      loyalty_type: null,
      reward_label: "",
      logo_url: null,
    };
    expect(isFirstRunMerchant(m)).toBe(true);
  });
});
