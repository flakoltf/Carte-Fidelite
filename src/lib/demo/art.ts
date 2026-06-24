// ART VECTORIEL DU KIT DÉMO — v3 « architecture pro » (générateur SVG pur).
//
// Règle d'or : un STRIP ne porte JAMAIS de texte. Apple superpose ses CHAMPS
// NATIFS par-dessus (logoText en haut, gros nombre du champ primary centré-gauche
// SUR le strip). Donc :
//   • le NOM va dans le LOGO (wordmark) — porté par `logoSvg` ;
//   • le STRIP est un FOND PUR : zone gauche/centre (≈65%) propre et calme (le
//     nombre blanc d'Apple doit y être lisible), métaphore éditoriale confinée
//     au tiers droit (≈35%), halo + grain + ombre pour la profondeur ;
//   • le TEXTE (valeur, libellés, récompense) = champs natifs (cf. seedKit/kit).
//
// 100 % vectoriel ; le wordmark dépend des polices système → rendu LOCALEMENT
// puis PNG versionnés uploadés tels quels. Déterministe → testable.

import type { DemoArtMotif } from "./kit";

export type ArtPalette = {
  background: string;
  foreground: string;
  label: string;
  accent: string;
};

// v3 : la seule donnée texte est le wordmark (nom du commerce), porté par le LOGO.
export type ArtText = { wordmark: string[] };

export type ArtSpec = { motif: DemoArtMotif; palette: ArtPalette; text: ArtText };

// Frontière de la zone propre : à gauche de CLEAN_X, aucun détail (le nombre natif).
const CLEAN = 0.65;

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

// ── fond pur + profondeur (halo droite, ombre métaphore, grain papier) ───────

function defs(p: ArtPalette, w: number, h: number, mx: number, my: number): string {
  // Gradient HORIZONTAL : gauche ≈ background (fond, blend avec la carte), droite
  // légèrement relevée sous la métaphore. La zone gauche reste propre et sombre.
  const left = mix(p.background, "black", 0.05);
  const right = mix(p.background, "white", 0.06);
  return (
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${left}"/>` +
    `<stop offset="${f(CLEAN)}" stop-color="${p.background}"/>` +
    `<stop offset="1" stop-color="${right}"/>` +
    `</linearGradient>` +
    `<radialGradient id="halo" cx="${f(mx / w)}" cy="${f(my / h)}" r="0.4">` +
    `<stop offset="0" stop-color="${p.accent}" stop-opacity="0.2"/>` +
    `<stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.25"/>` +
    `</filter>` +
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>` +
    `<feColorMatrix in="n" type="saturate" values="0"/></filter>` +
    `</defs>`
  );
}

function backdrop(p: ArtPalette, w: number, h: number, rounded = 0): string {
  const rx = rounded ? ` rx="${f(rounded)}"` : "";
  return (
    `<rect width="${w}" height="${h}"${rx} fill="url(#bg)"/>` +
    `<rect width="${w}" height="${h}"${rx} fill="url(#halo)"/>` +
    `<rect width="${w}" height="${h}"${rx} filter="url(#grain)" opacity="0.04"/>`
  );
}

// ── métaphores éditoriales — CONFINÉES au tiers droit (x > CLEAN·w) ───────────

function mBean(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.84, my = h * 0.5, s = h * 0.28;
  const sw = Math.max(3, s * 0.13), fg = p.foreground, ac = p.accent;
  const bean =
    `<g transform="rotate(-16 ${f(mx)} ${f(my)})">` +
    `<ellipse cx="${f(mx)}" cy="${f(my)}" rx="${f(s * 0.5)}" ry="${f(s * 0.78)}" fill="none" stroke="${fg}" stroke-width="${f(sw)}"/>` +
    `<path d="M ${f(mx)} ${f(my - s * 0.66)} C ${f(mx + s * 0.26)} ${f(my - s * 0.22)}, ${f(mx - s * 0.26)} ${f(my + s * 0.22)}, ${f(mx)} ${f(my + s * 0.66)}" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.82)}" stroke-linecap="round"/>` +
    `</g>`;
  const vapor = [-0.42, 0, 0.42]
    .map((o, i) => {
      const vx = mx + o * s * 0.5, vy = my - s * 0.95, r = s * 0.4;
      return `<path d="M ${f(vx)} ${f(vy)} q ${f(s * 0.15)} ${f(-r * 0.55)} 0 ${f(-r)} q ${f(-s * 0.15)} ${f(-r * 0.55)} 0 ${f(-r)}" fill="none" stroke="${ac}" stroke-width="${f(sw * 0.6)}" stroke-linecap="round" opacity="${f(0.55 - i * 0.08)}"/>`;
    })
    .join("");
  const small =
    `<ellipse cx="${f(mx - s * 0.95)}" cy="${f(my + s * 0.6)}" rx="${f(s * 0.16)}" ry="${f(s * 0.25)}" fill="${ac}" opacity="0.5" transform="rotate(22 ${f(mx - s * 0.95)} ${f(my + s * 0.6)})"/>` +
    `<ellipse cx="${f(mx + s * 0.7)}" cy="${f(my + s * 0.85)}" rx="${f(s * 0.12)}" ry="${f(s * 0.18)}" fill="${ac}" opacity="0.38" transform="rotate(-28 ${f(mx + s * 0.7)} ${f(my + s * 0.85)})"/>`;
  return `${vapor}<g filter="url(#sh)">${bean}</g>${small}`;
}

function mCroissant(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.84, my = h * 0.5, s = h * 0.3;
  const sw = Math.max(3, s * 0.1), fg = p.foreground, ac = p.accent;
  const body =
    `<path d="M ${f(mx - s * 0.82)} ${f(my + s * 0.45)} A ${f(s * 1.02)} ${f(s * 1.02)} 0 1 1 ${f(mx + s * 0.82)} ${f(my + s * 0.45)} A ${f(s * 0.48)} ${f(s * 0.48)} 0 1 0 ${f(mx - s * 0.82)} ${f(my + s * 0.45)} Z" ` +
    `fill="none" stroke="${fg}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;
  const layers = Array.from({ length: 5 }, (_, i) => {
    const a = Math.PI * (0.76 - i * 0.13), rr = s * 0.72;
    const cx = mx + Math.cos(a) * rr, cy = my - s * 0.05 - Math.sin(a) * rr * 0.5;
    return `<path d="M ${f(cx - s * 0.15)} ${f(cy)} q ${f(s * 0.15)} ${f(-s * 0.18)} ${f(s * 0.3)} 0" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.5)}" stroke-linecap="round" opacity="0.65"/>`;
  }).join("");
  const crumb = `<circle cx="${f(mx + s * 0.98)}" cy="${f(my + s * 0.72)}" r="${f(s * 0.11)}" fill="${ac}" opacity="0.55"/>`;
  return `<g filter="url(#sh)">${body}${layers}</g>${crumb}`;
}

function mPizza(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.83, my = h * 0.5, s = h * 0.3;
  const sw = Math.max(3, s * 0.09), fg = p.foreground, ac = p.accent;
  const disc = `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(s * 0.8)}" fill="none" stroke="${fg}" stroke-width="${f(sw)}"/>`;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 + 22.5) * (Math.PI / 180);
    return `<line x1="${f(mx)}" y1="${f(my)}" x2="${f(mx + Math.cos(a) * s * 0.8)}" y2="${f(my + Math.sin(a) * s * 0.8)}" stroke="${fg}" stroke-width="${f(sw * 0.5)}" opacity="0.55"/>`;
  }).join("");
  const dx = mx + s * 1.02, dy = my - s * 0.72;
  const slice = `<path d="M ${f(dx)} ${f(dy)} l ${f(s * 0.46)} ${f(s * 0.16)} a ${f(s * 0.5)} ${f(s * 0.5)} 0 0 1 ${f(-s * 0.3)} ${f(s * 0.4)} Z" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.8)}" stroke-linejoin="round"/>`;
  const basil = `<ellipse cx="${f(mx + s * 0.18)}" cy="${f(my - s * 0.14)}" rx="${f(s * 0.19)}" ry="${f(s * 0.09)}" fill="${ac}" opacity="0.65" transform="rotate(-35 ${f(mx + s * 0.18)} ${f(my - s * 0.14)})"/>`;
  return `<g filter="url(#sh)">${disc}${rays}${slice}</g>${basil}`;
}

function mHairlock(p: ArtPalette, w: number, h: number): string {
  const sw = Math.max(3, h * 0.03), fg = p.foreground, ac = p.accent;
  // Mèche en S confinée au tiers droit (bas → haut).
  const x0 = w * 0.7, y0 = h * 0.86, x1 = w * 0.93, y1 = h * 0.16;
  const s =
    `<path d="M ${f(x0)} ${f(y0)} C ${f(x0 + w * 0.12)} ${f(y0 - h * 0.12)}, ${f(w * 0.76)} ${f(h * 0.56)}, ${f(w * 0.82)} ${f(h * 0.5)} ` +
    `S ${f(x1 - w * 0.015)} ${f(y1 + h * 0.26)}, ${f(x1)} ${f(y1)}" fill="none" stroke="${fg}" stroke-width="${f(sw)}" stroke-linecap="round"/>`;
  const halo = `<circle cx="${f(x1)}" cy="${f(y1)}" r="${f(h * 0.14)}" fill="${ac}" opacity="0.18"/>`;
  const spark =
    `<g transform="translate(${f(x1)} ${f(y1)})" stroke="${ac}" stroke-width="${f(sw * 0.5)}" stroke-linecap="round">` +
    `<line x1="0" y1="${f(-h * 0.06)}" x2="0" y2="${f(h * 0.06)}"/><line x1="${f(-h * 0.06)}" y1="0" x2="${f(h * 0.06)}" y2="0"/>` +
    `<line x1="${f(-h * 0.035)}" y1="${f(-h * 0.035)}" x2="${f(h * 0.035)}" y2="${f(h * 0.035)}"/><line x1="${f(h * 0.035)}" y1="${f(-h * 0.035)}" x2="${f(-h * 0.035)}" y2="${f(h * 0.035)}"/></g>`;
  return `${halo}<g filter="url(#sh)">${s}</g>${spark}`;
}

function mWaves(p: ArtPalette, w: number, h: number): string {
  const fg = p.foreground, ac = p.accent, sw = Math.max(2.5, h * 0.018);
  const x0 = w * 0.66, x1 = w * 0.98, span = x1 - x0;
  // 3 vagues d'amplitude décroissante, confinées au tiers droit.
  const waves = [0, 1, 2]
    .map((i) => {
      const amp = h * (0.1 - i * 0.028), cy = h * (0.34 + i * 0.18);
      const seg = span / 2;
      let d = `M ${f(x0)} ${f(cy)}`;
      for (let k = 0; k < 2; k++) {
        const cxp = x0 + seg * k + seg / 2, x2 = x0 + seg * (k + 1);
        const dir = k % 2 === 0 ? -1 : 1;
        d += ` Q ${f(cxp)} ${f(cy + dir * amp)} ${f(x2)} ${f(cy)}`;
      }
      return `<path d="${d}" fill="none" stroke="${fg}" stroke-width="${f(sw)}" opacity="${f(0.8 - i * 0.16)}"/>`;
    })
    .join("");
  const sx = w * 0.84, sy = h * 0.5;
  const stone =
    `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx="${f(h * 0.16)}" ry="${f(h * 0.1)}" fill="${ac}" opacity="0.65" transform="rotate(-18 ${f(sx)} ${f(sy)})"/>` +
    `<ellipse cx="${f(sx - h * 0.045)}" cy="${f(sy - h * 0.025)}" rx="${f(h * 0.05)}" ry="${f(h * 0.025)}" fill="${mix(p.accent, "white", 0.5)}" opacity="0.6" transform="rotate(-18 ${f(sx)} ${f(sy)})"/>`;
  return `<g filter="url(#sh)">${waves}</g>${stone}`;
}

function mWheat(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.85, my = h * 0.5, s = h * 0.38;
  const sw = Math.max(2.5, s * 0.05), fg = p.foreground, ac = p.accent;
  const stem = `<line x1="${f(mx)}" y1="${f(my + s * 0.7)}" x2="${f(mx)}" y2="${f(my - s * 0.72)}" stroke="${fg}" stroke-width="${f(sw)}" stroke-linecap="round"/>`;
  const grains = Array.from({ length: 5 }, (_, i) => {
    const gy = my - s * 0.6 + i * s * 0.3;
    const grain = (sign: number) =>
      `<path d="M ${f(mx)} ${f(gy)} q ${f(sign * s * 0.25)} ${f(-s * 0.05)} ${f(sign * s * 0.28)} ${f(s * 0.2)} q ${f(-sign * s * 0.04)} ${f(s * 0.06)} ${f(-sign * s * 0.28)} ${f(s * 0.02)} Z" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.8)}" stroke-linejoin="round"/>`;
    return grain(-1) + grain(1);
  }).join("");
  const awns = [-1, 0, 1]
    .map((sign) => `<line x1="${f(mx)}" y1="${f(my - s * 0.7)}" x2="${f(mx + sign * s * 0.3)}" y2="${f(my - s * 1.02)}" stroke="${ac}" stroke-width="${f(sw * 0.5)}" stroke-linecap="round" opacity="0.65"/>`)
    .join("");
  const detached = `<path d="M ${f(mx - s * 0.78)} ${f(my + s * 0.5)} q ${f(s * 0.23)} ${f(-s * 0.05)} ${f(s * 0.26)} ${f(s * 0.18)} q ${f(-s * 0.04)} ${f(s * 0.06)} ${f(-s * 0.26)} ${f(s * 0.02)} Z" fill="${ac}" opacity="0.45" transform="rotate(-20 ${f(mx - s * 0.78)} ${f(my + s * 0.5)})"/>`;
  return `<g filter="url(#sh)">${awns}${stem}${grains}</g>${detached}`;
}

function metaphor(m: DemoArtMotif, p: ArtPalette, w: number, h: number): string {
  switch (m) {
    case "bean": return mBean(p, w, h);
    case "croissant": return mCroissant(p, w, h);
    case "pizza": return mPizza(p, w, h);
    case "hairlock": return mHairlock(p, w, h);
    case "waves": return mWaves(p, w, h);
    case "wheat": return mWheat(p, w, h);
  }
}

function haloCenter(m: DemoArtMotif, w: number, h: number): [number, number] {
  if (m === "hairlock") return [w * 0.86, h * 0.34];
  return [w * 0.84, h * 0.5];
}

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// ── STRIP / HERO : fond pur, AUCUN texte ─────────────────────────────────────

function pureBackground(spec: ArtSpec, w: number, h: number): string {
  const { motif, palette: p } = spec;
  const [mx, my] = haloCenter(motif, w, h);
  return defs(p, w, h, mx, my) + backdrop(p, w, h) + metaphor(motif, p, w, h);
}

export function stripSvg(spec: ArtSpec, w = 1125, h = 369): string {
  return svg(w, h, pureBackground(spec, w, h));
}

export function heroSvg(spec: ArtSpec, w = 1032, h = 336): string {
  return svg(w, h, pureBackground(spec, w, h));
}

// ── LOGO : wordmark du nom (serif italique), fond transparent ────────────────

export function logoSvg(spec: ArtSpec, w = 480, h = 150): string {
  const { palette: p, text } = spec;
  const lines = text.wordmark.length ? text.wordmark : [""];
  const serif = "Georgia, 'Times New Roman', serif";
  const maxLen = Math.max(...lines.map((l) => l.length), 1);
  // Taille adaptée pour tenir dans la boîte (hauteur / lignes ET largeur / texte).
  const byHeight = (h * 0.86) / lines.length;
  const byWidth = (w * 0.92) / (maxLen * 0.52);
  const fontSize = Math.min(byHeight, byWidth);
  const lineH = fontSize * 1.04;
  const blockH = lineH * lines.length;
  const startY = (h - blockH) / 2 + fontSize * 0.82;
  const x = w * 0.04;
  const texts = lines
    .map((l, i) => `<text x="${f(x)}" y="${f(startY + i * lineH)}" font-family="${serif}" font-style="italic" font-size="${f(fontSize)}" fill="${p.foreground}">${esc(l)}</text>`)
    .join("");
  return svg(w, h, texts);
}

// ── ICÔNE : métaphore centrée sur fond de marque (reste simple) ──────────────

export function iconSvg(spec: ArtSpec, size = 348): string {
  const { motif, palette: p } = spec;
  const body =
    defs(p, size, size, size / 2, size / 2) +
    `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="url(#bg)"/>` +
    `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="url(#halo)"/>` +
    `<rect width="${size}" height="${size}" rx="${f(size * 0.22)}" filter="url(#grain)" opacity="0.04"/>` +
    // Métaphore recentrée (le dessin bannière vit à droite → on le recadre).
    `<g transform="translate(${f(-size * 0.34)} 0)">${metaphor(motif, p, size, size)}</g>`;
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
