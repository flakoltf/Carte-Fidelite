// Logique PURE de l'onglet Clients : fusion des segments serveur en lignes,
// recherche, filtre, mise en forme des dates. Aucun calcul de fidélité ici —
// le serveur est seul juge (mécanique, seuils, statuts).

import { STAGE_KEYS, type SegmentMember, type StageKey } from "./contracts";

export type ClientRow = {
  id: string;
  name: string;
  initials: string;
  stage: StageKey;
  lastScan: string | null;
  visits: number;
};

export type StageFilter = StageKey | "all";

const parseDate = (iso: string | null): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const collator = new Intl.Collator("fr", { sensitivity: "base" });

export function initials(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function buildClientRows(byStage: Partial<Record<StageKey, SegmentMember[]>>): ClientRow[] {
  const rows: ClientRow[] = [];
  for (const stage of STAGE_KEYS) {
    for (const m of byStage[stage] ?? []) {
      const name = m.name.trim();
      rows.push({
        id: m.customerId,
        name,
        initials: initials(name),
        stage,
        lastScan: parseDate(m.lastScan) ? m.lastScan : null,
        visits: m.visits,
      });
    }
  }
  return rows.sort((a, b) => {
    const ta = parseDate(a.lastScan)?.getTime() ?? null;
    const tb = parseDate(b.lastScan)?.getTime() ?? null;
    if (ta !== null && tb !== null && ta !== tb) return tb - ta;
    if (ta === null && tb !== null) return 1;
    if (ta !== null && tb === null) return -1;
    return collator.compare(a.name, b.name);
  });
}

const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function filterClientRows(rows: ClientRow[], query: string, stage: StageFilter): ClientRow[] {
  const q = fold(query);
  return rows.filter((r) => (stage === "all" || r.stage === stage) && (!q || fold(r.name).includes(q)));
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const DAY_MS = 86_400_000;
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatLastVisit(iso: string | null, now: Date = new Date()): string {
  const date = parseDate(iso);
  if (!date) return "Jamais venu";
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

export function visitsLabel(visits: number): string {
  if (visits <= 0) return "Aucune visite";
  return `${visits} visite${visits > 1 ? "s" : ""}`;
}
