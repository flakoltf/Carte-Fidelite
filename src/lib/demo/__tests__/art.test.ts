import { describe, expect, it } from "vitest";
import { buildArtSet, stripSvg, heroSvg, logoSvg, iconSvg, googleLogoSvg, type ArtPalette } from "../art";
import { DEMO_KIT, type DemoArtMotif } from "../kit";

const PALETTE: ArtPalette = { background: "#2A1A11", foreground: "#F7EFE4", label: "#C9A86A", accent: "#C9A86A" };
const MOTIFS: DemoArtMotif[] = ["coffee", "croissant", "pizza", "scissors", "bloom"];

function assertCleanSvg(s: string, w: number, h: number) {
  expect(s.startsWith("<svg")).toBe(true);
  expect(s).toContain(`width="${w}"`);
  expect(s).toContain(`height="${h}"`);
  expect(s).toContain(`viewBox="0 0 ${w} ${h}"`);
  // Aucun artefact numérique (géométrie déterministe, jamais NaN/undefined).
  expect(s).not.toMatch(/NaN|undefined|Infinity/);
  expect(s.endsWith("</svg>")).toBe(true);
}

describe("art SVG — dimensions exactes par slot", () => {
  for (const m of MOTIFS) {
    it(`${m} : strip 1125×369, hero 1032×336, logo 480×150, icon 348, google 660`, () => {
      assertCleanSvg(stripSvg(m, PALETTE), 1125, 369);
      assertCleanSvg(heroSvg(m, PALETTE), 1032, 336);
      assertCleanSvg(logoSvg(m, PALETTE), 480, 150);
      assertCleanSvg(iconSvg(m, PALETTE), 348, 348);
      assertCleanSvg(googleLogoSvg(m, PALETTE), 660, 660);
    });
  }
});

describe("art SVG — direction artistique", () => {
  it("chaque slot porte l'accent doré et le trait de premier plan", () => {
    const s = stripSvg("coffee", PALETTE);
    expect(s).toContain(PALETTE.accent);
    expect(s).toContain(PALETTE.foreground);
  });

  it("buildArtSet expose les 5 slots", () => {
    const set = buildArtSet("pizza", PALETTE);
    expect(Object.keys(set).sort()).toEqual(["google-logo", "hero", "icon", "logo", "strip"]);
    for (const v of Object.values(set)) expect(v.startsWith("<svg")).toBe(true);
  });

  it("les motifs produisent des dessins distincts", () => {
    const strips = MOTIFS.map((m) => stripSvg(m, PALETTE));
    expect(new Set(strips).size).toBe(MOTIFS.length);
  });

  it("déterministe : même entrée → même sortie", () => {
    expect(stripSvg("bloom", PALETTE)).toBe(stripSvg("bloom", PALETTE));
  });
});

describe("art SVG — couvre tous les motifs réellement utilisés par le kit", () => {
  it("chaque motif du DEMO_KIT est rendable", () => {
    for (const entry of DEMO_KIT) {
      const p: ArtPalette = { ...entry.design.colors, accent: entry.design.accent };
      const set = buildArtSet(entry.motif, p);
      expect(set.strip).toContain("<svg");
      expect(set.strip).not.toMatch(/NaN|undefined/);
    }
  });
});
