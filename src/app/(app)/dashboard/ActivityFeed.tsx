import { QrCode, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { mergeActivityFeed, relativeTime } from "@/lib/analytics/activity";

// Flux d'activité récent du marchand connecté — requêtes RLS scopées au tenant
// (.eq explicite en plus de la RLS, invariant 3). Best-effort : jamais de crash.
export default async function ActivityFeed({ merchantId }: { merchantId: string }) {
  const supabase = await createClient();
  const now = new Date();

  let events: ReturnType<typeof mergeActivityFeed> = [];
  try {
    const [scansRes, signupsRes] = await Promise.all([
      supabase
        .from("scan_history")
        .select("scanned_at, loyalty_cards(customers(full_name))")
        .eq("merchant_id", merchantId)
        .order("scanned_at", { ascending: false })
        .limit(8),
      supabase
        .from("customers")
        .select("full_name, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    type ScanRow = { scanned_at: string; loyalty_cards: { customers: { full_name: string | null } | null } | null };
    events = mergeActivityFeed(
      ((scansRes.data ?? []) as unknown as ScanRow[]).map((s) => ({
        scanned_at: s.scanned_at,
        who: s.loyalty_cards?.customers?.full_name ?? null,
      })),
      (signupsRes.data ?? []).map((c) => ({ created_at: c.created_at as string, who: (c.full_name as string) ?? null }))
    );
  } catch {
    events = [];
  }

  return (
    <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
      <h2 className="mb-1 font-bold text-onyx">Activité récente</h2>
      <p className="mb-4 text-xs text-galet-ink">Vos derniers passages en caisse et nouvelles cartes.</p>
      {events.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line-warm p-5 text-center text-sm text-galet-ink">
          Rien pour l&apos;instant — dès le premier scan ou la première carte créée, tout
          s&apos;affichera ici en temps réel.
        </p>
      ) : (
        <ul className="divide-y divide-line-warm">
          {events.map((e, i) => (
            <li key={`${e.type}-${e.at}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  e.type === "scan" ? "bg-halo/10 text-halo" : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {e.type === "scan" ? <QrCode className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
              </span>
              <span className="flex-1 text-onyx">
                <span className="font-semibold">{e.who}</span>
                {e.type === "scan" ? " — passage scanné" : " — nouvelle carte"}
              </span>
              <span className="shrink-0 text-xs text-galet-ink">{relativeTime(e.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
