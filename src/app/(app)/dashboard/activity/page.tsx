import Link from "next/link";
import { QrCode, UserPlus, Gift, History } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
  buildTimeline,
  parseActivityRange,
  ACTIVITY_RANGES,
  type TimelineEventType,
} from "@/lib/merchant/activity";
import { relativeTime } from "@/lib/analytics/activity";

export const dynamic = "force-dynamic";

// Page Activité (Agent A) — chronologie complète du comptoir : passages
// scannés, nouvelles cartes, récompenses encaissées. Requêtes via le client
// RLS (scopé tenant) + .eq('merchant_id') explicite (invariant 3).

const EVENT_STYLE: Record<TimelineEventType, { icon: typeof QrCode; bg: string; label: (who: string, points?: number) => string }> = {
  scan: {
    icon: QrCode,
    bg: "bg-halo/10 text-halo",
    label: (who, points) => `${who} — passage scanné${points && points > 1 ? ` (+${points})` : ""}`,
  },
  signup: {
    icon: UserPlus,
    bg: "bg-amber-500/10 text-amber-600",
    label: (who) => `${who} — nouvelle carte installée`,
  },
  reward: {
    icon: Gift,
    bg: "bg-purple-500/10 text-purple-600",
    label: (who) => `${who} — récompense encaissée`,
  },
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = parseActivityRange(rawRange);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user?.id)
    .single();

  const now = new Date();
  const cutoff = new Date(now.getTime() - range * 86400000).toISOString();

  type ScanRow = { scanned_at: string; points_added: number | null; loyalty_cards: { customers: { full_name: string | null } | null } | null };
  type RewardRow = { created_at: string; card_id: string | null };

  let days: ReturnType<typeof buildTimeline>["days"] = [];
  let stats = { scans: 0, signups: 0, rewards: 0 };

  if (merchant) {
    try {
      const [scansRes, signupsRes, rewardsRes] = await Promise.all([
        supabase
          .from("scan_history")
          .select("scanned_at, points_added, loyalty_cards(customers(full_name))")
          .eq("merchant_id", merchant.id)
          .gte("scanned_at", cutoff)
          .order("scanned_at", { ascending: false })
          .limit(150),
        supabase
          .from("customers")
          .select("full_name, created_at")
          .eq("merchant_id", merchant.id)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("audit_logs")
          .select("created_at, card_id")
          .eq("merchant_id", merchant.id)
          .eq("action", "REWARD_REDEEMED")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      // Résolution des noms pour les récompenses (audit_logs n'a plus de FK).
      const rewardRows = (rewardsRes.data ?? []) as RewardRow[];
      const cardIds = [...new Set(rewardRows.map((r) => r.card_id).filter(Boolean))] as string[];
      const nameByCard = new Map<string, string>();
      if (cardIds.length > 0) {
        const { data: cards } = await supabase
          .from("loyalty_cards")
          .select("id, customers(full_name)")
          .eq("merchant_id", merchant.id)
          .in("id", cardIds);
        for (const c of (cards ?? []) as unknown as { id: string; customers: { full_name: string | null } | null }[]) {
          if (c.customers?.full_name) nameByCard.set(c.id, c.customers.full_name);
        }
      }

      const timeline = buildTimeline(
        ((scansRes.data ?? []) as unknown as ScanRow[]).map((s) => ({
          scanned_at: s.scanned_at,
          who: s.loyalty_cards?.customers?.full_name ?? null,
          points_added: s.points_added,
        })),
        (signupsRes.data ?? []).map((c) => ({
          created_at: c.created_at as string,
          who: (c.full_name as string) ?? null,
        })),
        rewardRows.map((r) => ({
          created_at: r.created_at,
          who: r.card_id ? (nameByCard.get(r.card_id) ?? null) : null,
        })),
        now
      );
      days = timeline.days;
      stats = timeline.stats;
    } catch {
      days = [];
    }
  }

  const total = stats.scans + stats.signups + stats.rewards;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Activité</h1>
          <p className="text-galet-ink">
            Tout ce qui s&apos;est passé au comptoir : passages, nouvelles cartes, récompenses.
          </p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Période affichée">
          {ACTIVITY_RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard/activity?range=${r}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                r === range
                  ? "bg-halo text-white"
                  : "border border-line-warm text-galet-ink hover:bg-calcaire"
              }`}
            >
              {r} jours
            </Link>
          ))}
        </div>
      </div>

      {/* Compteurs de la période */}
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            ["Passages scannés", stats.scans, "scan"],
            ["Nouvelles cartes", stats.signups, "signup"],
            ["Récompenses", stats.rewards, "reward"],
          ] as const
        ).map(([label, value, type]) => {
          const Icon = EVENT_STYLE[type].icon;
          return (
            <div key={label} className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
              <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full ${EVENT_STYLE[type].bg}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="font-display text-2xl text-onyx tabular-nums">{value}</p>
              <p className="text-xs text-galet-ink">{label} · {range} j</p>
            </div>
          );
        })}
      </div>

      {/* Chronologie */}
      {total === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-line-warm bg-surface p-12 text-center">
          <History className="mx-auto mb-4 h-10 w-10 text-galet opacity-40" aria-hidden />
          <p className="font-bold text-onyx">Rien sur cette période</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-galet-ink">
            Dès qu&apos;un client scanne votre QR ou passe en caisse, chaque événement apparaît ici,
            minute par minute. Le bon réflexe : proposer la carte à chaque encaissement.
          </p>
          <Link
            href="/dashboard/card"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-halo px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-halo-600"
          >
            Récupérer mon QR d&apos;inscription
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.day} className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-bold capitalize text-onyx">
                {day.label}
                <span className="ml-2 text-xs font-normal text-galet">
                  {day.events.length} événement{day.events.length > 1 ? "s" : ""}
                </span>
              </h2>
              <ul className="divide-y divide-line-warm">
                {day.events.map((e, i) => {
                  const style = EVENT_STYLE[e.type];
                  const Icon = style.icon;
                  return (
                    <li key={`${e.type}-${e.at}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="flex-1 text-onyx">{style.label(e.who, e.points)}</span>
                      <span className="shrink-0 text-xs text-galet">{relativeTime(e.at, now)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
