import Link from "next/link";
import { Wand2, Clock, Gauge } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PageHeader, KpiCard, Section, EmptyState, Pill, formatDateCH } from "../components/ui";
import MarkDoneButton from "./MarkDoneButton";

export const dynamic = "force-dynamic";

// File « cartes à personnaliser » — marchands ayant choisi le parcours
// « HALO crée ma carte ». Leur carte provisoire (design par défaut) est déjà
// en ligne : objectif, livrer le design sur-mesure sous 24 h ouvrées.
// Lecture service-role assumée : page sous garde admin (layout requireAdminPage),
// vue PLATEFORME (tous tenants) comme les autres écrans /admin.

interface ConciergeRow {
  id: string;
  shop_name: string | null;
  business_type: string | null;
  slug: string | null;
  created_at: string | null;
  onboarding_completed_at: string | null;
  concierge_design_requested_at: string | null;
  concierge_design_done_at: string | null;
}

function hoursBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms / 3_600_000 : null;
}

function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(h < 10 ? 1 : 0)} h`;
}

// SLA 24 h ouvrées (approximation 24 h pleines pour le badge « en retard »).
// Server Component force-dynamic : évalué une fois par requête.
function isLate(r: ConciergeRow): boolean {
  return (
    Boolean(r.concierge_design_requested_at) &&
    Date.now() - new Date(r.concierge_design_requested_at as string).getTime() > 24 * 3_600_000
  );
}

export default async function AdminConcierge() {
  // Lecture défensive : colonnes absentes tant que la migration 20260614
  // n'est pas appliquée — la page reste navigable et l'explique.
  let rows: ConciergeRow[] = [];
  let migrationMissing = false;
  try {
    const { data, error } = await supabaseAdmin
      .from("merchants")
      .select(
        "id, shop_name, business_type, slug, created_at, onboarding_completed_at, concierge_design_requested_at, concierge_design_done_at"
      )
      .not("concierge_design_requested_at", "is", null)
      .order("concierge_design_requested_at", { ascending: true });
    if (error) {
      migrationMissing = true;
    } else {
      rows = (data ?? []) as ConciergeRow[];
    }
  } catch {
    migrationMissing = true;
  }

  const pending = rows.filter((r) => !r.concierge_design_done_at);
  const delivered = rows.filter((r) => r.concierge_design_done_at);

  // Time-to-QR : vérification email (≈ created_at du tenant) → mise en ligne.
  const ttqValues = rows
    .map((r) => hoursBetween(r.created_at, r.onboarding_completed_at))
    .filter((v): v is number => v !== null);
  const ttqMedian = ttqValues.length
    ? [...ttqValues].sort((a, b) => a - b)[Math.floor(ttqValues.length / 2)]
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="File concierge"
        subtitle="Parcours « HALO crée ma carte » : la carte provisoire est en ligne, l'équipe livre le design sur-mesure sous 24 h ouvrées."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard name="À personnaliser" value={pending.length} hint="cartes en attente de design" icon={Wand2} color="text-amber-600" />
        <KpiCard name="En retard (> 24 h)" value={pending.filter(isLate).length} hint="SLA dépassé" icon={Clock} color="text-red-600" />
        <KpiCard name="Livrées" value={delivered.length} hint="designs sur-mesure publiés" icon={Wand2} color="text-emerald-600" />
        <KpiCard
          name="Time-to-QR médian"
          value={formatHours(ttqMedian)}
          hint="vérif. email → carte en ligne"
          icon={Gauge}
        />
      </div>

      <Section
        title="Cartes à personnaliser"
        description="Triées par ancienneté de demande. « Ouvrir le design » mène à l'éditeur de carte du marchand."
      >
        {migrationMissing ? (
          <EmptyState title="Migration 20260614_concierge_onboarding non appliquée">
            Les colonnes de la file concierge n&apos;existent pas encore en base. Appliquer la
            migration depuis supabase/migrations/ pour activer cet écran.
          </EmptyState>
        ) : pending.length === 0 ? (
          <EmptyState title="Aucune carte en attente">
            Dès qu&apos;un marchand choisit « HALO crée ma carte », il apparaît ici avec son secteur
            et l&apos;heure de sa demande.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border border-line-warm bg-calcaire p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-onyx">{r.shop_name ?? "—"}</span>
                    {isLate(r) ? <Pill tone="rouge">&gt; 24 h</Pill> : <Pill tone="orange">en attente</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs text-galet-ink">
                    {r.business_type ?? "secteur inconnu"} · demandé le {formatDateCH(r.concierge_design_requested_at, true)}
                    {r.slug ? <> · /c/{r.slug}</> : null} · time-to-QR{" "}
                    {formatHours(hoursBetween(r.created_at, r.onboarding_completed_at))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/merchants/${r.id}/card`}
                    className="inline-flex min-h-9 items-center rounded-xl bg-onyx px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-onyx-soft"
                  >
                    Ouvrir le design
                  </Link>
                  <Link
                    href={`/admin/merchants/${r.id}`}
                    className="inline-flex min-h-9 items-center rounded-xl border border-line-warm bg-surface px-3 py-1.5 text-xs font-medium text-galet-ink transition-colors hover:bg-calcaire"
                  >
                    Fiche marchand
                  </Link>
                  <MarkDoneButton merchantId={r.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {!migrationMissing && delivered.length > 0 && (
        <Section title="Livrées récemment" description="Designs sur-mesure publiés — les wallets installés se mettent à jour automatiquement.">
          <ul className="space-y-2">
            {delivered
              .slice()
              .sort((a, b) => (b.concierge_design_done_at ?? "").localeCompare(a.concierge_design_done_at ?? ""))
              .slice(0, 20)
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line-warm bg-surface px-4 py-3 text-sm">
                  <span className="font-medium text-onyx">{r.shop_name ?? "—"}</span>
                  <span className="text-xs text-galet-ink">
                    livré le {formatDateCH(r.concierge_design_done_at, true)} · délai{" "}
                    {formatHours(hoursBetween(r.concierge_design_requested_at, r.concierge_design_done_at))}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
