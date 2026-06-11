import { Wallet, Smartphone, BellRing, RefreshCcw, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
  fetchWalletFleet,
  fetchRecentWalletNotifications,
  computeCertExpiry,
  parseGooglePublishing,
} from "@/lib/admin/walletOps";
import { fetchPlatformSettings } from "@/lib/admin/platform";
import { integrationStatuses } from "@/lib/admin/systemHealth";
import { KpiCard, PageHeader, Pill, Section, EmptyState, formatDateCH } from "../components/ui";

export const dynamic = "force-dynamic";

// Opérations Wallet : état des canaux Apple/Google, parc de passes, mises à
// jour, surveillance d'expiration des certificats, statut publishing Google.
// Données réelles uniquement — ce qui n'est pas tracké est dit tel quel.
export default async function AdminWallet() {
  const supabase = await createClient();
  const now = new Date();

  const [fleet, notifications, settings] = await Promise.all([
    fetchWalletFleet(supabase, now),
    fetchRecentWalletNotifications(supabase),
    fetchPlatformSettings(supabase),
  ]);

  const cert = computeCertExpiry(settings.get("apple_cert_expires_at")?.value, now);
  const publishing = parseGooglePublishing(settings.get("google_publishing_status")?.value);
  const env = integrationStatuses();
  const appleEnv = env.find((e) => e.key === "apple_wallet");
  const googleEnv = env.find((e) => e.key === "google_wallet");

  const certTone = cert.level === "ok" ? "vert" : cert.level === "bientot" ? "orange" : "rouge";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Opérations Wallet"
        subtitle="Les deux canaux du produit : Apple Wallet (production) et Google Wallet (publishing en cours)."
      />

      {/* ── Alerte certificats ───────────────────────────────────────── */}
      <div
        className={`rounded-3xl border p-5 ${
          cert.level === "urgent"
            ? "border-red-500/30 bg-red-500/5"
            : cert.level === "bientot"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-line-warm bg-surface"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className={`h-6 w-6 ${cert.level === "ok" ? "text-emerald-600" : cert.level === "inconnu" ? "text-galet" : "text-amber-600"}`} aria-hidden />
            <div>
              <p className="font-bold text-onyx">Certificats Apple Wallet</p>
              <p className="text-sm text-galet-ink">
                {cert.expiresAt
                  ? `Expirent le ${formatDateCH(cert.expiresAt)} — dans ${cert.daysLeft} jours.`
                  : "Échéance inconnue — renseignez-la dans Réglages plateforme."}
              </p>
            </div>
          </div>
          <Pill tone={cert.level === "inconnu" ? "neutre" : certTone}>
            {cert.level === "ok" && "OK"}
            {cert.level === "bientot" && "À renouveler bientôt"}
            {cert.level === "urgent" && "Renouvellement urgent"}
            {cert.level === "inconnu" && "À renseigner"}
          </Pill>
        </div>
        <p className="mt-3 text-xs text-galet">
          Échéance déclarée dans Réglages plateforme (les fichiers de certs ne sont jamais lus par
          l&apos;app) — mettez-la à jour à chaque renouvellement Apple Developer.
        </p>
      </div>

      {/* ── État des canaux ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title=" Apple Wallet" description="Émission + web service PassKit + push APNs.">
          <div className="space-y-3 text-sm">
            <StatusLine ok={Boolean(appleEnv?.configured)} okText="Émission active sur cet environnement" koText={appleEnv?.missingImpact ?? "Non configuré"} />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Passes Apple" value={fleet.applePasses} />
              <Stat label="Appareils notifiables" value={fleet.appleDevices} />
            </div>
          </div>
        </Section>

        <Section title="Google Wallet" description="Émission OK — mises à jour désactivées tant que le publishing n'est pas accordé.">
          <div className="space-y-3 text-sm">
            <StatusLine
              ok={publishing.status === "approuve"}
              pending={publishing.status === "en_attente"}
              okText="Publishing access accordé"
              pendingText={`Publishing en attente${publishing.note ? ` — ${publishing.note}` : ""}`}
              koText={publishing.status === "refuse" ? "Publishing refusé — voir le dossier de validation" : "Statut inconnu — à renseigner dans Réglages"}
            />
            <StatusLine
              ok={Boolean(googleEnv?.configured)}
              okText="Bouton client Google Wallet visible"
              koText={googleEnv?.missingImpact ?? "Bouton masqué"}
              pendingIsNeutral
            />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Passes Google" value={fleet.googlePasses} />
              <Stat label="Classes synchronisées" value={`${fleet.merchantsWithGoogleClass} / ${fleet.merchantsWithDesign}`} hint="marchands avec design" />
            </div>
          </div>
        </Section>
      </div>

      {/* ── Parc & jobs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard name="Passes au total" value={fleet.applePasses + fleet.googlePasses} icon={Wallet} />
        <KpiCard name="Appareils enregistrés" value={fleet.appleDevices} hint="récepteurs de push APNs" icon={Smartphone} color="text-blue-600" />
        <KpiCard name="Passes mis à jour (7 j)" value={fleet.updatedPasses7d} hint="pass_updated_at — scans, campagnes, design" icon={RefreshCcw} color="text-emerald-600" />
        <KpiCard name="Notifications wallet (30 j)" value={fleet.notifications30d} icon={BellRing} color="text-amber-600" />
      </div>

      {/* ── Dernières notifications ──────────────────────────────────── */}
      <Section title="Dernières notifications wallet" description="Pushs envoyés sur les cartes (campagnes et messages manuels), tous marchands.">
        {notifications.length === 0 ? (
          <EmptyState title="Aucune notification envoyée pour l'instant." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line-warm">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
                  <th className="px-4 py-2.5">Marchand</th>
                  <th className="px-4 py-2.5">Titre</th>
                  <th className="px-4 py-2.5">Audience</th>
                  <th className="px-4 py-2.5">Envoyés</th>
                  <th className="px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} className="border-b border-line-warm last:border-0">
                    <td className="px-4 py-2.5 font-medium text-onyx">{n.shopName}</td>
                    <td className="max-w-[240px] truncate px-4 py-2.5 text-galet-ink" title={n.title}>
                      {n.title}
                    </td>
                    <td className="px-4 py-2.5 text-galet-ink">{n.audience}</td>
                    <td className="px-4 py-2.5 tabular-nums text-onyx">{n.sentCount}</td>
                    <td className="px-4 py-2.5 text-galet-ink">{formatDateCH(n.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Honnêteté instrumentale ──────────────────────────────────── */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden /> Échecs d&apos;émission — non trackés
          </span>
        }
      >
        <p className="text-sm leading-relaxed text-galet-ink">
          Les échecs d&apos;émission de passes ne sont pas enregistrés en base aujourd&apos;hui (visibles
          uniquement dans les logs Vercel, et dans Sentry une fois le DSN posé). Instrumentation
          proposée : une action d&apos;audit <code className="rounded bg-calcaire px-1">PASS_ISSUE_FAILED</code>{" "}
          émise dans les routes generate-apple-pass / generate-google-pass (avec migration jumelle du
          CHECK — invariant n°1), puis un compteur sur cette page. Noté comme dépendance dans
          AGENT-B-MANIFESTE.md.
        </p>
      </Section>
    </div>
  );
}

function StatusLine({
  ok,
  pending = false,
  okText,
  pendingText,
  koText,
  pendingIsNeutral = false,
}: {
  ok: boolean;
  pending?: boolean;
  okText: string;
  pendingText?: string;
  koText: string;
  pendingIsNeutral?: boolean;
}) {
  const Icon = ok ? ShieldCheck : pending ? Clock : AlertTriangle;
  const tone = ok ? "text-emerald-600" : pending || pendingIsNeutral ? "text-amber-600" : "text-red-600";
  return (
    <p className={`flex items-start gap-2 font-medium ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {ok ? okText : pending ? pendingText : koText}
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line-warm bg-calcaire p-3">
      <div className="text-lg font-bold tabular-nums text-onyx">{value}</div>
      <div className="text-xs text-galet-ink">{label}</div>
      {hint && <div className="text-[10px] text-galet">{hint}</div>}
    </div>
  );
}
