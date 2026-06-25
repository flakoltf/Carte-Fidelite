// Rendu des assets visuels du KIT DÉMO (v4 « showcase »).
//
// Bannière (strip Apple / hero Google) :
//   • bannerPhoto défini → vraie PHOTO (public/...) recadrée « cover » ;
//   • sinon → HERO ILLUSTRÉ (scène SVG de src/lib/demo/art.ts).
// Dans les deux cas, on COMPOSE un SCRIM (voile sombre gauche→centre) par-dessus
// pour que le grand nombre blanc natif d'Apple reste lisible (archi v3 conservée).
// Logo (wordmark) / icône : rendus depuis les SVG.
//
// Sorties : assets/demo-kit/<slug>/*.png + <slug>/src/*.svg. 0 nouvelle dépendance
// (modules TS chargés via vite SSR). Usage : node scripts/render-demo-assets.mjs

import { createServer } from "vite";
import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "demo-kit");

// Cibles « image plate » par slot SVG (logo/icône) : [fichier, w, h].
const FLAT_TARGETS = {
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
  "google-logo": [["google-logo.png", 660, 660]],
};

const renderSvg = (svg, w, h) => sharp(Buffer.from(svg)).resize(w, h, { fit: "fill" }).png().toBuffer();

// Bannière de base (photo « cover » OU scène SVG) aux dims données.
async function bannerBase(entry, sceneSvg, w, h) {
  if (entry.bannerPhoto) {
    const photo = await readFile(path.join(ROOT, "public", entry.bannerPhoto));
    return sharp(photo).resize(w, h, { fit: "cover", position: "centre" }).png().toBuffer();
  }
  return renderSvg(sceneSvg, w, h);
}

// Compose le scrim (même dims) par-dessus une bannière déjà rasterisée.
async function withScrim(baseBuf, scrimSvg, w, h) {
  return sharp(baseBuf).composite([{ input: Buffer.from(scrimSvg) }]).png().toBuffer();
}

async function main() {
  const vite = await createServer({
    configFile: path.join(ROOT, "vitest.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  let pngCount = 0, merchantCount = 0;
  try {
    const { DEMO_KIT } = await vite.ssrLoadModule("/src/lib/demo/kit.ts");
    const { buildArtSet, scrimOverlaySvg } = await vite.ssrLoadModule("/src/lib/demo/art.ts");

    for (const entry of DEMO_KIT) {
      merchantCount++;
      const dir = path.join(OUT, entry.slug);
      const srcDir = path.join(dir, "src");
      await rm(dir, { recursive: true, force: true });
      await mkdir(srcDir, { recursive: true });

      const palette = { ...entry.design.colors, accent: entry.design.accent };
      const set = buildArtSet({ motif: entry.motif, palette, text: entry.artText });

      // ── Bannière STRIP (Apple) : base + scrim @3x, puis downscale @2x/@1x ──
      const stripBase = await bannerBase(entry, set.strip, 1125, 369);
      const strip3 = await withScrim(stripBase, scrimOverlaySvg(1125, 369), 1125, 369);
      await writeFile(path.join(dir, "apple-strip@3x.png"), strip3);
      await writeFile(path.join(dir, "apple-strip@2x.png"), await sharp(strip3).resize(750, 246).png().toBuffer());
      await writeFile(path.join(dir, "apple-strip@1x.png"), await sharp(strip3).resize(375, 123).png().toBuffer());
      pngCount += 3;

      // ── Bannière HERO (Google) : base + scrim ──
      const heroBase = await bannerBase(entry, set.hero, 1032, 336);
      const hero = await withScrim(heroBase, scrimOverlaySvg(1032, 336), 1032, 336);
      await writeFile(path.join(dir, "google-hero.png"), hero);
      pngCount += 1;

      // ── Slots plats (logo / icône / google-logo) ──
      for (const [slot, targets] of Object.entries(FLAT_TARGETS)) {
        await writeFile(path.join(srcDir, `${slot}.svg`), set[slot], "utf-8");
        for (const [name, w, h] of targets) {
          await writeFile(path.join(dir, name), await renderSvg(set[slot], w, h));
          pngCount++;
        }
      }
      // SVG sources des bannières (scène ; pour les photos, on note la source).
      await writeFile(path.join(srcDir, "strip.svg"), set.strip, "utf-8");
      await writeFile(path.join(srcDir, "hero.svg"), set.hero, "utf-8");

      console.log(`✓ ${entry.shopName.padEnd(24)} ${entry.bannerPhoto ? "[photo]" : "[hero illustré]"} → ${entry.slug}/`);
    }
  } finally {
    await vite.close();
  }
  console.log(`\n${pngCount} PNG rendus dans assets/demo-kit/ pour ${merchantCount} marchands.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
