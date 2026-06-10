// Page Activité du marchand (Agent A) — logique pure : fusion des scans,
// inscriptions et récompenses encaissées en une chronologie groupée par jour.
// Les données arrivent de requêtes RLS scopées au tenant (+ .eq explicite).

export type TimelineEventType = 'scan' | 'signup' | 'reward';

export interface TimelineEvent {
  type: TimelineEventType;
  who: string;
  at: string; // ISO
  /** Points ajoutés (scans uniquement). */
  points?: number;
}

export interface TimelineDay {
  /** Clé jour locale YYYY-MM-DD. */
  day: string;
  label: string;
  events: TimelineEvent[];
}

export interface TimelineStats {
  scans: number;
  signups: number;
  rewards: number;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayLabel(key: string, now: Date): string {
  if (key === dayKey(now)) return "Aujourd'hui";
  const yesterday = new Date(now.getTime() - 86400000);
  if (key === dayKey(yesterday)) return 'Hier';
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function buildTimeline(
  scans: { scanned_at: string; who: string | null; points_added: number | null }[],
  signups: { created_at: string; who: string | null }[],
  rewards: { created_at: string; who: string | null }[],
  now: Date,
  maxEvents = 200
): { days: TimelineDay[]; stats: TimelineStats } {
  const events: TimelineEvent[] = [
    ...scans.map((s) => ({
      type: 'scan' as const,
      who: s.who || 'Client',
      at: s.scanned_at,
      points: s.points_added ?? 1,
    })),
    ...signups.map((c) => ({ type: 'signup' as const, who: c.who || 'Client', at: c.created_at })),
    ...rewards.map((r) => ({ type: 'reward' as const, who: r.who || 'Client', at: r.created_at })),
  ]
    .filter((e) => e.at && !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, maxEvents);

  const stats: TimelineStats = {
    scans: events.filter((e) => e.type === 'scan').length,
    signups: events.filter((e) => e.type === 'signup').length,
    rewards: events.filter((e) => e.type === 'reward').length,
  };

  const days: TimelineDay[] = [];
  for (const event of events) {
    const key = dayKey(new Date(event.at));
    const last = days[days.length - 1];
    if (last && last.day === key) last.events.push(event);
    else days.push({ day: key, label: dayLabel(key, now), events: [event] });
  }

  return { days, stats };
}

// Fenêtres d'affichage proposées par la page Activité.
export const ACTIVITY_RANGES = [7, 30, 90] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

export function parseActivityRange(raw: string | undefined): ActivityRange {
  const n = Number(raw);
  return (ACTIVITY_RANGES as readonly number[]).includes(n) ? (n as ActivityRange) : 30;
}
