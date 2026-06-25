// MAQUETTE DE CARTE ASSEMBLÉE (auto-contrôle v4) + QR.
//
// Simule le rendu Apple Wallet RÉEL avec TOUS les champs natifs : en-tête
// (logo wordmark + logoText + header field) · strip (bannière) avec le grand
// nombre primary par-dessus · grille secondary + auxiliary complète · « N infos
// au dos » · QR + n° de membre. Permet de VÉRIFIER de visu : densité riche ET
// zéro chevauchement. Sortie : assets/demo-kit/preview/<slug>.png + <slug>/qr.png.
//
// Usage : node scripts/render-demo-contact-sheet.mjs

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
const SANS = "Helvetica, Arial, sans-serif";

async function qrPng(url) {
  const svg = renderToStaticMarkup(React.createElement(QRCode, { value: url, size: 512, bgColor: "#FFFFFF", fgColor: "#1A1A1A", level: "M" }));
  return sharp(Buffer.from(svg)).resize(512, 512, { fit: "fill" }).png().toBuffer();
}

// Contexte de jetons réaliste pour la maquette.
function tokenCtx(entry, goalForDisplay) {
  const goal = goalForDisplay(entry);
  const sample = Math.max(1, Math.round(goal * 0.65));
  const palier = entry.loyaltyType === "tiered" ? "Argent" : "";
  return { points: `${sample} / ${goal}`, palier, nom: "Sophie M." };
}
const resolve = (v, ctx) => String(v).replace(/\{(\w+)\}/g, (_m, k) => ctx[k] ?? `{${k}}`);

// Une colonne label + valeur.
function fieldCol(x, y, label, value, labelColor, valueColor, valueSize = 16) {
  return (
    `<text x="${x}" y="${y}" font-family="${SANS}" font-size="11" letter-spacing="1.2" fill="${labelColor}">${esc(label)}</text>` +
    `<text x="${x}" y="${y + 24}" font-family="${SANS}" font-size="${valueSize}" fill="${valueColor}">${esc(value)}</text>`
  );
}

function mockupSvg(entry, fields, ctx, stripB64, logoB64, qrB64) {
  const W = 840, pad = 44;
  const { background, foreground, label } = entry.design.colors;
  const get = (zone) => fields.filter((f) => f.zone === zone);
  const headerF = get("header")[0];
  const primary = get("primary")[0];
  // secondary natif = champs design (3) + RÉCOMPENSE (ajoutée par applyIdentity).
  const secondary = [...get("secondary").map((f) => ({ label: f.label, value: resolve(f.value, ctx) })), { label: "RÉCOMPENSE", value: entry.rewardLabel }];
  const auxiliary = get("auxiliary").map((f) => ({ label: f.label, value: resolve(f.value, ctx) }));
  const backCount = get("back").length + 4; // + horaires/adresse/itinéraire/téléphone (applyIdentity)

  // En-tête.
  const logoH = 56, logoW = logoH * 3.2, logoY = 30;
  let y = logoY;
  let s =
    `<image x="${pad}" y="${logoY}" width="${logoW.toFixed(0)}" height="${logoH}" href="data:image/png;base64,${logoB64}" preserveAspectRatio="xMinYMid meet"/>` +
    `<text x="${pad + logoW + 18}" y="${logoY + logoH / 2 + 7}" font-family="${SANS}" font-size="21" letter-spacing="1.2" fill="${label}">${esc(entry.design.programName)}</text>`;
  if (headerF) {
    s +=
      `<text x="${W - pad}" y="${logoY + 16}" font-family="${SANS}" font-size="11" letter-spacing="1.2" fill="${label}" text-anchor="end">${esc(headerF.label)}</text>` +
      `<text x="${W - pad}" y="${logoY + 42}" font-family="${SANS}" font-size="20" font-weight="600" fill="${foreground}" text-anchor="end">${esc(resolve(headerF.value, ctx))}</text>`;
  }

  // Strip + nombre primary par-dessus (zone gauche).
  const sx = pad, sy = logoY + logoH + 22, sw = W - pad * 2, sh = sw / 3.0488;
  s +=
    `<image x="${sx}" y="${sy.toFixed(0)}" width="${sw}" height="${sh.toFixed(0)}" href="data:image/png;base64,${stripB64}"/>` +
    `<text x="${sx + 30}" y="${(sy + sh * 0.32).toFixed(0)}" font-family="${SANS}" font-size="19" letter-spacing="1.5" fill="#FFFFFF">${esc(primary.label)}</text>` +
    `<text x="${sx + 28}" y="${(sy + sh * 0.82).toFixed(0)}" font-family="${SANS}" font-size="60" font-weight="600" fill="#FFFFFF">${esc(resolve(primary.value, ctx))}</text>`;

  // Grille secondary (4 colonnes).
  const colW = (W - pad * 2) / 4;
  y = sy + sh + 48;
  secondary.slice(0, 4).forEach((fl, i) => { s += fieldCol(pad + colW * i, y, fl.label, fl.value, label, foreground); });
  // Grille auxiliary (4 colonnes).
  y += 70;
  auxiliary.slice(0, 4).forEach((fl, i) => { s += fieldCol(pad + colW * i, y, fl.label, fl.value, label, foreground); });

  // « N infos au dos ».
  y += 64;
  s += `<text x="${pad}" y="${y}" font-family="${SANS}" font-size="14" fill="${label}">ⓘ  ${backCount} infos au dos · appuyez sur ⓘ</text>`;

  // QR + n° de membre.
  const memberId = (get("back").find((f) => f.id === "b_member")?.value) ?? "Démo · HALO";
  const qs = 210, qx = (W - qs) / 2, qy = y + 28;
  s +=
    `<rect x="${qx}" y="${qy}" width="${qs}" height="${qs}" rx="16" fill="#FFFFFF"/>` +
    `<image x="${qx + 14}" y="${qy + 14}" width="${qs - 28}" height="${qs - 28}" href="data:image/png;base64,${qrB64}"/>` +
    `<text x="${W / 2}" y="${qy + qs + 30}" font-family="${SANS}" font-size="15" letter-spacing="1.5" fill="${label}" text-anchor="middle">Membre · ${esc(memberId)}</text>` +
    `<text x="${W / 2}" y="${qy + qs + 56}" font-family="${SANS}" font-size="14" fill="${label}" text-anchor="middle" opacity="0.8">halocard.ch/c/${esc(entry.slug)}</text>`;

  const H = qy + qs + 84;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H.toFixed(0)}" viewBox="0 0 ${W} ${H.toFixed(0)}"><rect width="${W}" height="${H.toFixed(0)}" rx="40" fill="${background}"/>${s}</svg>`;
}

async function main() {
  await mkdir(PREVIEW, { recursive: true });
  const vite = await createServer({ configFile: path.join(ROOT, "vitest.config.ts"), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  try {
    const { DEMO_KIT } = await vite.ssrLoadModule("/src/lib/demo/kit.ts");
    const { kitDesignFields, goalForDisplay } = await vite.ssrLoadModule("/src/lib/demo/seedKit.ts");
    for (const entry of DEMO_KIT) {
      const url = `${BASE_URL}/c/${entry.slug}`;
      const qr = await qrPng(url);
      await writeFile(path.join(OUT, entry.slug, "qr.png"), qr);

      const fields = kitDesignFields(entry);
      const ctx = tokenCtx(entry, goalForDisplay);
      const strip = await readFile(path.join(OUT, entry.slug, "apple-strip@3x.png"));
      const logo = await readFile(path.join(OUT, entry.slug, "apple-logo@3x.png"));
      const svg = mockupSvg(entry, fields, ctx, strip.toString("base64"), logo.toString("base64"), qr.toString("base64"));
      await writeFile(path.join(PREVIEW, `${entry.slug}.png`), await sharp(Buffer.from(svg)).png().toBuffer());
      console.log(`✓ ${entry.shopName.padEnd(24)} → preview/${entry.slug}.png (maquette riche)`);
    }
  } finally {
    await vite.close();
  }
  console.log(`\nMaquettes assemblées riches + QR dans assets/demo-kit/preview/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
