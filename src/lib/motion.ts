// Courbes d'easing partagées — MÊMES valeurs que les tokens CSS de globals.css
// (--ease-out / --ease-in-out / --ease-drawer). framer-motion attend un tuple
// [x1, y1, x2, y2]. Centralisé ici pour qu'enter/exit/morphs soient cohérents
// partout (esprit Linear/Vercel : une seule source de vérité pour le motion).
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
