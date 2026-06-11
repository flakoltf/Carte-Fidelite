import { CheckCircle2, XCircle, Flag, UserCog } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { BILLING_PLANS, type PlanKey } from "@/lib/billing/usage";
import { fetchFeatureFlags, fetchPlatformSettings, fetchAdminAccounts } from "@/lib/admin/platform";
import { integrationStatuses } from "@/lib/admin/systemHealth";
import { parseGooglePublishing } from "@/lib/admin/walletOps";
import { PageHeader, Section, formatDateCH } from "../components/ui";
import FlagsManager from "./FlagsManager";
import { CertExpiryEditor, GooglePublishingEditor, BackupAttestation } from "./SettingsEditors";

export const dynamic = "force-dynamic";

// Réglages plateforme : grille canonique (lecture seule — source de vérité en
// code), feature flags, réglages opérationnels, comptes super-admin.
export default async function AdminSettings() {
  const supabase = await createClient();

  const [flags, settings, admins] = await Promise.all([
    fetchFeatureFlags(supabase),
    fetchPlatformSettings(supabase),
    fetchAdminAccounts(supabase),
  ]);

  const certValue = settings.get("apple_cert_expires_at")?.value;
  const certDate = typeof certValue?.date === "string" ? certValue.date : null;
  const publishing = parseGooglePublishing(settings.get("google_publishing_status")?.value);
  const backupValue = settings.get("db_backup")?.value;
  const backupAt = typeof backupValue?.last_verified_at === "string" ? backupValue.last_verified_at : null;
  const envGates = integrationStatuses();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Réglages plateforme"
        subtitle="Grille tarifaire canonique, feature flags, réglages opérationnels et comptes super-admin."
      />

      {/* ── Grille tarifaire ─────────────────────────────────────────── */}
      <Section
        title="Grille tarifaire canonique"
        description="Source de vérité : BILLING_PLANS (src/lib/billing/usage.ts) — modifiable uniquement par le code, pour qu'aucun autre chiffre ne réapparaisse (règle CLAUDE.md)."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(BILLING_PLANS) as PlanKey[]).map((p) => (
            <div key={p} className={`rounded-2xl border p-4 ${p === "croissance" ? "border-halo/40 bg-halo/5" : "border-line-warm bg-calcaire"}`}>
              <div className="text-sm font-bold text-onyx">{BILLING_PLANS[p].label}</div>
              <div className="mt-1 text-2xl font-bold text-onyx">
                {BILLING_PLANS[p].priceChf !== null ? `${BILLING_PLANS[p].priceChf} CHF` : "Sur devis"}
              </div>
              <div className="text-xs text-galet-ink">
                {BILLING_PLANS[p].cap !== null ? `${BILLING_PLANS[p].cap} cartes actives incluses` : "plafond sur mesure"}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-galet">
          Toutes fonctionnalités incluses, sans setup, sans engagement — « carte active » = activité
          dans les 90 derniers jours (CGV §1).
        </p>
      </Section>

      {/* ── Feature flags ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={
            <span className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-halo" aria-hidden /> Feature flags (base)
            </span>
          }
          description="Bascule confirmée + auditée. Source de vérité pour le code applicatif qui les lit."
        >
          <FlagsManager flags={flags} />
        </Section>

        <Section
          title="Gates par variable d'environnement"
          description="Lecture seule — se changent sur Vercel (env vars), jamais depuis cette console."
        >
          <ul className="space-y-2.5">
            {envGates.map((g) => (
              <li key={g.key} className="flex items-start justify-between gap-3 rounded-2xl border border-line-warm bg-calcaire p-3.5">
                <div>
                  <p className="text-sm font-bold text-onyx">{g.label}</p>
                  {!g.configured && <p className="mt-0.5 text-xs text-galet-ink">{g.missingImpact}</p>}
                </div>
                {g.configured ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* ── Réglages opérationnels ───────────────────────────────────── */}
      <Section
        title="Réglages opérationnels"
        description="Faits suivis manuellement (liste fermée) — chaque modification est auditée PLATFORM_SETTING_UPDATED."
      >
        <div className="space-y-6">
          <CertExpiryEditor current={certDate} />
          <div className="border-t border-line-warm pt-5">
            <GooglePublishingEditor current={publishing.status === "inconnu" ? "en_attente" : publishing.status} note={publishing.note} />
          </div>
          <div className="border-t border-line-warm pt-5">
            <BackupAttestation lastVerifiedAt={backupAt} />
          </div>
        </div>
      </Section>

      {/* ── Comptes super-admin ──────────────────────────────────────── */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-halo" aria-hidden /> Comptes super-admin
          </span>
        }
        description="Rôle 'admin' dans merchants — accès cross-tenant complet, MFA exigée par le proxy."
      >
        {admins.length === 0 ? (
          <p className="text-sm text-red-700">Aucun compte admin trouvé — état anormal, vérifier la base.</p>
        ) : (
          <ul className="space-y-2.5">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line-warm bg-calcaire p-4">
                <div>
                  <p className="text-sm font-bold text-onyx">{a.email ?? "—"}</p>
                  <p className="text-xs text-galet-ink">{a.shopName ?? "Compte fondateur"} · depuis le {formatDateCH(a.createdAt)}</p>
                </div>
                <span className="rounded-full bg-halo/10 px-2.5 py-1 text-xs font-bold text-halo">admin</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-galet">
          Par sécurité, la promotion/révocation d&apos;un admin ne se fait pas en un clic depuis cette
          console : c&apos;est une opération en base (UPDATE merchants.role), volontairement hors UI —
          décision documentée dans AGENT-B-MANIFESTE.md.
        </p>
      </Section>
    </div>
  );
}
