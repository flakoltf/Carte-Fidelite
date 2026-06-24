import { describe, expect, it } from "vitest";
import { buildArtSet, stripSvg, heroSvg, logoSvg, iconSvg, googleLogoSvg, type ArtSpec, type ArtPalette } from "../art";
import { DEMO_KIT, type DemoArtMotif } from "../kit";

const PALETTE: ArtPalette = { background: "#2A1A11", foreground: "#F7EFE4", label: "#C9A86A", accent: "#C9A86A" };
const TEXT = { dominant: "du Rhône", subtitle: "CAFÉ · GENÈVE", signature: "depuis 1894" };
const MOTIFS: DemoArtMotif[] = ["bean", "croissant", "pizza", "hairlock", "waves", "wheat"];
const spec = (motif: DemoArtMotif): ArtSpec => ({ motif, palette: PALETTE, text: TEXT });

function assertCleanSvg(s: string, w: number, h: number) {
  expect(s.startsWith("<svg")).toBe(true);
  expect(s).toContain(`width="${w}"`);
  expect(s).toContain(`height="${h}"`);
  expect(s).toContain(`viewBox="0 0 ${w} ${h}"`);
  expect(s).not.toMatch(/NaN|undefined|Infinity/);
  expect(s.endsWith("</svg>")).toBe(true);
}

describe("art SVG v2 — dimensions exactes par slot", () => {
  for (const m of MOTIFS) {
    it(`${m} : strip 1125×369, hero 1032×336, logo 480×150, icon 348, google 660`, () => {
      assertCleanSvg(stripSvg(spec(m)), 1125, 369);
      assertCleanSvg(heroSvg(spec(m)), 1032, 336);
      assertCleanSvg(logoSvg(spec(m)), 480, 150);
      assertCleanSvg(iconSvg(spec(m)), 348, 348);
      assertCleanSvg(googleLogoSvg(spec(m)), 660, 660);
    });
  }
});

describe("art SVG v2 — typographie dessinée + profondeur", () => {
  it("le strip porte le nom dessiné (dominant + sous-titre + signature)", () => {
    const s = stripSvg(spec("bean"));
    expect(s).toContain("du Rhône");
    expect(s).toContain("CAFÉ · GENÈVE");
    expect(s).toContain("depuis 1894");
    expect(s).toContain("font-style=\"italic\"");
  });

  it("le hero porte aussi le nom dessiné", () => {
    expect(heroSvg(spec("pizza"))).toContain("du Rhône");
  });

  it("profondeur + texture : halo radial, ombre portée, grain", () => {
    const s = stripSvg(spec("waves"));
    expect(s).toContain("radialGradient id=\"halo\"");
    expect(s).toContain("feDropShadow");
    expect(s).toContain("feTurbulence");
  });

  it("échappe le texte (pas d'injection d'angle)", () => {
    const s = stripSvg({ motif: "bean", palette: PALETTE, text: { dominant: "A<b>", subtitle: "X", signature: "Y" } });
    expect(s).toContain("A&lt;b&gt;");
    expect(s).not.toContain("<b>");
  });

  it("buildArtSet expose les 5 slots", () => {
    const set = buildArtSet(spec("croissant"));
    expect(Object.keys(set).sort()).toEqual(["google-logo", "hero", "icon", "logo", "strip"]);
    for (const v of Object.values(set)) expect(v.startsWith("<svg")).toBe(true);
  });

  it("les métaphores produisent des strips distincts", () => {
    const strips = MOTIFS.map((m) => stripSvg(spec(m)));
    expect(new Set(strips).size).toBe(MOTIFS.length);
  });

  it("déterministe : même entrée → même sortie", () => {
    expect(stripSvg(spec("wheat"))).toBe(stripSvg(spec("wheat")));
  });
});

describe("art SVG v2 — couvre les motifs + textes réels du kit", () => {
  it("chaque entrée du DEMO_KIT est rendable avec sa typographie", () => {
    for (const entry of DEMO_KIT) {
      const p: ArtPalette = { ...entry.design.colors, accent: entry.design.accent };
      const s = stripSvg({ motif: entry.motif, palette: p, text: entry.artText });
      expect(s).toContain(entry.artText.dominant);
      expect(s).not.toMatch(/NaN|undefined/);
    }
  });
});
