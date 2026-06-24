// PLANCHE-CONTACT DU KIT DÉMO (Phase 4) — livrable terrain hors-ligne.
//
// Pour chaque marchand démo : un QR vers /c/<slug> + une carte d'APERÇU façon
// Apple Wallet (en-tête + bannière + récompense + tampons + QR), pour que le
// fondateur montre le rendu même sans réseau. Sorties :
//   assets/demo-kit/<slug>/qr.png
//   assets/demo-kit/preview/<slug>.png
//
// Rendu LOCAL (texte serif via sharp/Georgia OK). QR via react-qr-code (SVG) →
// sharp. Aucune nouvelle dépendance. Usage : node scripts/render-demo-contact-sheet.mjs

import { createServer } from "vite";
import sharp from "sharp";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as QRMod from "react-qr-code";
import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "demo-kit");
const PREVIEW = path.join(OUT, "preview");
const BASE_URL = "https://halocard.ch";
const QRCode = QRMod.QRCode ?? QRMod.default ?? QRMod;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function qrPng(url, fg) {
  const svg = renderToStaticMarkup(
    React.createElement(QRCode, { value: url, size: 512, bgColor: "#FFFFFF", fgColor: fg, level: "M" }),
  );
  return sharp(Buffer.from(svg)).resize(512, 512, { fit: "fill" }).png().toBuffer();
}

// Carte d'aperçu (façon pass Apple) : 760×1010, embed bannière + QR en base64.
function previewSvg(entry, stripB64, qrB64) {
  const W = 760, H = 1010;
  const { background, foreground, label } = entry.design.colors;
  const accent = entry.design.accent;
  const pad = 48;

  // Rangée de tampons pour les cartes à tampons (4 pleins sur goal).
  let stamps = "";
  if (entry.loyaltyType === "stamp_card") {
    const goal = Math.min(entry.loyaltyConfig.goal, 10);
    const filled = Math.min(4, goal);
    const gap = (W - pad * 2) / goal;
    const r = Math.min(gap * 0.32, 20);
    const cy = 690;
    stamps = Array.from({ length: goal }, (_, i) => {
      const cx = pad + gap * i + gap / 2;
      return i < filled
        ? `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r.toFixed(1)}" fill="${foreground}"/>`
        : `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${label}" stroke-width="2.5" opacity="0.7"/>`;
    }).join("");
  } else {
    // Cartes à points/visites/niveaux : pastille de valeur.
    stamps = `<text x="${pad}" y="700" font-family="Georgia, serif" font-size="34" fill="${foreground}">${esc(entry.rewardLabel)}</text>`;
  }

  const mechLabel = {
    stamp_card: "Carte à tampons",
    visit_based: "Carte à visites",
    tiered: "Carte à niveaux",
    amount_points: "Carte à points",
  }[entry.loyaltyType];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" rx="40" fill="${background}"/>` +
    // En-tête
    `<text x="${pad}" y="92" font-family="Georgia, serif" font-size="46" fill="${foreground}">${esc(entry.shopName)}</text>` +
    `<text x="${pad}" y="132" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="2" fill="${label}">${esc(mechLabel.toUpperCase())}</text>` +
    // Bannière (strip) embarquée
    `<image x="${pad}" y="168" width="${W - pad * 2}" height="${(W - pad * 2) / 3.05}" href="data:image/png;base64,${stripB64}" preserveAspectRatio="xMidYMid slice"/>` +
    // Programme + récompense
    `<text x="${pad}" y="500" font-family="Georgia, serif" font-size="32" fill="${foreground}">${esc(entry.design.programName)}</text>` +
    `<text x="${pad}" y="556" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="2" fill="${label}">RÉCOMPENSE</text>` +
    `<text x="${pad}" y="600" font-family="Georgia, serif" font-size="30" fill="${accent}">${esc(entry.rewardLabel)}</text>` +
    stamps +
    // QR + URL
    `<rect x="${W / 2 - 130}" y="745" width="260" height="260" rx="20" fill="#FFFFFF"/>` +
    `<image x="${W / 2 - 114}" y="761" width="228" height="228" href="data:image/png;base64,${qrB64}"/>` +
    `</svg>`
  );
}

async function main() {
  await mkdir(PREVIEW, { recursive: true });
  const vite = await createServer({
    configFile: path.join(ROOT, "vitest.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  try {
    const { DEMO_KIT } = await vite.ssrLoadModule("/src/lib/demo/kit.ts");
    for (const entry of DEMO_KIT) {
      const url = `${BASE_URL}/c/${entry.slug}`;

      // QR (couleur d'accent du marchand sur fond blanc, contraste garanti).
      const qr = await qrPng(url, "#1A1A1A");
      await writeFile(path.join(OUT, entry.slug, "qr.png"), qr);

      // Carte d'aperçu (bannière déjà rendue en Phase 1).
      const strip = await readFile(path.join(OUT, entry.slug, "apple-strip@3x.png"));
      const svg = previewSvg(entry, strip.toString("base64"), qr.toString("base64"));
      await writeFile(path.join(PREVIEW, `${entry.slug}.png`), await sharp(Buffer.from(svg)).png().toBuffer());

      console.log(`✓ ${entry.shopName.padEnd(24)} → preview/${entry.slug}.png + qr.png`);
    }
  } finally {
    await vite.close();
  }
  console.log(`\nPlanche-contact + QR générés dans assets/demo-kit/preview/ et <slug>/qr.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
