// Rendu des assets visuels du KIT DÉMO (Phase 1).
//
// Source de vérité : src/lib/demo/kit.ts (palette + motif par marchand) et
// src/lib/demo/art.ts (SVG vectoriels purs). Ce script rasterise via sharp aux
// dimensions EXACTES Apple/Google et écrit, par marchand, dans
//   assets/demo-kit/<slug>/        → PNG prêts à uploader + planche-contact
//   assets/demo-kit/<slug>/src/    → SVG sources (versionnés)
//
// Aucune nouvelle dépendance : on charge les modules TS via vite (déjà installé,
// alias « @ » repris de vitest.config.ts) puis on rend avec sharp.
//
// Usage : node scripts/render-demo-assets.mjs

import { createServer } from "vite";
import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "demo-kit");

// Cibles de rasterisation par slot SVG : [nom de fichier PNG, largeur, hauteur].
const TARGETS = {
  strip: [
    ["apple-strip@1x.png", 375, 123],
    ["apple-strip@2x.png", 750, 246],
    ["apple-strip@3x.png", 1125, 369],
  ],
  logo: [
    ["apple-logo@1x.png", 160, 50],
    ["apple-logo@2x.png", 320, 100],
    ["apple-logo@3x.png", 480, 150],
  ],
  icon: [
    ["apple-icon@1x.png", 29, 29],
    ["apple-icon@2x.png", 58, 58],
    ["apple-icon@3x.png", 87, 87],
  ],
  hero: [["google-hero.png", 1032, 336]],
  "google-logo": [["google-logo.png", 660, 660]],
};

async function renderPng(svg, w, h) {
  // fit:"fill" → respecte EXACTEMENT les dimensions cibles (les ratios SVG↔cible
  // sont identiques par construction, donc aucune déformation visible).
  return sharp(Buffer.from(svg)).resize(w, h, { fit: "fill" }).png().toBuffer();
}

async function main() {
  const vite = await createServer({
    configFile: path.join(ROOT, "vitest.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  let pngCount = 0;
  let merchantCount = 0;
  try {
    const { DEMO_KIT } = await vite.ssrLoadModule("/src/lib/demo/kit.ts");
    const { buildArtSet } = await vite.ssrLoadModule("/src/lib/demo/art.ts");

    for (const entry of DEMO_KIT) {
      merchantCount++;
      const dir = path.join(OUT, entry.slug);
      const srcDir = path.join(dir, "src");
      await rm(dir, { recursive: true, force: true });
      await mkdir(srcDir, { recursive: true });

      const palette = { ...entry.design.colors, accent: entry.design.accent };
      const set = buildArtSet({ motif: entry.motif, palette, text: entry.artText });

      for (const [slot, svg] of Object.entries(set)) {
        // SVG source versionné.
        await writeFile(path.join(srcDir, `${slot}.svg`), svg, "utf-8");
        // PNG aux dimensions exactes.
        for (const [name, w, h] of TARGETS[slot]) {
          await writeFile(path.join(dir, name), await renderPng(svg, w, h));
          pngCount++;
        }
      }
      console.log(`✓ ${entry.shopName.padEnd(24)} (${entry.motif}) → ${entry.slug}/`);
    }
  } finally {
    await vite.close();
  }

  console.log(`\n${pngCount} PNG rendus dans assets/demo-kit/ pour ${merchantCount} marchands.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
