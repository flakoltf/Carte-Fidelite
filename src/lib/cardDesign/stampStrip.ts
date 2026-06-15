import type { StampShape } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  RENDU DES TAMPONS SUR LE PASS — générateur de « strip » (bande) PUR
// ─────────────────────────────────────────────────────────────────────────────
// Produit la grille de tampons (alvéoles pleines / vides) sous forme de SVG, à
// partir de StampsConfig + de l'état réel (filledCount / goal). PUR et testable
// sans réseau : le SVG sert au rendu navigateur (preview studio / enrôlement) et
// est rasterisé en PNG (sharp) à l'émission du pass Apple.
//
// Choix de robustesse « rien ne casse au comptoir » :
//  - on dessine des FORMES vectorielles (cercle/arrondi/carré) — aucune
//    dépendance de police, donc rasterisation fiable sur tout runtime ;
//  - l'emoji/icône et les visuels uploadés (filledAssetPath/emptyAssetPath) ne
//    sont PAS rasterisés ici (police/compositing peu fiables côté serveur) :
//    ils restent pour la preview navigateur et une itération ultérieure ;
//  - le compteur « X / Y » reste dans le champ texte du pass ({points}) : le
//    strip est purement visuel (pas de texte rasterisé).

export type StampCell = { index: number; filled: boolean };

// Bornes de rendu : en deçà/au-delà, le strip resterait illisible.
export const STAMP_RENDER_MIN_GOAL = 1;
export const STAMP_RENDER_MAX_GOAL = 20;

// Disposition lisible : une seule rangée jusqu'à 10, deux rangées au-delà.
export function stampGrid(goal: number): { cols: number; rows: number } {
  const g = clampGoal(goal);
  const rows = g <= 10 ? 1 : 2;
  const cols = Math.ceil(g / rows);
  return { cols, rows };
}

export function clampGoal(goal: number): number {
  if (!Number.isFinite(goal)) return 10;
  return Math.max(STAMP_RENDER_MIN_GOAL, Math.min(STAMP_RENDER_MAX_GOAL, Math.floor(goal)));
}

// État de chaque alvéole. filledCount est borné à [0, goal].
export function stampCells(goal: number, filledCount: number): StampCell[] {
  const g = clampGoal(goal);
  const filled = Math.max(0, Math.min(g, Math.floor(Number.isFinite(filledCount) ? filledCount : 0)));
  return Array.from({ length: g }, (_, i) => ({ index: i, filled: i < filled }));
}

function shapePath(shape: StampShape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case "circle":
      return `<circle cx="${cx}" cy="${cy}" r="${r}" {{attrs}} />`;
    case "square":
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" {{attrs}} />`;
    case "rounded":
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.35}" ry="${r * 0.35}" {{attrs}} />`;
  }
}

export type StampStripOptions = {
  goal: number;
  filledCount: number;
  shape?: StampShape;
  colors?: { background: string; foreground: string; label: string };
  /** Dimensions de base du strip (ratio Apple storeCard ≈ 3:1). */
  width?: number;
  height?: number;
};

// Génère le SVG du strip. Déterministe → testable au caractère près.
export function stampStripSvg(opts: StampStripOptions): string {
  const { goal, filledCount } = opts;
  const shape: StampShape = opts.shape ?? "circle";
  const bg = opts.colors?.background ?? "#0D6B5E";
  const filledFill = opts.colors?.foreground ?? "#FFFFFF";
  const emptyStroke = opts.colors?.label ?? "#BFEEE6";
  const width = opts.width ?? 1125;
  const height = opts.height ?? 369;

  const { cols, rows } = stampGrid(goal);
  const cells = stampCells(goal, filledCount);

  // Géométrie : marges proportionnelles, cellule = min(largeur, hauteur) dispo.
  const padX = width * 0.06;
  const padY = height * 0.12;
  const gridW = width - padX * 2;
  const gridH = height - padY * 2;
  const cellW = gridW / cols;
  const cellH = gridH / rows;
  const r = Math.min(cellW, cellH) * 0.34; // rayon de l'alvéole
  const stroke = Math.max(2, r * 0.12);

  const shapes = cells
    .map((cell) => {
      const col = cell.index % cols;
      const row = Math.floor(cell.index / cols);
      const cx = padX + cellW * col + cellW / 2;
      const cy = padY + cellH * row + cellH / 2;
      const attrs = cell.filled
        ? `fill="${filledFill}"`
        : `fill="none" stroke="${emptyStroke}" stroke-width="${stroke.toFixed(1)}" opacity="0.8"`;
      return shapePath(shape, cx, cy, r).replace("{{attrs}}", attrs);
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}" />` +
    shapes +
    `</svg>`
  );
}
