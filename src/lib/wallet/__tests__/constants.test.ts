import { describe, it, expect } from "vitest";
import {
  APPLE_FIELD_LIMITS,
  APPLE_STORECARD_SECONDARY_AUXILIARY_COMBINED_MAX,
  APPLE_IMAGE_POINTS,
  APPLE_IMAGE_SCALES,
  APPLE_BARCODE_FORMATS,
  APPLE_BARCODE_RENDERED_ON_WHITE,
  GOOGLE_TEXT_MODULES_MAX_PER_LEVEL,
  GOOGLE_IMAGE_SPEC,
  OFFICIAL_SOURCES,
} from "../constants";

// Ces tests GÈLENT les constantes officielles : toute modification doit être
// accompagnée d'une re-vérification de la source citée en commentaire.

describe("constantes Apple", () => {
  it("limites de champs générales", () => {
    expect(APPLE_FIELD_LIMITS).toEqual({ header: 3, primary: 1, secondary: 4, auxiliary: 4 });
  });

  it("storeCard : secondary + auxiliary combinés ≤ 4 (règle plus stricte)", () => {
    expect(APPLE_STORECARD_SECONDARY_AUXILIARY_COMBINED_MAX).toBe(4);
  });

  it("dimensions d'images (points) conformes au guide Apple", () => {
    expect(APPLE_IMAGE_POINTS.icon).toEqual({ w: 29, h: 29 });
    expect(APPLE_IMAGE_POINTS.logo).toEqual({ w: 160, h: 50 });
    expect(APPLE_IMAGE_POINTS.strip).toEqual({ w: 375, h: 123 }); // storeCard
    expect(APPLE_IMAGE_POINTS.thumbnail).toEqual({ w: 90, h: 90 });
    expect(APPLE_IMAGE_SCALES).toEqual([1, 2, 3]);
  });

  it("formats de code-barres = valeurs PKBarcodeFormat", () => {
    expect(APPLE_BARCODE_FORMATS.QR).toBe("PKBarcodeFormatQR");
    expect(APPLE_BARCODE_FORMATS.PDF417).toBe("PKBarcodeFormatPDF417");
    expect(APPLE_BARCODE_FORMATS.AZTEC).toBe("PKBarcodeFormatAztec");
    expect(APPLE_BARCODE_FORMATS.CODE128).toBe("PKBarcodeFormatCode128");
  });

  it("le code-barres est rendu noir sur blanc (fait de rendu à reproduire)", () => {
    expect(APPLE_BARCODE_RENDERED_ON_WHITE).toBe(true);
  });
});

describe("constantes Google", () => {
  it("modules texte plafonnés à 10 par niveau", () => {
    expect(GOOGLE_TEXT_MODULES_MAX_PER_LEVEL).toBe(10);
  });

  it("programLogo carré 660+ px, hero ~5:4", () => {
    expect(GOOGLE_IMAGE_SPEC.programLogo.minW).toBe(660);
    expect(GOOGLE_IMAGE_SPEC.programLogo.ratio).toBe("1:1");
    expect(GOOGLE_IMAGE_SPEC.heroImage.recW).toBe(1032);
    expect(GOOGLE_IMAGE_SPEC.heroImage.recH).toBe(812);
  });
});

describe("sources officielles", () => {
  it("chaque source est une URL developer.apple.com ou developers.google.com", () => {
    for (const url of Object.values(OFFICIAL_SOURCES)) {
      expect(url).toMatch(/^https:\/\/(developer\.apple\.com|developers\.google\.com)\//);
    }
  });
});
