// Jetons de marque HALO — miroir mobile de `docs/brand-guidelines.md` et
// `assets/design-tokens.json`. Source unique : aucune couleur en dur ailleurs.
import { Platform } from "react-native";

export const colors = {
  // Marque
  halo: "#0D6B5E", // Emerald — couleur d'action
  haloDark: "#0A574C", // hover / pressed
  haloDeep: "#08443B",
  glow: "#1FB89A", // Emerald Glow — le « halo »
  glowSoft: "#C8F5EA",

  // Base
  onyx: "#0E0F11",
  onyxLight: "#2A2C30",
  calcaire: "#F3F0E9", // fond clair, sensation papier
  surface: "#FFFFFF",
  white: "#FFFFFF",

  // Texte / lignes
  ink: "#0E0F11",
  inkMuted: "#5E6063", // galet-ink : contraste AA sur calcaire ET sur blanc
  galet: "#9B9DA0",
  line: "#E6E1D5", // line-warm

  // Sémantique
  success: "#1FB89A",
  warning: "#E8B964",
  error: "#E2513A",
  errorSoft: "#FBEAE6",
  info: "#4FA3E0",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 18,
  xl: 24,
  pill: 100,
} as const;

// Typographie système : San Francisco (iOS) / Roboto (Android). Canela et Söhne
// sont sous licence et non embarquées ici — l'app assume la grotesque système,
// le contraste éditorial reste au web.
export const fonts = {
  body: Platform.select({ ios: "System", default: "sans-serif" }) as string,
  mono: Platform.select({ ios: "Menlo", default: "monospace" }) as string,
} as const;

export const type = {
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "600" },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 1.6 },
} as const;

// Apple HIG et Material : 44 pt est le plancher d'une cible tactile.
export const MIN_TOUCH_TARGET = 44;

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: colors.onyx,
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    default: { elevation: 2 },
  }),
} as const;
