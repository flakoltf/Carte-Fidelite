// Horaires d'ouverture du commerce — modèle de données + calcul « horaires du
// jour » poussé sur la carte wallet (Feature 1, carte vivante).
//
// Logique PURE et testable (le `now` est injecté). Fuseau par défaut
// Europe/Zurich : le commerçant et ses clients sont en Suisse, le jour affiché
// doit suivre l'heure locale, pas l'UTC du serveur Vercel.

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

// Plage d'un jour : { open, close } en "HH:MM" 24 h, ou null = fermé ce jour.
export type DayHours = { open: string; close: string } | null;

export type BusinessHours = Record<WeekdayKey, DayHours>;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
};

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Valide + normalise une structure d'horaires reçue (entrée API). Tolérante :
// toute valeur invalide → jour fermé (null) plutôt que de rejeter tout le bloc.
export function normalizeBusinessHours(input: unknown): BusinessHours {
  const out: BusinessHours = { ...DEFAULT_BUSINESS_HOURS };
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;
  for (const key of WEEKDAY_KEYS) {
    const day = obj[key];
    if (!day || typeof day !== "object") continue;
    const { open, close } = day as { open?: unknown; close?: unknown };
    if (typeof open === "string" && typeof close === "string" && HHMM_RE.test(open) && HHMM_RE.test(close) && open < close) {
      out[key] = { open, close };
    }
  }
  return out;
}

export function hasAnyHours(hours: BusinessHours): boolean {
  return WEEKDAY_KEYS.some((k) => hours[k] !== null);
}

// Jour de la semaine (clé) à la date `now` dans le fuseau donné.
export function weekdayKeyInTz(now: Date, timeZone = "Europe/Zurich"): WeekdayKey {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  const map: Record<string, WeekdayKey> = {
    Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun",
  };
  return map[short] ?? "mon";
}

// Libellé « horaires du jour » à afficher sur la carte, ou null si aucun horaire
// n'est configuré (le champ est alors omis du pass plutôt qu'affiché vide).
export function todaysHoursLabel(
  hours: BusinessHours,
  now: Date,
  timeZone = "Europe/Zurich"
): string | null {
  if (!hasAnyHours(hours)) return null;
  const today = hours[weekdayKeyInTz(now, timeZone)];
  if (!today) return "Fermé aujourd'hui";
  return `${today.open} – ${today.close}`;
}
