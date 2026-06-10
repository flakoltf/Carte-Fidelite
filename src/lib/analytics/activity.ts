// Flux d'activité récent du dashboard MARCHAND — fusion scans + inscriptions.
// Logique pure (testée) ; les données arrivent de requêtes RLS scopées au tenant.

export interface ActivityEvent {
  type: "scan" | "signup";
  /** Nom du client final (ou « Client » si indisponible). */
  who: string;
  at: string; // ISO
}

export function mergeActivityFeed(
  scans: { scanned_at: string; who: string | null }[],
  signups: { created_at: string; who: string | null }[],
  limit = 8
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...scans.map((s) => ({ type: "scan" as const, who: s.who || "Client", at: s.scanned_at })),
    ...signups.map((c) => ({ type: "signup" as const, who: c.who || "Client", at: c.created_at })),
  ];
  return events
    .filter((e) => e.at && !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}
