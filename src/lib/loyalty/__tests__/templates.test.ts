import { describe, it, expect } from "vitest";
import {
  LOYALTY_TEMPLATES,
  BUSINESS_SECTORS,
  getTemplate,
  templateForBusinessType,
  toLoyaltyProgram,
  type BusinessSector,
} from "../templates";
import { validateLoyaltyProgram } from "../validate";
import { contrastRatio } from "@/lib/cardDesign/color";
import { STAMP_GOAL_MIN, STAMP_GOAL_MAX } from "@/lib/cardDesign/studioValidation";
import { BUSINESS_TYPES } from "@/lib/merchant-config/types";

describe("LOYALTY_TEMPLATES — catalogue", () => {
  it("couvre exactement les 8 secteurs, sans doublon", () => {
    expect(LOYALTY_TEMPLATES).toHaveLength(8);
    const sectors = LOYALTY_TEMPLATES.map((t) => t.sector);
    expect(new Set(sectors).size).toBe(sectors.length);
    expect([...sectors].sort()).toEqual([...BUSINESS_SECTORS].sort());
  });

  it("BUSINESS_SECTORS liste les 8 secteurs attendus", () => {
    expect([...BUSINESS_SECTORS].sort()).toEqual(
      [
        "barbier",
        "boulangerie",
        "cafe",
        "pressing",
        "restaurant",
        "retail",
        "salon",
        "sport",
      ].sort(),
    );
  });
});

describe("LOYALTY_TEMPLATES — chaque template produit un programme VALIDE", () => {
  // Garde-fou central : « cliquer un secteur » ne doit jamais créer un programme
  // que le moteur refuse. Couvre aussi le piège du type « amount_points » absent.
  for (const t of LOYALTY_TEMPLATES) {
    it(`${t.sector} : (loyaltyType, config) accepté par validateLoyaltyProgram`, () => {
      const res = validateLoyaltyProgram(t.loyaltyType, t.config);
      expect(res.ok, res.ok ? "" : res.error).toBe(true);
      if (res.ok) expect(res.program.type).toBe(t.loyaltyType);
    });
  }
});

describe("LOYALTY_TEMPLATES — design lisible et cohérent", () => {
  for (const t of LOYALTY_TEMPLATES) {
    it(`${t.sector} : palette lisible (contraste fond/libellé ≥ 2, fond/texte ≥ 3)`, () => {
      expect(contrastRatio(t.palette.background, t.palette.label)).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(t.palette.background, t.palette.foreground)).toBeGreaterThanOrEqual(3);
    });

    it(`${t.sector} : métadonnées d'affichage présentes`, () => {
      expect(t.displayName.trim().length).toBeGreaterThan(0);
      expect(t.emoji.trim().length).toBeGreaterThan(0);
      expect(t.defaultProgramName.trim().length).toBeGreaterThan(0);
      expect(t.defaultRewardLabel.trim().length).toBeGreaterThan(0);
      expect(BUSINESS_TYPES).toContain(t.businessType);
    });
  }
});

describe("LOYALTY_TEMPLATES — invariants par mécanique", () => {
  for (const t of LOYALTY_TEMPLATES) {
    if (t.loyaltyType === "stamp_card") {
      it(`${t.sector} : objectif tampons dans la plage du studio + icône suggérée`, () => {
        expect(t.config.goal).toBeGreaterThanOrEqual(STAMP_GOAL_MIN);
        expect(t.config.goal).toBeLessThanOrEqual(STAMP_GOAL_MAX);
        expect(t.cardType).toBe("stamps");
        expect(t.suggestedStampIcon && t.suggestedStampIcon.length).toBeTruthy();
      });
    }
    if (t.loyaltyType === "tiered") {
      it(`${t.sector} : carte à points (statut)`, () => {
        expect(t.cardType).toBe("points");
        expect(t.config.tiers.length).toBeGreaterThan(0);
      });
    }
    if (t.loyaltyType === "amount_points") {
      it(`${t.sector} : points par montant — carte à points, sans tampon`, () => {
        expect(t.cardType).toBe("points");
        expect(t.suggestedStampIcon).toBeUndefined();
        expect(t.config.pointsPerChf).toBeGreaterThan(0);
        expect(Number.isInteger(t.config.rewardThreshold)).toBe(true);
        expect(t.config.rewardThreshold).toBeGreaterThanOrEqual(1);
        expect(t.config.rewardLabel.trim().length).toBeGreaterThan(0);
      });
    }
  }
});

describe("helpers", () => {
  it("getTemplate retourne le template du secteur demandé", () => {
    for (const t of LOYALTY_TEMPLATES) {
      expect(getTemplate(t.sector)).toBe(t);
    }
  });

  it("toLoyaltyProgram fabrique un LoyaltyProgram réutilisable tel quel", () => {
    for (const t of LOYALTY_TEMPLATES) {
      const program = toLoyaltyProgram(t);
      expect(program.type).toBe(t.loyaltyType);
      const res = validateLoyaltyProgram(program.type, program.config);
      expect(res.ok).toBe(true);
    }
  });

  it("templateForBusinessType propose un template pour chaque métier connu", () => {
    for (const bt of BUSINESS_TYPES) {
      const t = templateForBusinessType(bt);
      expect(t, `aucun template pour le métier « ${bt} »`).toBeDefined();
      expect(t?.businessType).toBe(bt);
    }
  });

  it("templateForBusinessType renvoie undefined pour un métier inconnu", () => {
    expect(templateForBusinessType("inconnu" as never)).toBeUndefined();
  });

  it("getTemplate est typé strictement sur BusinessSector", () => {
    const sector: BusinessSector = "cafe";
    expect(getTemplate(sector).sector).toBe("cafe");
  });
});

describe("T3 — mapping métier → secteur attendu", () => {
  // Chaque BusinessType doit retomber sur le secteur prévu (table figée).
  const EXPECTED: Record<string, BusinessSector> = {
    cafe: "cafe",
    boulangerie: "boulangerie",
    restaurant: "restaurant",
    salon: "salon",
    sport: "sport",
    boutique: "retail",
    autre: "pressing",
  };
  for (const bt of BUSINESS_TYPES) {
    it(`templateForBusinessType("${bt}") → secteur "${EXPECTED[bt]}"`, () => {
      expect(templateForBusinessType(bt)?.sector).toBe(EXPECTED[bt]);
    });
  }
});

describe("T3 — paliers ordonnés", () => {
  const strictAsc = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);

  it("sport (visit_based) : paliers strictement croissants", () => {
    const sport = getTemplate("sport");
    expect(sport.loyaltyType).toBe("visit_based");
    if (sport.loyaltyType === "visit_based") {
      expect(strictAsc(sport.config.milestones)).toBe(true);
    }
  });

  it("tout template tiered/visit_based a des paliers strictement croissants", () => {
    for (const t of LOYALTY_TEMPLATES) {
      if (t.loyaltyType === "visit_based") expect(strictAsc(t.config.milestones)).toBe(true);
      if (t.loyaltyType === "tiered") expect(strictAsc(t.config.tiers.map((x) => x.at))).toBe(true);
    }
  });

  it("T4 — restaurant & retail sont en amount_points (1 pt/CHF, seuils 200/500)", () => {
    const restaurant = getTemplate("restaurant");
    expect(restaurant.loyaltyType).toBe("amount_points");
    if (restaurant.loyaltyType === "amount_points") {
      expect(restaurant.config.pointsPerChf).toBe(1);
      expect(restaurant.config.rewardThreshold).toBe(200);
      expect(restaurant.cardType).toBe("points");
    }
    const retail = getTemplate("retail");
    expect(retail.loyaltyType).toBe("amount_points");
    if (retail.loyaltyType === "amount_points") {
      expect(retail.config.pointsPerChf).toBe(1);
      expect(retail.config.rewardThreshold).toBe(500);
      expect(retail.cardType).toBe("points");
    }
  });
});

describe("T3 — palettes au format hex #RRGGBB", () => {
  const HEX = /^#[0-9a-fA-F]{6}$/;
  for (const t of LOYALTY_TEMPLATES) {
    it(`${t.sector} : background/foreground/label sont des #RRGGBB`, () => {
      expect(t.palette.background).toMatch(HEX);
      expect(t.palette.foreground).toMatch(HEX);
      expect(t.palette.label).toMatch(HEX);
    });
  }
});
