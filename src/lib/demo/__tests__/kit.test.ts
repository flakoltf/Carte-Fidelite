import { describe, expect, it } from "vitest";
import { DEMO_KIT, DEMO_KIT_IDENTITIES } from "../kit";
import {
  DEMO_KIT_ALLOWLIST,
  assertDemoKitMerchant,
  findAllowlistEntry,
  isExampleEmail,
} from "../allowlist";
import { validateLoyaltyProgram } from "@/lib/loyalty/validate";
import { LOYALTY_TYPES } from "@/lib/loyalty/types";
import { contrastRatio } from "@/lib/cardDesign/color";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("DEMO_KIT — chaque entrée produit un programme valide", () => {
  for (const entry of DEMO_KIT) {
    it(`${entry.shopName} : (loyaltyType, config) accepté par validateLoyaltyProgram`, () => {
      const res = validateLoyaltyProgram(entry.loyaltyType, entry.loyaltyConfig);
      expect(res.ok, res.ok ? "" : res.error).toBe(true);
      if (res.ok) expect(res.program.type).toBe(entry.loyaltyType);
    });
  }

  it("couvre les 4 mécaniques du moteur", () => {
    const present = new Set(DEMO_KIT.map((e) => e.loyaltyType));
    for (const t of LOYALTY_TYPES) {
      expect(present.has(t), `mécanique manquante : ${t}`).toBe(true);
    }
  });
});

describe("DEMO_KIT — design premium cohérent", () => {
  for (const entry of DEMO_KIT) {
    it(`${entry.shopName} : couleurs hex valides + contraste WCAG`, () => {
      const { background, foreground, label } = entry.design.colors;
      expect(background).toMatch(HEX);
      expect(foreground).toMatch(HEX);
      expect(label).toMatch(HEX);
      expect(entry.design.accent).toMatch(HEX);

      // Texte principal : AA texte normal (≥ 4.5).
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      // Libellés (petits capitales / éléments d'UI) : AA grand texte (≥ 3).
      expect(contrastRatio(label, background)).toBeGreaterThanOrEqual(3);
    });

    it(`${entry.shopName} : cardType cohérent avec la mécanique`, () => {
      if (entry.loyaltyType === "stamp_card") {
        expect(entry.design.cardType).toBe("stamps");
        expect(entry.design.stamps).toBeDefined();
        // La grille du pass utilise stamps.goal → doit refléter l'objectif réel.
        expect(entry.design.stamps?.goal).toBe(entry.loyaltyConfig.goal);
      } else {
        expect(entry.design.cardType).toBe("points");
      }
    });

    it(`${entry.shopName} : code-barres QR sur le jeton de carte`, () => {
      expect(entry.design.barcode).toEqual({ type: "QR", source: "card_token" });
    });
  }

  it("au moins un marchand porte un Place ID Google (lien avis)", () => {
    expect(DEMO_KIT.some((e) => typeof e.googlePlaceId === "string" && e.googlePlaceId.length > 0)).toBe(true);
  });
});

describe("DEMO_KIT — allowlist @example.com (jamais un vrai marchand)", () => {
  it("chaque (slug, email) du kit appartient à l'allowlist", () => {
    for (const id of DEMO_KIT_IDENTITIES) {
      expect(findAllowlistEntry({ ...id, role: "merchant" }), `hors allowlist : ${id.slug}`).not.toBeNull();
    }
  });

  it("l'allowlist et le kit décrivent exactement les mêmes identités", () => {
    const kit = new Set(DEMO_KIT_IDENTITIES.map((i) => `${i.slug}|${i.email}`));
    const allow = new Set(DEMO_KIT_ALLOWLIST.map((i) => `${i.slug}|${i.email}`));
    expect(kit).toEqual(allow);
  });

  it("tous les emails sont @example.com", () => {
    for (const e of DEMO_KIT) expect(isExampleEmail(e.email)).toBe(true);
  });

  it("aucun slug ni email en double", () => {
    expect(new Set(DEMO_KIT.map((e) => e.slug)).size).toBe(DEMO_KIT.length);
    expect(new Set(DEMO_KIT.map((e) => e.email)).size).toBe(DEMO_KIT.length);
  });
});

describe("assertDemoKitMerchant — garde stricte multi-marchand", () => {
  it("accepte chaque identité réservée du kit (role marchand)", () => {
    for (const id of DEMO_KIT_IDENTITIES) {
      expect(() => assertDemoKitMerchant({ id: "m", ...id, role: "merchant" })).not.toThrow();
    }
  });

  it("refuse un appariement croisé slug/email (deux comptes démo distincts)", () => {
    // slug du Café du Rhône + email de la Pizzeria → couple inexistant.
    expect(() =>
      assertDemoKitMerchant({ id: "m", slug: "demo", email: "demo-pizzeria@example.com", role: "merchant" }),
    ).toThrow();
  });

  it("refuse un marchand hors allowlist", () => {
    expect(() =>
      assertDemoKitMerchant({ id: "m", slug: "vrai-commerce", email: "vrai@commerce.ch", role: "merchant" }),
    ).toThrow();
  });

  it("refuse un email hors @example.com même si le slug est réservé", () => {
    expect(() =>
      assertDemoKitMerchant({ id: "m", slug: "demo", email: "demo@halocard.ch", role: "merchant" }),
    ).toThrow();
  });

  it("refuse un rôle non-marchand (jamais purger un admin)", () => {
    expect(() =>
      assertDemoKitMerchant({ id: "m", slug: "demo", email: "demo@example.com", role: "admin" }),
    ).toThrow();
  });

  it("refuse null / undefined", () => {
    expect(() => assertDemoKitMerchant(null)).toThrow();
    expect(() => assertDemoKitMerchant(undefined)).toThrow();
  });
});
