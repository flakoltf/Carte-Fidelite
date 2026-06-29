import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  CalendarPlus,
  QrCode,
  Gift,
  Stamp,
  Wallet,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { fetchCustomerStages } from "@/lib/segments/fetch";
import { STAGE_STYLE } from "@/lib/segments/stageStyle";
import { relativeTime } from "@/lib/analytics/activity";

export const dynamic = "force-dynamic";

// Fiche client (Agent A) — identité, champs collectés, carte et historique de
// visites. Client RLS + .eq('merchant_id') explicite sur chaque requête.

const WALLET_LABELS: Record<string, string> = { apple: "Apple Wallet", google: "Google Wallet" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user?.id)
    .single();
  if (!merchant) notFound();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, created_at, loyalty_cards(id, stamps_count, pass_type, last_scan, created_at)")
    .eq("merchant_id", merchant.id)
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  type CardRow = { id: string; stamps_count: number; pass_type: string | null; last_scan: string | null; created_at: string };
  const cards = ((customer.loyalty_cards ?? []) as CardRow[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const card = cards[0] ?? null;
  const cardIds = cards.map((c) => c.id);

  const config = await fetchMerchantConfig(merchant.id);
  const stampGoal = config.stampGoal;

  // Historique : visites + récompenses encaissées.
  let visits: { scanned_at: string; points_added: number | null }[] = [];
  let rewardsCount = 0;
  let rewardDates: string[] = [];
  if (cardIds.length > 0) {
    try {
      const [visitsRes, rewardsRes] = await Promise.all([
        supabase
          .from("scan_history")
          .select("scanned_at, points_added")
          .eq("merchant_id", merchant.id)
          .in("card_id", cardIds)
          .order("scanned_at", { ascending: false })
          .limit(60),
        supabase
          .from("audit_logs")
          .select("created_at")
          .eq("merchant_id", merchant.id)
          .eq("action", "REWARD_REDEEMED")
          .in("card_id", cardIds)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      visits = (visitsRes.data ?? []) as typeof visits;
      rewardDates = ((rewardsRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at);
      rewardsCount = rewardDates.length;
    } catch {
      visits = [];
    }
  }

  // Segment du client (réutilise la classification existante).
  const stages = await fetchCustomerStages(merchant.id);
  const stage = stages[customer.id as string];
  const stageStyle = stage ? STAGE_STYLE[stage] : null;

  const now = new Date();
  const lastVisit = visits[0]?.scanned_at ?? card?.last_scan ?? null;

  // Fusion visites + récompenses pour la chronologie.
  const timeline = [
    ...visits.map((v) => ({ type: "scan" as const, at: v.scanned_at, points: v.points_added ?? 1 })),
    ...rewardDates.map((at) => ({ type: "reward" as const, at, points: 0 })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 60);

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1.5 text-sm text-galet-ink transition-colors hover:text-onyx"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Tous les clients
      </Link>

      {/* En-tête fiche */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ backgroundColor: stageStyle?.color ?? "#98999C" }}
            aria-hidden
          >
            {(customer.full_name as string)[0]}
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-tight text-onyx">{customer.full_name as string}</h1>
            {stageStyle && (
              <span
                className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${stageStyle.color}1A`, color: stageStyle.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageStyle.color }} aria-hidden />
                {stageStyle.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
          <Stamp className="mb-2 h-4 w-4 text-halo" aria-hidden />
          <p className="font-display text-2xl text-onyx tabular-nums">
            {card ? `${card.stamps_count}/${stampGoal}` : "—"}
          </p>
          <p className="text-xs text-galet-ink">Tampons en cours</p>
        </div>
        <div className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
          <QrCode className="mb-2 h-4 w-4 text-halo" aria-hidden />
          <p className="font-display text-2xl text-onyx tabular-nums">{visits.length}</p>
          <p className="text-xs text-galet-ink">Passages enregistrés</p>
        </div>
        <div className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
          <Gift className="mb-2 h-4 w-4 text-purple-600" aria-hidden />
          <p className="font-display text-2xl text-onyx tabular-nums">{rewardsCount}</p>
          <p className="text-xs text-galet-ink">Récompenses encaissées</p>
        </div>
        <div className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
          <CalendarPlus className="mb-2 h-4 w-4 text-amber-600" aria-hidden />
          <p className="font-display text-2xl text-onyx">
            {lastVisit ? relativeTime(lastVisit, now) : "jamais"}
          </p>
          <p className="text-xs text-galet-ink">Dernière visite</p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        {/* Chronologie */}
        <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
          <h2 className="mb-1 font-bold text-onyx">Historique des visites</h2>
          <p className="mb-4 text-xs text-galet-ink">Passages scannés et récompenses, du plus récent au plus ancien.</p>
          {timeline.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line-warm p-5 text-center text-sm text-galet-ink">
              Aucun passage pour l&apos;instant — la première visite scannée apparaîtra ici.
            </p>
          ) : (
            <ul className="divide-y divide-line-warm">
              {timeline.map((e, i) => (
                <li key={`${e.type}-${e.at}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      e.type === "scan" ? "bg-halo/10 text-halo" : "bg-purple-500/10 text-purple-600"
                    }`}
                  >
                    {e.type === "scan" ? <QrCode className="h-4 w-4" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
                  </span>
                  <span className="flex-1 text-onyx">
                    {e.type === "scan"
                      ? `Passage scanné${e.points > 1 ? ` (+${e.points} tampons)` : ""}`
                      : "Récompense encaissée — carte remise à zéro"}
                  </span>
                  <span className="shrink-0 text-xs text-galet-ink">
                    {new Date(e.at).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Colonne infos */}
        <div className="space-y-4">
          <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
            <h2 className="mb-3 font-bold text-onyx">Champs collectés</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5 text-galet-ink">
                <Mail className="h-4 w-4 shrink-0 text-galet" aria-hidden />
                {(customer.email as string | null) || <span className="italic text-galet-ink">Email non renseigné</span>}
              </li>
              <li className="flex items-center gap-2.5 text-galet-ink">
                <Phone className="h-4 w-4 shrink-0 text-galet" aria-hidden />
                {(customer.phone as string | null) || <span className="italic text-galet-ink">Téléphone non renseigné</span>}
              </li>
              <li className="flex items-center gap-2.5 text-galet-ink">
                <CalendarPlus className="h-4 w-4 shrink-0 text-galet" aria-hidden />
                Inscrit le{" "}
                {new Date(customer.created_at as string).toLocaleDateString("fr-CH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
            <h2 className="mb-3 font-bold text-onyx">
              {cards.length > 1 ? "Cartes" : "Carte"}
            </h2>
            {cards.length === 0 ? (
              <p className="text-sm italic text-galet-ink">Pas de carte active.</p>
            ) : (
              <ul className="space-y-3">
                {cards.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-line-warm bg-calcaire/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-onyx">
                      <Wallet className="h-4 w-4 text-halo" aria-hidden />
                      {WALLET_LABELS[c.pass_type ?? ""] ?? "Wallet"}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ECE7DB]">
                        <div
                          className="h-full rounded-full bg-halo"
                          style={{ width: `${Math.min(100, (c.stamps_count / stampGoal) * 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-galet-ink">
                        {c.stamps_count}/{stampGoal}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-galet-ink">
                      Installée le {new Date(c.created_at).toLocaleDateString("fr-CH")}
                      {c.last_scan && ` · dernier scan ${relativeTime(c.last_scan, now)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
