import { describe, it, expect } from "vitest";
import {
  buildSectorSelection,
  isBusinessSector,
  serializeSectorDraft,
  parseSectorDraft,
} from "../sectorSelection";
import { BUSINESS_SECTORS, getTemplate } from "@/lib/loyalty/templates";
import { validateLoyaltyProgram } from "@/lib/loyalty/validate";

describe("isBusinessSector", () => {
  it("reconnaît les 8 secteurs", () => {
    for (const s of BUSINESS_SECTORS) expect(isBusinessSector(s)).toBe(true);
  });
  it("rejette tout le reste", () => {
    for (const v of ["", "boutique", "inconnu", 42, null, undefined, {}]) {
      expect(isBusinessSector(v)).toBe(false);
    }
  });
});

describe("buildSectorSelection — secteur valide", () => {
  for (const sector of BUSINESS_SECTORS) {
    it(`${sector} : patch + brouillon cohérents et programme valide`, () => {
      const res = buildSectorSelection(sector);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { template, patch, draft } = res.selection;

      // Patch merchant : mécanique reflétée, programme accepté par le moteur.
      expect(patch.loyalty_type).toBe(template.loyaltyType);
      expect(patch.business_type).toBe(template.businessType);
      const validated = validateLoyaltyProgram(patch.loyalty_type, patch.loyalty_config);
      expect(validated.ok, validated.ok ? "" : validated.error).toBe(true);

      // stamp_goal synchronisé UNIQUEMENT pour les cartes à tampons.
      if (template.loyaltyType === "stamp_card") {
        expect(patch.stamp_goal).toBe(template.config.goal);
      } else {
        expect(patch.stamp_goal).toBeUndefined();
      }

      // Brouillon cookie : récompense + palette + icône portées telles quelles.
      expect(draft.sector).toBe(sector);
      expect(draft.rewardLabel).toBe(template.defaultRewardLabel);
      expect(draft.programName).toBe(template.defaultProgramName);
      expect(draft.palette).toEqual(template.palette);
      expect(draft.stampIcon).toBe(template.suggestedStampIcon);
    });
  }
});

describe("buildSectorSelection — secteur inconnu", () => {
  it("renvoie une erreur typée, jamais d'exception", () => {
    for (const bad of ["boutique", "inconnu", "", 123, null, undefined]) {
      const res = buildSectorSelection(bad);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/inconnu/i);
    }
  });
});

describe("serializeSectorDraft / parseSectorDraft", () => {
  it("aller-retour fidèle pour chaque secteur", () => {
    for (const sector of BUSINESS_SECTORS) {
      const res = buildSectorSelection(sector);
      if (!res.ok) throw new Error("inattendu");
      const round = parseSectorDraft(serializeSectorDraft(res.selection.draft));
      expect(round).toEqual(res.selection.draft);
    }
  });

  it("conserve l'icône absente (retail, tiered) sans la fabriquer", () => {
    const retail = getTemplate("retail");
    expect(retail.suggestedStampIcon).toBeUndefined();
    const res = buildSectorSelection("retail");
    if (!res.ok) throw new Error("inattendu");
    const round = parseSectorDraft(serializeSectorDraft(res.selection.draft));
    expect(round?.stampIcon).toBeUndefined();
  });

  it("tolère les entrées invalides → null (jamais d'exception)", () => {
    expect(parseSectorDraft(undefined)).toBeNull();
    expect(parseSectorDraft(null)).toBeNull();
    expect(parseSectorDraft("")).toBeNull();
    expect(parseSectorDraft("pas du json")).toBeNull();
    expect(parseSectorDraft("123")).toBeNull();
    expect(parseSectorDraft(JSON.stringify({ sector: "inconnu" }))).toBeNull();
    expect(parseSectorDraft(JSON.stringify({ sector: "cafe" }))).toBeNull(); // palette manquante
  });
});
