import sharp from "sharp";
import { stampStripSvg, stampStripOverlaySvg, type StampStripOptions } from "./stampStrip";

// ─────────────────────────────────────────────────────────────────────────────
//  A.2 — Rasterisation du strip Apple (sharp). IO/compositing isolés ici pour
//  garder stampStrip.ts pur. Trois échelles Apple storeCard (≈ 3:1).
// ─────────────────────────────────────────────────────────────────────────────
export const STRIP_SIZES: [string, number, number][] = [
  ["strip.png", 375, 123],
  ["strip@2x.png", 750, 246],
  ["strip@3x.png", 1125, 369],
];

/** COMPOSITE : photo du commerce en fond (cover) + voile sombre + grille (overlay). */
export async function compositeStampStrip(
  photo: Buffer,
  width: number,
  height: number,
  opts: StampStripOptions,
): Promise<Buffer> {
  const overlay = Buffer.from(stampStripOverlaySvg({ ...opts, width, height }));
  return sharp(photo)
    .resize(width, height, { fit: "cover", position: "centre" })
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
}

/** GRILLE : aucune photo → grille sur fond couleur (comportement Priorité A). */
export async function rasterStampStrip(
  width: number,
  height: number,
  opts: StampStripOptions,
): Promise<Buffer> {
  const svg = stampStripSvg({ ...opts, width, height });
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}
