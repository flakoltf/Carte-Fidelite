// ART VECTORIEL DU KIT DÉMO — v4 « showcase » (générateur SVG pur).
//
// La BANNIÈRE (strip Apple / hero Google) devient une vraie surface image :
//   • Café / Pizzeria : vraie photo (composée par le script de rendu) ;
//   • les 4 autres : HERO ILLUSTRÉ riche (petite scène : devanture de boulangerie
//     au lever du jour, fauteuil de salon + rais de lumière, galets + eau + vapeur
//     de spa, champ de blé à l'aube).
// SCRIM obligatoire (légibilité, archi v3 conservée) : voile sombre gauche→centre
// appliqué PAR-DESSUS toute bannière (photo OU illustration) pour que le grand
// nombre blanc natif d'Apple, posé à gauche, reste lisible. Le NOM reste dans le
// LOGO (wordmark), jamais sur la bannière.
//
// 100 % vectoriel + déterministe → testable. Wordmark rendu LOCALEMENT (polices).

import type { DemoArtMotif } from "./kit";

export type ArtPalette = { background: string; foreground: string; label: string; accent: string };
export type ArtText = { wordmark: string[] };
export type ArtSpec = { motif: DemoArtMotif; palette: ArtPalette; text: ArtText };

// ── utilitaires ──────────────────────────────────────────────────────────────

const f = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function mix(hex: string, towards: "white" | "black", t: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const tgt = towards === "white" ? 255 : 0;
  const mc = (c: number) => Math.round(c + (tgt - c) * t);
  return `#${[mc(r), mc(g), mc(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// Grain papier + ombre (réutilisés par toutes les scènes).
function commonDefs(): string {
  return (
    `<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.28"/></filter>` +
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="saturate" values="0"/></filter>`
  );
}
const grain = (w: number, h: number) => `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.04"/>`;

// Lueur radiale douce (soleil / halo).
function glow(id: string, cx: number, cy: number, r: number, color: string, op: number): string {
  return `<radialGradient id="${id}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"><stop offset="0" stop-color="${color}" stop-opacity="${f(op)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

// ── SCRIM de légibilité (voile sombre gauche→centre) ─────────────────────────

export function scrimOverlaySvg(w = 1125, h = 369): string {
  const body =
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#0A0B0D" stop-opacity="0.72"/>` +
    `<stop offset="0.42" stop-color="#0A0B0D" stop-opacity="0.34"/>` +
    `<stop offset="0.68" stop-color="#0A0B0D" stop-opacity="0.12"/>` +
    `<stop offset="1" stop-color="#0A0B0D" stop-opacity="0"/>` +
    `</linearGradient>` +
    // Léger renforcement bas (assoit la scène).
    `<linearGradient id="scrimY" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#0A0B0D" stop-opacity="0"/><stop offset="1" stop-color="#0A0B0D" stop-opacity="0.22"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#scrim)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#scrimY)"/>`;
  return svg(w, h, body);
}

// ── SCÈNES illustrées (bannière pleine) ──────────────────────────────────────

// Devanture de boulangerie au lever du jour.
function sceneBakery(p: ArtPalette, w: number, h: number): string {
  const sky0 = mix(p.background, "black", 0.35), sky1 = mix(p.accent, "black", 0.05);
  const wall = mix(p.background, "black", 0.55), warm = mix(p.accent, "white", 0.25);
  const gx = w * 0.78;
  const defs = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky0}"/><stop offset="1" stop-color="${sky1}"/></linearGradient>${glow("sun", gx / w, 0.28, 0.5, warm, 0.55)}${commonDefs()}</defs>`;
  const sky = `<rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" fill="url(#sun)"/>`;
  const sun = `<circle cx="${f(gx)}" cy="${f(h * 0.3)}" r="${f(h * 0.13)}" fill="${warm}" opacity="0.9"/>`;
  // Devanture (bas) : mur + auvent festonné + vitrine éclairée + pains.
  const base = h * 0.52;
  const wallR = `<rect x="${f(w * 0.5)}" y="${f(base)}" width="${f(w * 0.5)}" height="${f(h - base)}" fill="${wall}"/>`;
  const awn = Array.from({ length: 6 }, (_, i) => {
    const x = w * 0.5 + i * (w * 0.5 / 6);
    return `<path d="M ${f(x)} ${f(base)} q ${f(w * 0.5 / 12)} ${f(h * 0.07)} ${f(w * 0.5 / 6)} 0 Z" fill="${p.accent}" opacity="0.85"/>`;
  }).join("");
  const win = `<rect x="${f(w * 0.56)}" y="${f(base + h * 0.1)}" width="${f(w * 0.34)}" height="${f(h * 0.3)}" rx="4" fill="${warm}" opacity="0.35"/>`;
  const loaves = [0.62, 0.72, 0.82]
    .map((o) => `<ellipse cx="${f(w * o)}" cy="${f(base + h * 0.26)}" rx="${f(w * 0.035)}" ry="${f(h * 0.05)}" fill="${mix(p.accent, "black", 0.1)}" opacity="0.8" transform="rotate(-12 ${f(w * o)} ${f(base + h * 0.26)})"/>`)
    .join("");
  return defs + sky + sun + `<g filter="url(#sh)">${wallR}${awn}${win}${loaves}</g>` + grain(w, h);
}

// Champ de blé à l'aube.
function sceneWheat(p: ArtPalette, w: number, h: number): string {
  const sky0 = mix(p.background, "black", 0.3), sky1 = mix(p.accent, "black", 0.1);
  const warm = mix(p.accent, "white", 0.3), stalk = mix(p.accent, "white", 0.1);
  const gx = w * 0.8;
  const defs = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky0}"/><stop offset="0.7" stop-color="${sky1}"/></linearGradient>${glow("sun", gx / w, 0.32, 0.55, warm, 0.6)}${commonDefs()}</defs>`;
  const sky = `<rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" fill="url(#sun)"/>`;
  const sun = `<circle cx="${f(gx)}" cy="${f(h * 0.34)}" r="${f(h * 0.12)}" fill="${warm}" opacity="0.95"/>`;
  // Épis de blé (plusieurs hauteurs) sur la moitié droite.
  const ear = (mx: number, scale: number, op: number) => {
    const s = h * 0.3 * scale, base = h * 1.02;
    const stem = `<line x1="${f(mx)}" y1="${f(base)}" x2="${f(mx)}" y2="${f(base - s * 2.2)}" stroke="${stalk}" stroke-width="${f(Math.max(2, s * 0.12))}" stroke-linecap="round"/>`;
    const grains = Array.from({ length: 4 }, (_, i) => {
      const gy = base - s * 1.5 + i * s * 0.4;
      const g1 = (sign: number) => `<path d="M ${f(mx)} ${f(gy)} q ${f(sign * s * 0.32)} ${f(-s * 0.06)} ${f(sign * s * 0.36)} ${f(s * 0.24)} q ${f(-sign * s * 0.05)} ${f(s * 0.08)} ${f(-sign * s * 0.36)} ${f(s * 0.02)} Z" fill="${stalk}"/>`;
      return g1(-1) + g1(1);
    }).join("");
    return `<g opacity="${f(op)}">${stem}${grains}</g>`;
  };
  const ears = ear(w * 0.6, 0.8, 0.55) + ear(w * 0.72, 1.05, 0.8) + ear(w * 0.85, 0.92, 0.95) + ear(w * 0.95, 0.7, 0.5);
  return defs + sky + sun + `<g filter="url(#sh)">${ears}</g>` + grain(w, h);
}

// Fauteuil de salon + rais de lumière.
function sceneSalon(p: ArtPalette, w: number, h: number): string {
  const bg0 = mix(p.background, "white", 0.05), bg1 = mix(p.background, "black", 0.35);
  const light = mix(p.accent, "white", 0.35), chair = mix(p.background, "black", 0.5);
  const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg0}"/><stop offset="1" stop-color="${bg1}"/></linearGradient>${glow("spot", 0.82, 0.2, 0.55, light, 0.5)}${commonDefs()}</defs>`;
  const bg = `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;
  // Rais de lumière diagonaux depuis le haut-droite.
  const rays = [0, 1, 2, 3]
    .map((i) => `<polygon points="${f(w)},${f(-20)} ${f(w)},${f(h * 0.1 + i * 30)} ${f(w * 0.45 - i * 60)},${f(h + 20)} ${f(w * 0.4 - i * 60)},${f(h + 20)}" fill="${light}" opacity="${f(0.1 - i * 0.02)}"/>`)
    .join("");
  const spot = `<rect width="${w}" height="${h}" fill="url(#spot)"/>`;
  // Fauteuil (silhouette) centre-droit.
  const cx = w * 0.76, cy = h * 0.62;
  const chairG =
    `<g fill="${chair}">` +
    `<rect x="${f(cx - w * 0.08)}" y="${f(cy - h * 0.3)}" width="${f(w * 0.16)}" height="${f(h * 0.42)}" rx="${f(w * 0.04)}"/>` + // dossier
    `<rect x="${f(cx - w * 0.11)}" y="${f(cy)}" width="${f(w * 0.22)}" height="${f(h * 0.16)}" rx="${f(w * 0.03)}"/>` + // assise
    `<rect x="${f(cx - w * 0.12)}" y="${f(cy - h * 0.05)}" width="${f(w * 0.03)}" height="${f(h * 0.18)}" rx="3"/>` + // accoudoir g
    `<rect x="${f(cx + w * 0.09)}" y="${f(cy - h * 0.05)}" width="${f(w * 0.03)}" height="${f(h * 0.18)}" rx="3"/>` + // accoudoir d
    `<rect x="${f(cx - w * 0.015)}" y="${f(cy + h * 0.16)}" width="${f(w * 0.03)}" height="${f(h * 0.18)}"/>` + // pied
    `</g>`;
  const sparkle = `<g stroke="${p.accent}" stroke-width="2.5" stroke-linecap="round" opacity="0.8"><line x1="${f(w * 0.9)}" y1="${f(h * 0.22)}" x2="${f(w * 0.9)}" y2="${f(h * 0.34)}"/><line x1="${f(w * 0.86)}" y1="${f(h * 0.28)}" x2="${f(w * 0.94)}" y2="${f(h * 0.28)}"/></g>`;
  return defs + bg + rays + spot + `<g filter="url(#sh)">${chairG}</g>` + sparkle + grain(w, h);
}

// Galets empilés + eau + vapeur de spa.
function sceneSpa(p: ArtPalette, w: number, h: number): string {
  const bg0 = mix(p.background, "white", 0.06), bg1 = mix(p.background, "black", 0.3);
  const stone = mix(p.accent, "black", 0.05), stoneT = mix(p.accent, "white", 0.4);
  const water = mix(p.accent, "white", 0.2);
  const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg0}"/><stop offset="1" stop-color="${bg1}"/></linearGradient>${glow("amb", 0.8, 0.4, 0.5, mix(p.accent, "white", 0.3), 0.35)}${commonDefs()}</defs>`;
  const bg = `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#amb)"/>`;
  // Ondes d'eau (ellipses concentriques) sous les galets.
  const cx = w * 0.8, base = h * 0.78;
  const ripples = [0, 1, 2]
    .map((i) => `<ellipse cx="${f(cx)}" cy="${f(base + h * 0.08)}" rx="${f(h * (0.22 + i * 0.12))}" ry="${f(h * (0.05 + i * 0.025))}" fill="none" stroke="${water}" stroke-width="2" opacity="${f(0.5 - i * 0.14)}"/>`)
    .join("");
  // 3 galets empilés (du plus large au plus petit).
  const peb = (cy: number, rx: number, ry: number) =>
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${stone}"/>` +
    `<ellipse cx="${f(cx - rx * 0.28)}" cy="${f(cy - ry * 0.3)}" rx="${f(rx * 0.4)}" ry="${f(ry * 0.3)}" fill="${stoneT}" opacity="0.55"/>`;
  const stack = peb(base, h * 0.2, h * 0.085) + peb(base - h * 0.13, h * 0.15, h * 0.07) + peb(base - h * 0.24, h * 0.1, h * 0.055);
  // Vapeur (volutes) montant des galets.
  const steam = [-0.5, 0, 0.5]
    .map((o, i) => {
      const sx = cx + o * h * 0.18, sy = base - h * 0.34, r = h * 0.16;
      return `<path d="M ${f(sx)} ${f(sy)} q ${f(h * 0.06)} ${f(-r * 0.6)} 0 ${f(-r)} q ${f(-h * 0.06)} ${f(-r * 0.6)} 0 ${f(-r)}" fill="none" stroke="${stoneT}" stroke-width="2.5" stroke-linecap="round" opacity="${f(0.4 - i * 0.05)}"/>`;
    })
    .join("");
  const leaf = `<ellipse cx="${f(cx + h * 0.34)}" cy="${f(base - h * 0.02)}" rx="${f(h * 0.1)}" ry="${f(h * 0.04)}" fill="${p.accent}" opacity="0.6" transform="rotate(-28 ${f(cx + h * 0.34)} ${f(base - h * 0.02)})"/>`;
  return defs + bg + ripples + steam + `<g filter="url(#sh)">${stack}</g>${leaf}` + grain(w, h);
}

// Scène générique (café/pizzeria — fallback : photo utilisée en prod).
function sceneGeneric(p: ArtPalette, w: number, h: number): string {
  const bg0 = mix(p.background, "white", 0.05), bg1 = mix(p.background, "black", 0.32);
  const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg0}"/><stop offset="1" stop-color="${bg1}"/></linearGradient>${glow("amb", 0.8, 0.4, 0.5, p.accent, 0.3)}${commonDefs()}</defs>`;
  return defs + `<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#amb)"/>` + grain(w, h);
}

function scene(m: DemoArtMotif, p: ArtPalette, w: number, h: number): string {
  switch (m) {
    case "croissant": return sceneBakery(p, w, h);
    case "wheat": return sceneWheat(p, w, h);
    case "hairlock": return sceneSalon(p, w, h);
    case "waves": return sceneSpa(p, w, h);
    case "bean": case "pizza": return sceneGeneric(p, w, h);
  }
}

// ── slots ────────────────────────────────────────────────────────────────────

// Strip / hero = scène illustrée (le scrim est appliqué PAR-DESSUS au rendu).
export function stripSvg(spec: ArtSpec, w = 1125, h = 369): string {
  return svg(w, h, scene(spec.motif, spec.palette, w, h));
}
export function heroSvg(spec: ArtSpec, w = 1032, h = 336): string {
  return svg(w, h, scene(spec.motif, spec.palette, w, h));
}

// Logo = wordmark du nom (serif italique), fond transparent.
export function logoSvg(spec: ArtSpec, w = 480, h = 150): string {
  const { palette: p, text } = spec;
  const lines = text.wordmark.length ? text.wordmark : [""];
  const serif = "Georgia, 'Times New Roman', serif";
  const maxLen = Math.max(...lines.map((l) => l.length), 1);
  const fontSize = Math.min((h * 0.86) / lines.length, (w * 0.92) / (maxLen * 0.52));
  const lineH = fontSize * 1.04;
  const startY = (h - lineH * lines.length) / 2 + fontSize * 0.82;
  const x = w * 0.04;
  const texts = lines
    .map((l, i) => `<text x="${f(x)}" y="${f(startY + i * lineH)}" font-family="${serif}" font-style="italic" font-size="${f(fontSize)}" fill="${p.foreground}">${esc(l)}</text>`)
    .join("");
  return svg(w, h, texts);
}

// Icône carrée : fond de marque + petite scène recadrée (reste simple).
export function iconSvg(spec: ArtSpec, size = 348): string {
  const { motif, palette: p } = spec;
  const bg0 = mix(p.background, "white", 0.06), bg1 = mix(p.background, "black", 0.3);
  const inner = scene(motif, p, size * 1.6, size).replace(/^<svg[^>]*>|<\/svg>$/g, "");
  const body =
    `<defs><clipPath id="r"><rect width="${size}" height="${size}" rx="${f(size * 0.22)}"/></clipPath>` +
    `<linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg0}"/><stop offset="1" stop-color="${bg1}"/></linearGradient></defs>` +
    `<g clip-path="url(#r)"><rect width="${size}" height="${size}" fill="url(#ibg)"/>` +
    `<g transform="translate(${f(-size * 0.55)} 0)">${inner}</g></g>`;
  return svg(size, size, body);
}

export function googleLogoSvg(spec: ArtSpec, size = 660): string {
  return iconSvg(spec, size);
}

export function buildArtSet(spec: ArtSpec): Record<string, string> {
  return {
    strip: stripSvg(spec),
    hero: heroSvg(spec),
    logo: logoSvg(spec),
    icon: iconSvg(spec),
    "google-logo": googleLogoSvg(spec),
  };
}
