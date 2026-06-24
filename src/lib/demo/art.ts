// ART VECTORIEL DU KIT DÉMO — générateur SVG PUR, premium, sans texte.
//
// Direction artistique HALO : or chaud sur fond profond, lueur douce, liseré
// fin, motif métier dessiné au trait (jamais de clipart). 100 % vectoriel et
// SANS TEXTE → rasterisation sharp fiable sur tout runtime (la route seed peut
// rendre côté serveur sans dépendre d'une police). Déterministe → testable au
// caractère près. Le nom du commerce est porté par les champs du pass, pas par
// une image.
//
// Slots produits (un SVG par slot, rasterisé ensuite aux tailles Apple/Google) :
//   strip  1125×369  (bannière storeCard Apple, ratio ≈ 3.05:1)
//   hero   1032×336  (Google Wallet)
//   logo    480×150  (emblème large, fond transparent)
//   icon    348×348  (icône carrée, fond plein)
//   gicon   660×660  (logo carré Google, fond plein)

import type { DemoArtMotif } from "./kit";

export type ArtPalette = {
  background: string;
  foreground: string;
  label: string;
  accent: string;
};

// ── utilitaires ──────────────────────────────────────────────────────────────

const f = (n: number): string => {
  // Évite « -0 » et limite les décimales (SVG compact, déterministe).
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

// Éclaircit/assombrit un hex vers blanc/noir d'un facteur t∈[0,1].
function mix(hex: string, towards: "white" | "black", t: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const tgt = towards === "white" ? 255 : 0;
  const mc = (c: number) => Math.round(c + (tgt - c) * t);
  return `#${[mc(r), mc(g), mc(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// ── motifs métier (au trait, centrés en (cx,cy), rayon visuel ~s) ────────────

function motifCoffee(cx: number, cy: number, s: number, stroke: string, sw: number): string {
  const w = s * 1.15, h = s * 1.0;
  const x = cx - w / 2, top = cy - h / 2;
  const cup =
    `<path d="M ${f(x)} ${f(top)} h ${f(w)} v ${f(h * 0.62)} a ${f(w / 2)} ${f(h * 0.34)} 0 0 1 ${f(-w)} 0 Z" ` +
    `fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;
  const rim = `<ellipse cx="${f(cx)}" cy="${f(top)}" rx="${f(w / 2)}" ry="${f(h * 0.16)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}"/>`;
  const handle =
    `<path d="M ${f(x + w)} ${f(top + h * 0.18)} a ${f(s * 0.28)} ${f(s * 0.28)} 0 0 1 0 ${f(s * 0.5)}" ` +
    `fill="none" stroke="${stroke}" stroke-width="${f(sw)}"/>`;
  const steam = [-0.22, 0, 0.22]
    .map((o) => {
      const sx = cx + o * w;
      const sy = top - s * 0.16;
      return `<path d="M ${f(sx)} ${f(sy)} q ${f(s * 0.14)} ${f(-s * 0.18)} 0 ${f(-s * 0.36)} q ${f(-s * 0.14)} ${f(-s * 0.18)} 0 ${f(-s * 0.36)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.8)}" stroke-linecap="round" opacity="0.75"/>`;
    })
    .join("");
  return steam + rim + cup + handle;
}

function motifCroissant(cx: number, cy: number, s: number, stroke: string, sw: number): string {
  const r = s * 0.62;
  const body =
    `<path d="M ${f(cx - r)} ${f(cy + r * 0.5)} A ${f(r * 1.25)} ${f(r * 1.25)} 0 1 1 ${f(cx + r)} ${f(cy + r * 0.5)} ` +
    `A ${f(r * 0.62)} ${f(r * 0.62)} 0 1 0 ${f(cx - r)} ${f(cy + r * 0.5)} Z" ` +
    `fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;
  const segs = [-0.45, -0.15, 0.15, 0.45]
    .map((o) => {
      const px = cx + o * r * 1.6;
      const py = cy + r * 0.5 - Math.cos(o * 2) * r * 0.62;
      return `<line x1="${f(px)}" y1="${f(py - r * 0.18)}" x2="${f(px)}" y2="${f(py + r * 0.2)}" stroke="${stroke}" stroke-width="${f(sw * 0.7)}" stroke-linecap="round" opacity="0.7"/>`;
    })
    .join("");
  return body + segs;
}

function motifPizza(cx: number, cy: number, s: number, stroke: string, fill: string, sw: number): string {
  const h = s * 1.15;
  const apex = `${f(cx)} ${f(cy - h / 2)}`;
  const bl = `${f(cx - s * 0.62)} ${f(cy + h / 2)}`;
  const br = `${f(cx + s * 0.62)} ${f(cy + h / 2)}`;
  const slice =
    `<path d="M ${apex} L ${bl} A ${f(s * 1.3)} ${f(s * 1.3)} 0 0 0 ${br} Z" ` +
    `fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;
  const crust = `<path d="M ${bl} A ${f(s * 1.3)} ${f(s * 1.3)} 0 0 0 ${br}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 1.4)}" stroke-linecap="round"/>`;
  const pepp = [
    [cx, cy + h * 0.04, s * 0.13],
    [cx - s * 0.24, cy + h * 0.28, s * 0.1],
    [cx + s * 0.24, cy + h * 0.28, s * 0.1],
  ]
    .map(([px, py, pr]) => `<circle cx="${f(px)}" cy="${f(py)}" r="${f(pr)}" fill="${fill}" opacity="0.9"/>`)
    .join("");
  return slice + crust + pepp;
}

function motifScissors(cx: number, cy: number, s: number, stroke: string, sw: number): string {
  const blade = (sign: number) =>
    `<path d="M ${f(cx)} ${f(cy)} L ${f(cx + sign * s * 0.7)} ${f(cy - s * 0.62)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 1.3)}" stroke-linecap="round"/>` +
    `<ellipse cx="${f(cx + sign * s * 0.36)} " cy="${f(cy - s * 0.31)}" rx="${f(s * 0.34)}" ry="${f(s * 0.12)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.8)}" transform="rotate(${f(sign * -41)} ${f(cx + sign * s * 0.36)} ${f(cy - s * 0.31)})" opacity="0.55"/>`;
  const ring = (sign: number) =>
    `<circle cx="${f(cx + sign * s * 0.34)}" cy="${f(cy + s * 0.52)}" r="${f(s * 0.2)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}"/>` +
    `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + sign * s * 0.34)}" y2="${f(cy + s * 0.34)}" stroke="${stroke}" stroke-width="${f(sw * 1.1)}" stroke-linecap="round"/>`;
  const pivot = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(sw * 0.9)}" fill="${stroke}"/>`;
  return blade(-1) + blade(1) + ring(-1) + ring(1) + pivot;
}

function motifBloom(cx: number, cy: number, s: number, stroke: string, fill: string, sw: number): string {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 * Math.PI) / 180;
    const px = cx + Math.cos(a) * s * 0.42;
    const py = cy + Math.sin(a) * s * 0.42;
    return `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(s * 0.34)}" ry="${f(s * 0.16)}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" transform="rotate(${f(i * 60)} ${f(px)} ${f(py)})"/>`;
  }).join("");
  const center = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.2)}" fill="${fill}" opacity="0.9"/>`;
  const stem = `<path d="M ${f(cx)} ${f(cy + s * 0.6)} q ${f(s * 0.12)} ${f(s * 0.5)} 0 ${f(s * 0.95)}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.8)}" stroke-linecap="round" opacity="0.7"/>`;
  return stem + petals + center;
}

function motif(m: DemoArtMotif, cx: number, cy: number, s: number, stroke: string, fill: string, sw: number): string {
  switch (m) {
    case "coffee": return motifCoffee(cx, cy, s, stroke, sw);
    case "croissant": return motifCroissant(cx, cy, s, stroke, sw);
    case "pizza": return motifPizza(cx, cy, s, stroke, fill, sw);
    case "scissors": return motifScissors(cx, cy, s, stroke, sw);
    case "bloom": return motifBloom(cx, cy, s, stroke, fill, sw);
  }
}

// ── fonds / cadres partagés ──────────────────────────────────────────────────

// Dégradé de fond profond (diagonale) + lueur radiale douce côté motif.
function backdropDefs(p: ArtPalette, w: number, h: number, glowX: number): string {
  const deep = mix(p.background, "black", 0.28);
  const lift = mix(p.background, "white", 0.06);
  return (
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${lift}"/><stop offset="1" stop-color="${deep}"/>` +
    `</linearGradient>` +
    `<radialGradient id="glow" cx="${f(glowX / w)}" cy="0.42" r="0.55">` +
    `<stop offset="0" stop-color="${p.accent}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>`
  );
}

// Fines particules dorées (constellation discrète, déterministe).
function sparkle(p: ArtPalette, pts: [number, number, number][]): string {
  return pts
    .map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${p.accent}" opacity="0.5"/>`)
    .join("");
}

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// ── slots ────────────────────────────────────────────────────────────────────

// Bannière Apple storeCard (1125×369). Motif à droite, lueur dorée, liseré fin.
export function stripSvg(m: DemoArtMotif, p: ArtPalette, w = 1125, h = 369): string {
  const cx = w * 0.8, cy = h * 0.5, s = h * 0.46;
  const sw = Math.max(3, s * 0.07);
  const inset = h * 0.085;
  const body =
    backdropDefs(p, w, h, cx) +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#glow)"/>` +
    sparkle(p, [
      [w * 0.1, h * 0.28, 2.6], [w * 0.16, h * 0.7, 2], [w * 0.46, h * 0.22, 2.2],
      [w * 0.52, h * 0.78, 1.8], [w * 0.62, h * 0.4, 2], [w * 0.3, h * 0.5, 1.6],
    ]) +
    // liseré or intérieur (fin, élégant)
    `<rect x="${f(inset)}" y="${f(inset)}" width="${f(w - inset * 2)}" height="${f(h - inset * 2)}" rx="${f(h * 0.07)}" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.55"/>` +
    motif(m, cx, cy, s, p.foreground, p.accent, sw);
  return svg(w, h, body);
}

// Hero Google Wallet (1032×336) — même langage, motif recentré.
export function heroSvg(m: DemoArtMotif, p: ArtPalette, w = 1032, h = 336): string {
  const cx = w * 0.78, cy = h * 0.5, s = h * 0.48;
  const sw = Math.max(3, s * 0.07);
  const inset = h * 0.09;
  const body =
    backdropDefs(p, w, h, cx) +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#glow)"/>` +
    sparkle(p, [
      [w * 0.12, h * 0.3, 2.4], [w * 0.2, h * 0.72, 1.8], [w * 0.48, h * 0.24, 2],
      [w * 0.58, h * 0.74, 1.8], [w * 0.36, h * 0.52, 1.6],
    ]) +
    `<rect x="${f(inset)}" y="${f(inset)}" width="${f(w - inset * 2)}" height="${f(h - inset * 2)}" rx="${f(h * 0.07)}" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.5"/>` +
    motif(m, cx, cy, s, p.foreground, p.accent, sw);
  return svg(w, h, body);
}

// Emblème large (480×150), fond TRANSPARENT (se pose sur l'en-tête du pass).
export function logoSvg(m: DemoArtMotif, p: ArtPalette, w = 480, h = 150): string {
  const cx = h * 0.5, cy = h * 0.5, s = h * 0.42;
  const sw = Math.max(3, s * 0.08);
  const ring = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(h * 0.42)}" fill="none" stroke="${p.accent}" stroke-width="2.5" opacity="0.8"/>`;
  // Trois traits dorés à droite (rappel typographique sans texte).
  const rules = [0.36, 0.5, 0.64]
    .map((o, i) => `<rect x="${f(h * 0.95)}" y="${f(h * o - 3)}" width="${f((w - h) * (i === 1 ? 0.82 : 0.6))}" height="3" rx="1.5" fill="${p.accent}" opacity="${i === 1 ? 0.85 : 0.45}"/>`)
    .join("");
  return svg(w, h, ring + motif(m, cx, cy, s, p.foreground, p.accent, sw) + rules);
}

// Icône carrée (348×348), fond plein de marque + liseré + motif centré.
export function iconSvg(m: DemoArtMotif, p: ArtPalette, size = 348): string {
  const cx = size / 2, cy = size / 2, s = size * 0.34;
  const sw = Math.max(4, s * 0.08);
  const inset = size * 0.1;
  const body =
    backdropDefs(p, size, size, cx) +
    `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="url(#bg)"/>` +
    `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="url(#glow)"/>` +
    `<rect x="${f(inset)}" y="${f(inset)}" width="${f(size - inset * 2)}" height="${f(size - inset * 2)}" rx="${f(size * 0.16)}" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.6"/>` +
    motif(m, cx, cy, s, p.foreground, p.accent, sw);
  return svg(size, size, body);
}

// Logo carré Google (660×660) — même composition que l'icône, plus grand.
export function googleLogoSvg(m: DemoArtMotif, p: ArtPalette, size = 660): string {
  return iconSvg(m, p, size);
}

// Tous les slots SVG d'un marchand (sources versionnées + rendu).
export function buildArtSet(m: DemoArtMotif, p: ArtPalette): Record<string, string> {
  return {
    strip: stripSvg(m, p),
    hero: heroSvg(m, p),
    logo: logoSvg(m, p),
    icon: iconSvg(m, p),
    "google-logo": googleLogoSvg(m, p),
  };
}
