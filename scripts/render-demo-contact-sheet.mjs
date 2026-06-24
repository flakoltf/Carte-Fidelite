// MAQUETTE DE CARTE ASSEMBLÉE + planche-contact (Phase 4 / auto-contrôle v3).
//
// Simule le rendu Apple Wallet RÉEL : logo wordmark + logoText en haut, gros
// nombre du champ PRIMARY superposé SUR le strip (zone gauche propre), libellé
// au-dessus, récompense (secondary) sous le strip, QR d'enrôlement. Permet de
// VÉRIFIER À L'ŒIL qu'aucun texte natif ne chevauche la métaphore du strip.
//
// Sorties : assets/demo-kit/preview/<slug>.png (maquette) + <slug>/qr.png
// Rendu LOCAL (polices système). Usage : node scripts/render-demo-contact-sheet.mjs

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

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function qrPng(url) {
  const svg = renderToStaticMarkup(
    React.createElement(QRCode, { value: url, size: 512, bgColor: "#FFFFFF", fgColor: "#1A1A1A", level: "M" }),
  );
  return sharp(Buffer.from(svg)).resize(512, 512, { fit: "fill" }).png().toBuffer();
}

// Valeur PRIMARY représentative (le gros nombre/statut) + libellé selon la mécanique.
function primaryField(entry) {
  switch (entry.loyaltyType) {
    case "stamp_card": {
      const g = entry.loyaltyConfig.goal;
      return { label: "TAMPONS", value: `${Math.max(1, Math.round(g * 0.7))} / ${g}` };
    }
    case "amount_points":
      return { label: "POINTS", value: String(Math.round(entry.loyaltyConfig.rewardThreshold * 0.6)) };
    case "visit_based":
      return { label: "VISITES", value: String(entry.loyaltyConfig.milestones[1] ?? entry.loyaltyConfig.milestones[0]) };
    case "tiered": {
      const tiers = entry.loyaltyConfig.tiers;
      return { label: "STATUT", value: tiers[Math.min(1, tiers.length - 1)].name };
    }
  }
}

// Maquette assemblée 750×860. Embarque strip + logo + QR (base64).
function mockupSvg(entry, stripB64, logoB64, qrB64) {
  const W = 750, H = 860, pad = 40;
  const { background, foreground, label } = entry.design.colors;
  const sans = "Helvetica, Arial, sans-serif";

  // En-tête : logo wordmark (gauche) + logoText (programName) à droite.
  const logoH = 58, logoW = logoH * 3.2, logoY = 30;
  const header =
    `<image x="${pad}" y="${logoY}" width="${logoW.toFixed(0)}" height="${logoH}" href="data:image/png;base64,${logoB64}" preserveAspectRatio="xMinYMid meet"/>` +
    `<text x="${pad + logoW + 20}" y="${logoY + logoH / 2 + 8}" font-family="${sans}" font-size="22" letter-spacing="1.5" fill="${label}">${esc(entry.design.programName)}</text>`;

  // Strip pleine largeur (ratio 3.0488) + champ PRIMARY superposé À GAUCHE.
  const sx = pad, sy = logoY + logoH + 26, sw = W - pad * 2, sh = sw / 3.0488;
  const prim = primaryField(entry);
  const strip =
    `<image x="${sx}" y="${sy.toFixed(0)}" width="${sw}" height="${sh.toFixed(0)}" href="data:image/png;base64,${stripB64}"/>` +
    `<text x="${sx + 30}" y="${(sy + sh * 0.34).toFixed(0)}" font-family="${sans}" font-size="20" letter-spacing="2" fill="${label}">${esc(prim.label)}</text>` +
    `<text x="${sx + 28}" y="${(sy + sh * 0.78).toFixed(0)}" font-family="${sans}" font-size="64" font-weight="600" fill="${foreground}">${esc(prim.value)}</text>`;

  // Sous le strip : récompense (secondary, ajoutée nativement via applyIdentity).
  const ry = sy + sh + 48;
  const reward =
    `<text x="${pad}" y="${ry.toFixed(0)}" font-family="${sans}" font-size="18" letter-spacing="2" fill="${label}">RÉCOMPENSE</text>` +
    `<text x="${pad}" y="${(ry + 34).toFixed(0)}" font-family="${sans}" font-size="28" fill="${foreground}">${esc(entry.rewardLabel)}</text>`;

  // QR d'enrôlement (bas).
  const qy = ry + 80, qs = 230, qx = (W - qs) / 2;
  const qr =
    `<rect x="${qx}" y="${qy.toFixed(0)}" width="${qs}" height="${qs}" rx="18" fill="#FFFFFF"/>` +
    `<image x="${qx + 16}" y="${(qy + 16).toFixed(0)}" width="${qs - 32}" height="${qs - 32}" href="data:image/png;base64,${qrB64}"/>` +
    `<text x="${W / 2}" y="${(qy + qs + 36).toFixed(0)}" font-family="${sans}" font-size="20" fill="${label}" text-anchor="middle">halocard.ch/c/${esc(entry.slug)}</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" rx="40" fill="${background}"/>` +
    header + strip + reward + qr +
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
      const qr = await qrPng(url);
      await writeFile(path.join(OUT, entry.slug, "qr.png"), qr);

      const strip = await readFile(path.join(OUT, entry.slug, "apple-strip@3x.png"));
      const logo = await readFile(path.join(OUT, entry.slug, "apple-logo@3x.png"));
      const svg = mockupSvg(entry, strip.toString("base64"), logo.toString("base64"), qr.toString("base64"));
      await writeFile(path.join(PREVIEW, `${entry.slug}.png`), await sharp(Buffer.from(svg)).png().toBuffer());
      console.log(`✓ ${entry.shopName.padEnd(24)} → preview/${entry.slug}.png (maquette assemblée)`);
    }
  } finally {
    await vite.close();
  }
  console.log(`\nMaquettes assemblées + QR dans assets/demo-kit/preview/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
