import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  CreditCard,
  BarChart3,
  Users,
  ScanLine,
  Wallet,
  Megaphone,
  HeartPulse,
  Banknote,
  History,
  StickyNote,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { resolveMerchantConfig } from "@/lib/merchant-config/resolve";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { computeUsage, BILLING_PLANS } from "@/lib/billing/usage";
import { fetchMerchantDetail, fetchMerchantUsageStats, fetchMerchantTimeline } from "@/lib/admin/merchantDetail";
import { fetchMerchantSnapshots } from "@/lib/admin/billingOverview";
import { fetchNotesForMerchant } from "@/lib/admin/leads";
import EnrollmentQR from "../../EnrollmentQR";
import EditMerchantForm from "./EditMerchantForm";
import ManageAsButton from "../ManageAsButton";
import ManagementModeToggle from "../ManagementModeToggle";
import MerchantControls from "./MerchantControls";
import BillingControls from "./BillingControls";
import CustomersPanel from "./CustomersPanel";
import NotesPanel from "../../components/NotesPanel";
import { KpiCard, PageHeader, Pill, Section, EmptyState, formatDateCH, relativeDays } from "../../components/ui";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Centre de contrôle d'un marchand : profil, usage vs palier, facturation,
// timeline d'activité, notes CRM, clients (nLPD), suspension/réactivation.
export default async function MerchantCommandCenter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const now = new Date();

  const detail = await fetchMerchantDetail(supabase, id);
  if (!detail) notFound();

  const [stats, timeline, snapshots, notes, legacy] = await Promise.all([
    fetchMerchantUsageStats(supabase, id, now),
    fetchMerchantTimeline(supabase, id),
    fetchMerchantSnapshots(supabase, id),
    fetchNotesForMerchant(supabase, id),
    supabase
      .from("merchants")
      .select("enrollment_token, logo_url, stamp_goal, segment_config, business_type, address, primary_color, loyalty_type, loyalty_config")
      .eq("id", id)
      .maybeSingle(),
  ]);

  const m = legacy.data;
  const cfg = resolveMerchantConfig({ stamp_goal: m?.stamp_goal, segment_config: m?.segment_config });
  const program = resolveLoyaltyProgram({
    loyalty_type: (m?.loyalty_type as string | null) ?? null,
    loyalty_config: m?.loyalty_config ?? null,
    stamp_goal: m?.stamp_goal,
  });
  const milestones = program.type === "visit_based" ? program.config.milestones : [];
  const tiers = program.type === "tiered" ? program.config.tiers : [];

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  // Jauge calculée sur le plafond EFFECTIF (override admin éventuel).
  const usage = computeUsage(stats.activeCards90, detail.plan);
  const cap = detail.cap;
  const ratio = cap ? Math.min(1, stats.activeCards90 / cap) : null;

  const healthTone = detail.status === "suspendu" ? "rouge" : detail.suspendedAt ? "rouge" : "vert";

  return (
    <div className="space-y-8">
      <PageHeader
        backHref="/admin/merchants"
        backLabel="Retour aux marchands"
        title={detail.shopName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{detail.email ?? "—"}</span>
            <Pill tone={detail.status === "suspendu" ? "rouge" : "vert"}>
              {detail.status === "suspendu" ? "Suspendu" : "Actif"}
            </Pill>
            {stats.healthScore !== null && stats.healthStatus !== null && (
              <Pill tone={stats.healthStatus}>Santé {stats.healthScore}/100</Pill>
            )}
            <Pill tone="halo">{BILLING_PLANS[detail.plan].label}</Pill>
            {detail.launchPartner && <Pill tone="neutre">Partenaire de lancement</Pill>}
            {detail.trialEndsAt && new Date(detail.trialEndsAt) > now && (
              <Pill tone="orange">Essai jusqu&apos;au {formatDateCH(detail.trialEndsAt)}</Pill>
            )}
          </span>
        }
        actions={
          <>
            <ManagementModeToggle merchantId={detail.id} initial={detail.managedByConcierge} />
            <ManageAsButton merchantId={detail.id} />
            <Link
              href={`/admin/merchants/${detail.id}/insights`}
              className="inline-flex items-center gap-2 rounded-xl border border-line-warm bg-surface px-4 py-2 text-sm font-medium text-onyx transition-colors hover:bg-calcaire"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              Analytics
            </Link>
            <Link
              href={`/admin/merchants/${detail.id}/card`}
              className="inline-flex items-center gap-2 rounded-xl bg-halo px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-halo-600"
            >
              <CreditCard className="h-4 w-4" aria-hidden />
              Studio de carte
            </Link>
          </>
        }
      />

      {/* ── Vitals ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard name="Clients" value={stats.customers} icon={Users} />
        <KpiCard
          name="Cartes actives (90 j)"
          value={`${stats.activeCards90}${cap ? ` / ${cap}` : ""}`}
          hint={detail.capOverride !== null ? `limite ajustée (palier : ${BILLING_PLANS[detail.plan].cap ?? "∞"})` : "la métrique facturée"}
          icon={CreditCard}
          color="text-emerald-600"
        />
        <KpiCard name="Scans 30 j" value={stats.scans30d} hint={`${stats.scansTotal} au total`} icon={ScanLine} color="text-blue-600" />
        <KpiCard
          name="Wallet"
          value={`${stats.appleCards} / ${stats.googleCards}`}
          hint={`Apple / Google · ${stats.registeredDevices} appareils notifiables`}
          icon={Wallet}
          color="text-purple-600"
        />
        <KpiCard name="Campagnes actives" value={stats.campaignsActive} icon={Megaphone} color="text-amber-600" />
        <KpiCard
          name="Dernier scan"
          value={relativeDays(stats.lastScanAt)}
          hint={`client depuis le ${formatDateCH(detail.createdAt)}`}
          icon={HeartPulse}
          color={healthTone === "rouge" ? "text-red-600" : "text-halo"}
        />
      </div>

      {/* ── Usage vs palier ────────────────────────────────────────────── */}
      <Section
        title="Usage vs palier"
        description={`${usage.headline} — comptage contractuel « carte active 90 j » (CGV §1).`}
      >
        {ratio !== null ? (
          <div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-calcaire">
              <div
                className={`h-full rounded-full transition-all ${ratio >= 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-halo"}`}
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-galet-ink">
              <span>
                {stats.activeCards90} cartes actives · {Math.round((stats.activeCards90 / (cap || 1)) * 100)} % de la limite
              </span>
              <span>limite : {cap}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-galet-ink">Palier sans plafond — comptage figé le 1er de chaque mois.</p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Facturation ──────────────────────────────────────────────── */}
        <Section
          title={
            <span className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-halo" aria-hidden /> Facturation
            </span>
          }
          description="Palier, limite manuelle, essai, partenaire — chaque changement est confirmé puis audité."
        >
          <BillingControls
            merchantId={detail.id}
            current={{
              plan: detail.plan,
              capOverride: detail.capOverride,
              trialEndsAt: detail.trialEndsAt,
              launchPartner: detail.launchPartner,
              billingCycle: detail.billingCycle,
            }}
          />
          <div className="mt-6 border-t border-line-warm pt-4">
            <h3 className="mb-2 text-sm font-bold text-onyx">Snapshots mensuels (font foi — CGV §6)</h3>
            {snapshots.length === 0 ? (
              <p className="text-sm text-galet-ink">
                Aucun snapshot encore — le premier sera figé par le cron du 1er du mois.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-galet-ink">
                    <th className="py-1.5">Période</th>
                    <th className="py-1.5">Cartes actives</th>
                    <th className="py-1.5">Palier figé</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.period} className="border-t border-line-warm">
                      <td className="py-1.5 text-onyx">{s.period.slice(0, 7)}</td>
                      <td className="py-1.5 tabular-nums text-onyx">{s.activeCards90}</td>
                      <td className="py-1.5 text-galet-ink">{s.plan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Section>

        {/* ── Zone de contrôle ─────────────────────────────────────────── */}
        <Section
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden /> Zone de contrôle
            </span>
          }
          description="Actions à impact : confirmation explicite, motif obligatoire, audit systématique."
        >
          <MerchantControls
            merchantId={detail.id}
            shopName={detail.shopName}
            suspended={detail.status === "suspendu"}
            suspendedReason={detail.suspendedReason}
          />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Notes CRM ────────────────────────────────────────────────── */}
        <Section
          title={
            <span className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-600" aria-hidden /> Notes CRM
            </span>
          }
          description="Mémoire de la relation — épinglez pour flaguer « à relancer »."
        >
          <NotesPanel notes={notes} merchantId={detail.id} />
        </Section>

        {/* ── Timeline ─────────────────────────────────────────────────── */}
        <Section
          title={
            <span className="flex items-center gap-2">
              <History className="h-5 w-5 text-halo" aria-hidden /> Activité récente
            </span>
          }
          description="Événements audités + scans agrégés par jour."
        >
          {timeline.length === 0 ? (
            <EmptyState title="Aucune activité enregistrée.">
              Les scans, modifications et actions admin de ce marchand apparaîtront ici.
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {timeline.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.kind === "audit" ? "bg-halo" : "bg-galet"}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-onyx">{e.label}</span>
                    <span className="ml-2 text-xs text-galet">{formatDateCH(e.at, e.kind === "audit")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Clients (nLPD) ─────────────────────────────────────────────── */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-halo" aria-hidden /> Clients finaux
          </span>
        }
        description="Accès minimisé et audité aux données personnelles (nLPD)."
      >
        <CustomersPanel merchantId={detail.id} totalCustomers={stats.customers} />
      </Section>

      {/* ── Profil & programme (formulaire existant) ───────────────────── */}
      <div className="grid gap-8 lg:grid-cols-2">
        <EditMerchantForm
          merchant={{
            id: detail.id,
            shopName: detail.shopName,
            primaryColor: detail.primaryColor || "#0D6B5E",
            logoUrl: (m?.logo_url as string | null) ?? null,
            stampGoal: cfg.stampGoal,
            scanCooldownSeconds: cfg.scanCooldownSeconds,
            businessType: detail.businessType || "autre",
            thresholds: cfg.thresholds,
            address: detail.address,
            loyaltyType: program.type,
            milestones,
            tiers,
          }}
        />

        <div className="h-fit rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
          <h2 className="mb-1 font-bold text-onyx">Lien d&apos;enrôlement</h2>
          <p className="mb-5 text-xs text-galet-ink">
            QR à afficher en boutique. Les clients le scannent pour créer leur carte.
          </p>
          <EnrollmentQR
            url={`${origin}/enroll/${m?.enrollment_token}`}
            fileName={`qr-${detail.shopName.toLowerCase().replace(/\s+/g, "-") || "marchand"}`}
          />
        </div>
      </div>
    </div>
  );
}
