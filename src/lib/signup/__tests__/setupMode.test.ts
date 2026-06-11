import { describe, expect, it } from "vitest";
import {
  SETUP_MODES,
  normalizeSetupMode,
  validateModeInput,
  conciergeDefaults,
  SECTOR_PRESETS,
} from "../onboarding";
import { BUSINESS_TYPES } from "@/lib/merchant-config/types";

describe("fork de parcours (setup_mode)", () => {
  it("expose exactement deux modes : self et concierge", () => {
    expect(SETUP_MODES).toEqual(["self", "concierge"]);
  });

  it("normalise défensivement toute valeur inconnue vers null (fork affiché)", () => {
    expect(normalizeSetupMode(null)).toBeNull();
    expect(normalizeSetupMode(undefined)).toBeNull();
    expect(normalizeSetupMode("")).toBeNull();
    expect(normalizeSetupMode("admin")).toBeNull();
    expect(normalizeSetupMode(42)).toBeNull();
    expect(normalizeSetupMode("self")).toBe("self");
    expect(normalizeSetupMode("concierge")).toBe("concierge");
  });

  it("validateModeInput accepte les deux modes et rejette le reste", () => {
    expect(validateModeInput({ mode: "self" })).toEqual({ ok: true, mode: "self" });
    expect(validateModeInput({ mode: "concierge" })).toEqual({ ok: true, mode: "concierge" });
    for (const bad of [{}, { mode: "" }, { mode: "SELF" }, { mode: 1 }, null, "concierge"]) {
      const res = validateModeInput(bad);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBeTruthy();
    }
  });
});

describe("défauts concierge (programme provisoire)", () => {
  it("reprend l'objectif tampons du preset secteur", () => {
    for (const type of BUSINESS_TYPES) {
      expect(conciergeDefaults(type).stampGoal).toBe(SECTOR_PRESETS[type].stampGoal);
    }
  });

  it("retombe sur le preset 'autre' pour un secteur inconnu", () => {
    expect(conciergeDefaults("pharmacie")).toEqual({ stampGoal: SECTOR_PRESETS.autre.stampGoal });
    expect(conciergeDefaults(null)).toEqual({ stampGoal: SECTOR_PRESETS.autre.stampGoal });
  });

  it("borne l'objectif dans la fenêtre wizard 2–30 quoi qu'il arrive", () => {
    // Tous les presets actuels sont déjà dans la fenêtre — la borne protège
    // contre un futur preset hors limites.
    for (const type of BUSINESS_TYPES) {
      const { stampGoal } = conciergeDefaults(type);
      expect(stampGoal).toBeGreaterThanOrEqual(2);
      expect(stampGoal).toBeLessThanOrEqual(30);
    }
  });
});
