// ART VECTORIEL DU KIT DÉMO — v2 « éditorial » (générateur SVG pur).
//
// Direction artistique HALO, niveau « je veux ça » : typographie DESSINÉE dans
// le strip (nom du commerce en serif italique + sous-titre tracké + signature),
// métaphore éditoriale (pas une icône évidente) sur le tiers droit, asymétrie
// maîtrisée, profondeur (halo radial + ombre portée) et texture (grain
// feTurbulence). 100 % vectoriel ; le texte est rasterisé LOCALEMENT (sharp +
// polices système) puis les PNG versionnés sont uploadés tels quels par le seed
// — aucune dépendance à une police côté serveur. Déterministe → testable.
//
// Slots : strip 1125×369, hero 1032×336, logo 480×150, icon 348, gicon 660.

import type { DemoArtMotif } from "./kit";

export type ArtPalette = {
  background: string;
  foreground: string;
  label: string;
  accent: string;
};

export type ArtText = {
  /** Mot dominant (serif italique, gros). Ex. « du Rhône ». */
  dominant: string;
  /** Sous-titre capitales trackées. Ex. « CAFÉ · GENÈVE ». */
  subtitle: string;
  /** Signature discrète (fondation / quartier / spécialité). */
  signature: string;
};

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

// ── defs partagés : fond, halo, ombre portée, grain « papier » ───────────────

function defs(p: ArtPalette, w: number, h: number, mx: number, my: number): string {
  const deep = mix(p.background, "black", 0.3);
  const lift = mix(p.background, "white", 0.07);
  return (
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${lift}"/><stop offset="1" stop-color="${deep}"/>` +
    `</linearGradient>` +
    // Halo radial derrière la métaphore (accent métallique, doux).
    `<radialGradient id="halo" cx="${f(mx / w)}" cy="${f(my / h)}" r="0.42">` +
    `<stop offset="0" stop-color="${p.accent}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    // Ombre portée fine (décolle la métaphore du fond).
    `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.25"/>` +
    `</filter>` +
    // Grain « papier » : bruit fractal désaturé, très léger.
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
    `<rect width="${w}" height="${h}"${rx} filter="url(#grain)" opacity="0.05"/>`
  );
}

// Liseré or fin intérieur.
function liseret(p: ArtPalette, w: number, h: number, inset: number, rx: number): string {
  return `<rect x="${f(inset)}" y="${f(inset)}" width="${f(w - inset * 2)}" height="${f(h - inset * 2)}" rx="${f(rx)}" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.5"/>`;
}

// ── typographie dessinée (alignée à gauche dans les 2/3) ─────────────────────

function typography(t: ArtText, p: ArtPalette, w: number, h: number): string {
  const x = w * 0.07;
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "Helvetica, Arial, sans-serif";
  const domSize = h * 0.185; // ≈ 68pt sur 369
  const subSize = h * 0.037; // ≈ 13-14pt
  const tracking = subSize * 0.18;
  return (
    `<text x="${f(x)}" y="${f(h * 0.47)}" font-family="${serif}" font-style="italic" font-size="${f(domSize)}" fill="${p.foreground}">${esc(t.dominant)}</text>` +
    `<text x="${f(x)}" y="${f(h * 0.63)}" font-family="${sans}" font-size="${f(subSize)}" letter-spacing="${f(tracking)}" fill="${p.label}">${esc(t.subtitle)}</text>` +
    `<text x="${f(x)}" y="${f(h * 0.78)}" font-family="${serif}" font-style="italic" font-size="${f(subSize)}" fill="${p.label}" opacity="0.7">${esc(t.signature)}</text>`
  );
}

// ── métaphores éditoriales (bannière : tiers droit / pleine largeur) ─────────

function mBean(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.8, my = h * 0.52, s = h * 0.3;
  const sw = Math.max(3, s * 0.13);
  const fg = p.foreground, ac = p.accent;
  // Grain de café : amande + sillon central en S.
  const bean =
    `<g transform="rotate(-16 ${f(mx)} ${f(my)})">` +
    `<ellipse cx="${f(mx)}" cy="${f(my)}" rx="${f(s * 0.5)}" ry="${f(s * 0.78)}" fill="none" stroke="${fg}" stroke-width="${f(sw)}"/>` +
    `<path d="M ${f(mx)} ${f(my - s * 0.66)} C ${f(mx + s * 0.26)} ${f(my - s * 0.22)}, ${f(mx - s * 0.26)} ${f(my + s * 0.22)}, ${f(mx)} ${f(my + s * 0.66)}" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.82)}" stroke-linecap="round"/>` +
    `</g>`;
  // 3 brins de vapeur en spirale qui s'évanouissent (or).
  const vapor = [-0.46, 0, 0.46]
    .map((o, i) => {
      const vx = mx + o * s * 0.5, vy = my - s * 0.98;
      const q = s * 0.16, r = s * 0.42;
      return `<path d="M ${f(vx)} ${f(vy)} q ${f(q)} ${f(-r * 0.55)} 0 ${f(-r)} q ${f(-q)} ${f(-r * 0.55)} 0 ${f(-r)} q ${f(q)} ${f(-r * 0.55)} 0 ${f(-r)}" fill="none" stroke="${ac}" stroke-width="${f(sw * 0.6)}" stroke-linecap="round" opacity="${f(0.55 - i * 0.07)}"/>`;
    })
    .join("");
  // 2 grains d'accent.
  const small =
    `<ellipse cx="${f(mx - s * 1.05)}" cy="${f(my + s * 0.55)}" rx="${f(s * 0.17)}" ry="${f(s * 0.27)}" fill="${ac}" opacity="0.55" transform="rotate(22 ${f(mx - s * 1.05)} ${f(my + s * 0.55)})"/>` +
    `<ellipse cx="${f(mx + s * 0.7)}" cy="${f(my + s * 0.86)}" rx="${f(s * 0.13)}" ry="${f(s * 0.2)}" fill="${ac}" opacity="0.4" transform="rotate(-28 ${f(mx + s * 0.7)} ${f(my + s * 0.86)})"/>`;
  return `<g filter="url(#sh)">${vapor}${bean}</g>${small}`;
}

function mCroissant(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.79, my = h * 0.5, s = h * 0.34;
  const sw = Math.max(3, s * 0.1);
  const fg = p.foreground, ac = p.accent;
  // Croissant ouvert : croissant + 5 arcs de feuilletage internes.
  const body =
    `<path d="M ${f(mx - s * 0.85)} ${f(my + s * 0.45)} A ${f(s * 1.05)} ${f(s * 1.05)} 0 1 1 ${f(mx + s * 0.85)} ${f(my + s * 0.45)} A ${f(s * 0.5)} ${f(s * 0.5)} 0 1 0 ${f(mx - s * 0.85)} ${f(my + s * 0.45)} Z" ` +
    `fill="none" stroke="${fg}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;
  const layers = Array.from({ length: 5 }, (_, i) => {
    const a = Math.PI * (0.78 - i * 0.13);
    const rr = s * 0.78;
    const cx = mx + Math.cos(a) * rr, cy = my - s * 0.05 - Math.sin(a) * rr * 0.5;
    return `<path d="M ${f(cx - s * 0.16)} ${f(cy)} q ${f(s * 0.16)} ${f(-s * 0.2)} ${f(s * 0.32)} 0" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.55)}" stroke-linecap="round" opacity="0.7"/>`;
  }).join("");
  const crumb = `<circle cx="${f(mx + s * 1.0)}" cy="${f(my + s * 0.7)}" r="${f(s * 0.12)}" fill="${ac}" opacity="0.6"/>`;
  return `<g filter="url(#sh)">${body}${layers}</g>${crumb}`;
}

function mPizza(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.79, my = h * 0.5, s = h * 0.34;
  const sw = Math.max(3, s * 0.09);
  const fg = p.foreground, ac = p.accent;
  // Pizza vue de dessus : disque + 8 lignes rayonnantes, 1 part détachée, basilic.
  const disc = `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(s * 0.82)}" fill="none" stroke="${fg}" stroke-width="${f(sw)}"/>`;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 + 22.5) * (Math.PI / 180);
    return `<line x1="${f(mx)}" y1="${f(my)}" x2="${f(mx + Math.cos(a) * s * 0.82)}" y2="${f(my + Math.sin(a) * s * 0.82)}" stroke="${fg}" stroke-width="${f(sw * 0.5)}" opacity="0.6"/>`;
  }).join("");
  // Part détachée à l'écart (en haut à droite).
  const dx = mx + s * 1.05, dy = my - s * 0.75;
  const slice = `<path d="M ${f(dx)} ${f(dy)} l ${f(s * 0.5)} ${f(s * 0.18)} a ${f(s * 0.55)} ${f(s * 0.55)} 0 0 1 ${f(-s * 0.32)} ${f(s * 0.44)} Z" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.8)}" stroke-linejoin="round"/>`;
  const basil = `<ellipse cx="${f(mx + s * 0.2)}" cy="${f(my - s * 0.15)}" rx="${f(s * 0.2)}" ry="${f(s * 0.1)}" fill="${ac}" opacity="0.7" transform="rotate(-35 ${f(mx + s * 0.2)} ${f(my - s * 0.15)})"/>`;
  return `<g filter="url(#sh)">${disc}${rays}${slice}</g>${basil}`;
}

function mHairlock(p: ArtPalette, w: number, h: number): string {
  const sw = Math.max(3, h * 0.035);
  const fg = p.foreground, ac = p.accent;
  // Mèche : courbe en S allongée de coin à coin (bas-gauche → haut-droite).
  const x0 = w * 0.5, y0 = h * 0.88, x1 = w * 0.93, y1 = h * 0.16;
  const s =
    `<path d="M ${f(x0)} ${f(y0)} C ${f(x0 + w * 0.18)} ${f(y0 - h * 0.1)}, ${f(w * 0.6)} ${f(h * 0.55)}, ${f(w * 0.74)} ${f(h * 0.5)} ` +
    `S ${f(x1 - w * 0.02)} ${f(y1 + h * 0.28)}, ${f(x1)} ${f(y1)}" fill="none" stroke="${fg}" stroke-width="${f(sw)}" stroke-linecap="round"/>`;
  // Halo rose-gold diffus + étincelle à la pointe.
  const halo = `<circle cx="${f(x1)}" cy="${f(y1)}" r="${f(h * 0.16)}" fill="${ac}" opacity="0.16"/>`;
  const spark =
    `<g transform="translate(${f(x1)} ${f(y1)})" stroke="${ac}" stroke-width="${f(sw * 0.55)}" stroke-linecap="round">` +
    `<line x1="0" y1="${f(-h * 0.07)}" x2="0" y2="${f(h * 0.07)}"/><line x1="${f(-h * 0.07)}" y1="0" x2="${f(h * 0.07)}" y2="0"/>` +
    `<line x1="${f(-h * 0.04)}" y1="${f(-h * 0.04)}" x2="${f(h * 0.04)}" y2="${f(h * 0.04)}"/><line x1="${f(h * 0.04)}" y1="${f(-h * 0.04)}" x2="${f(-h * 0.04)}" y2="${f(h * 0.04)}"/></g>`;
  return `${halo}<g filter="url(#sh)">${s}</g>${spark}`;
}

function mWaves(p: ArtPalette, w: number, h: number): string {
  const fg = p.foreground, ac = p.accent;
  const sw = Math.max(2.5, h * 0.02);
  // 3 vagues horizontales d'amplitude décroissante, traversant tout le strip.
  const waves = [0, 1, 2]
    .map((i) => {
      const amp = h * (0.13 - i * 0.035);
      const cy = h * (0.34 + i * 0.2);
      let d = `M 0 ${f(cy)}`;
      const seg = w / 4;
      for (let k = 0; k < 4; k++) {
        const x1 = seg * k + seg / 2, x2 = seg * (k + 1);
        const dir = k % 2 === 0 ? -1 : 1;
        d += ` Q ${f(x1)} ${f(cy + dir * amp)} ${f(x2)} ${f(cy)}`;
      }
      return `<path d="${d}" fill="none" stroke="${fg}" stroke-width="${f(sw)}" opacity="${f(0.85 - i * 0.18)}"/>`;
    })
    .join("");
  // Pierre polie ovale (sable) sur le tiers droit.
  const sx = w * 0.82, sy = h * 0.5;
  const stone = `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx="${f(h * 0.18)}" ry="${f(h * 0.12)}" fill="${ac}" opacity="0.7" transform="rotate(-18 ${f(sx)} ${f(sy)})"/>` +
    `<ellipse cx="${f(sx - h * 0.05)}" cy="${f(sy - h * 0.03)}" rx="${f(h * 0.06)}" ry="${f(h * 0.03)}" fill="${mix(p.accent, "white", 0.45)}" opacity="0.6" transform="rotate(-18 ${f(sx)} ${f(sy)})"/>`;
  return `<g filter="url(#sh)">${waves}</g>${stone}`;
}

function mWheat(p: ArtPalette, w: number, h: number): string {
  const mx = w * 0.81, my = h * 0.5, s = h * 0.42;
  const sw = Math.max(2.5, s * 0.05);
  const fg = p.foreground, ac = p.accent;
  // Épi de blé : tige + 5 grains en chevron + barbes fines + 1 grain détaché.
  const stem = `<line x1="${f(mx)}" y1="${f(my + s * 0.7)}" x2="${f(mx)}" y2="${f(my - s * 0.72)}" stroke="${fg}" stroke-width="${f(sw)}" stroke-linecap="round"/>`;
  const grains = Array.from({ length: 5 }, (_, i) => {
    const gy = my - s * 0.62 + i * s * 0.3;
    const grain = (sign: number) =>
      `<path d="M ${f(mx)} ${f(gy)} q ${f(sign * s * 0.26)} ${f(-s * 0.05)} ${f(sign * s * 0.3)} ${f(s * 0.2)} q ${f(-sign * s * 0.04)} ${f(s * 0.06)} ${f(-sign * s * 0.3)} ${f(s * 0.02)} Z" fill="none" stroke="${fg}" stroke-width="${f(sw * 0.8)}" stroke-linejoin="round"/>`;
    return grain(-1) + grain(1);
  }).join("");
  const awns = [-1, 1]
    .map((sign) => `<line x1="${f(mx)}" y1="${f(my - s * 0.7)}" x2="${f(mx + sign * s * 0.34)}" y2="${f(my - s * 1.02)}" stroke="${ac}" stroke-width="${f(sw * 0.5)}" stroke-linecap="round" opacity="0.7"/>`)
    .join("") + `<line x1="${f(mx)}" y1="${f(my - s * 0.7)}" x2="${f(mx)}" y2="${f(my - s * 1.06)}" stroke="${ac}" stroke-width="${f(sw * 0.5)}" stroke-linecap="round" opacity="0.7"/>`;
  const detached = `<path d="M ${f(mx - s * 0.95)} ${f(my + s * 0.5)} q ${f(s * 0.24)} ${f(-s * 0.05)} ${f(s * 0.28)} ${f(s * 0.18)} q ${f(-s * 0.04)} ${f(s * 0.06)} ${f(-s * 0.28)} ${f(s * 0.02)} Z" fill="${ac}" opacity="0.5" transform="rotate(-20 ${f(mx - s * 0.95)} ${f(my + s * 0.5)})"/>`;
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

// Position du halo (centre de la métaphore) par motif.
function haloCenter(m: DemoArtMotif, w: number, h: number): [number, number] {
  if (m === "waves") return [w * 0.82, h * 0.5];
  if (m === "hairlock") return [w * 0.86, h * 0.3];
  return [w * 0.8, h * 0.5];
}

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// ── slots ────────────────────────────────────────────────────────────────────

export function stripSvg(spec: ArtSpec, w = 1125, h = 369): string {
  const { motif, palette: p, text } = spec;
  const [mx, my] = haloCenter(motif, w, h);
  const body =
    defs(p, w, h, mx, my) +
    backdrop(p, w, h) +
    liseret(p, w, h, h * 0.08, h * 0.07) +
    metaphor(motif, p, w, h) +
    typography(text, p, w, h);
  return svg(w, h, body);
}

export function heroSvg(spec: ArtSpec, w = 1032, h = 336): string {
  const { motif, palette: p, text } = spec;
  const [mx, my] = haloCenter(motif, w, h);
  const body =
    defs(p, w, h, mx, my) +
    backdrop(p, w, h) +
    liseret(p, w, h, h * 0.085, h * 0.07) +
    metaphor(motif, p, w, h) +
    typography(text, p, w, h);
  return svg(w, h, body);
}

// Emblème large (480×150), fond TRANSPARENT, métaphore + filet or (simple).
export function logoSvg(spec: ArtSpec, w = 480, h = 150): string {
  const { motif, palette: p } = spec;
  const body =
    defs(p, w, h, h * 0.5, h * 0.5) +
    `<g transform="translate(${f(-w * 0.3)} 0)">${metaphor(motif, p, w, h)}</g>` +
    [0.42, 0.58]
      .map((o, i) => `<rect x="${f(h * 1.0)}" y="${f(h * o - 2)}" width="${f((w - h) * (i === 0 ? 0.78 : 0.5))}" height="3" rx="1.5" fill="${p.accent}" opacity="${i === 0 ? 0.8 : 0.4}"/>`)
      .join("");
  return svg(w, h, body);
}

// Icône carrée (348), fond plein + métaphore centrée (reste simple).
export function iconSvg(spec: ArtSpec, size = 348): string {
  const { motif, palette: p } = spec;
  const body =
    defs(p, size, size, size / 2, size / 2) +
    backdrop(p, size, size, size * 0.22) +
    liseret(p, size, size, size * 0.1, size * 0.16) +
    // Métaphore recadrée au centre (on réutilise le dessin bannière, recentré).
    `<g transform="translate(${f(-size * 0.3)} 0)">${metaphor(motif, p, size, size)}</g>`;
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
