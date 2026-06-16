import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { stampStripOverlaySvg, chooseStripPlan } from "../stampStrip";
import { compositeStampStrip, rasterStampStrip, STRIP_SIZES } from "../stampStripRaster";

const colors = { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" };

describe("stampStripOverlaySvg — overlay transparent pour composite photo", () => {
  it("pas de fond opaque plein (transparent), mais un voile dégradé", () => {
    const svg = stampStripOverlaySvg({ goal: 10, filledCount: 3, shape: "circle", colors, width: 1125, height: 369 });
    // pas de rect plein couleur sur toute la surface (ce serait opaque)
    expect(svg).not.toContain(`fill="#0D6B5E"`);
    // voile présent (dégradé sombre)
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain(`fill="url(#veil)"`);
  });

  it("une alvéole par tampon (= goal)", () => {
    const svg = stampStripOverlaySvg({ goal: 8, filledCount: 2, shape: "circle", colors, width: 1125, height: 369 });
    expect((svg.match(/<circle/g) ?? []).length).toBe(8);
  });

  it("les alvéoles sont dans la bande basse (sur le voile, WCAG)", () => {
    const height = 369;
    const svg = stampStripOverlaySvg({ goal: 5, filledCount: 0, shape: "circle", colors, width: 1125, height, bandFraction: 0.4 });
    const cys = [...svg.matchAll(/cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(cys.length).toBe(5);
    // bande basse = 40 % du bas → cy > 0.6 * hauteur
    expect(cys.every((cy) => cy > height * 0.6)).toBe(true);
  });

  it("déterministe : même entrée → même sortie", () => {
    const a = stampStripOverlaySvg({ goal: 6, filledCount: 4, shape: "rounded", colors, width: 750, height: 246 });
    const b = stampStripOverlaySvg({ goal: 6, filledCount: 4, shape: "rounded", colors, width: 750, height: 246 });
    expect(a).toBe(b);
  });
});

describe("chooseStripPlan — décision des 3 scénarios", () => {
  it("sans design publié → none", () => {
    expect(chooseStripPlan({ hasDesign: false, isStampsCard: false, hasPhoto: false })).toBe("none");
    expect(chooseStripPlan({ hasDesign: false, isStampsCard: true, hasPhoto: true })).toBe("none");
  });
  it("design tampons SANS photo → grid", () => {
    expect(chooseStripPlan({ hasDesign: true, isStampsCard: true, hasPhoto: false })).toBe("grid");
  });
  it("design tampons AVEC photo → composite", () => {
    expect(chooseStripPlan({ hasDesign: true, isStampsCard: true, hasPhoto: true })).toBe("composite");
  });
  it("design publié mais pas une carte tampons → none", () => {
    expect(chooseStripPlan({ hasDesign: true, isStampsCard: false, hasPhoto: true })).toBe("none");
  });
});

describe("rasterisation strip — PNG valides aux 3 échelles", () => {
  // Petite photo synthétique (sharp) pour le scénario « avec photo ».
  async function fakePhoto(): Promise<Buffer> {
    return sharp({ create: { width: 1200, height: 400, channels: 3, background: { r: 120, g: 90, b: 60 } } })
      .png()
      .toBuffer();
  }

  it("COMPOSITE (avec photo) : PNG aux dimensions exactes pour @1x/@2x/@3x", async () => {
    const photo = await fakePhoto();
    for (const [, w, h] of STRIP_SIZES) {
      const out = await compositeStampStrip(photo, w, h, { goal: 10, filledCount: 4, shape: "circle", colors });
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(w);
      expect(meta.height).toBe(h);
    }
  });

  it("GRILLE (sans photo) : PNG aux dimensions exactes pour @1x/@2x/@3x", async () => {
    for (const [, w, h] of STRIP_SIZES) {
      const out = await rasterStampStrip(w, h, { goal: 6, filledCount: 2, shape: "rounded", colors });
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(w);
      expect(meta.height).toBe(h);
    }
  });
});
