import { Activity, CheckCircle2, XCircle, Clock, Database, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchCronRuns, computeCronHealth, integrationStatuses, computeBackupStatus } from "@/lib/admin/systemHealth";
import { fetchTechHealth } from "@/lib/admin/overview";
import { fetchPlatformSettings } from "@/lib/admin/platform";
import { PageHeader, Pill, Section, EmptyState, formatDateCH } from "../components/ui";

export const dynamic = "force-dynamic";

// Santé technique : crons (avec historique réel via cron_runs), intégrations,
// audit log, backups. Données réelles uniquement — ce qui n'existe pas encore
// est affiché comme tel, avec le geste qui l'active.
export default async function AdminSystem() {
  const supabase = await createClient();
  const now = new Date();

  const [runs, tech, settings] = await Promise.all([
    fetchCronRuns(supabase),
    fetchTechHealth(supabase, now),
    fetchPlatformSettings(supabase),
  ]);

  const cronHealth = computeCronHealth(runs, now);
  const integrations = integrationStatuses();
  const backup = computeBackupStatus(settings.get("db_backup")?.value, now);

  const CRON_TONE = {
    ok: { tone: "vert" as const, label: "OK" },
    en_retard: { tone: "orange" as const, label: "En retard" },
    erreur: { tone: "rouge" as const, label: "Erreur" },
    jamais_execute: { tone: "neutre" as const, label: "Jamais exécuté" },
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Santé technique"
        subtitle="Crons, intégrations, audit, backups — l'état réel de la machine, sans angle mort."
      />

      {/* ── Crons ────────────────────────────────────────────────────── */}
      <Section
        title="Jobs planifiés (Vercel Cron)"
        description="Chaque exécution est tracée dans cron_runs depuis cette branche — avant elle, seule l'empreinte des effets (snapshots) existait."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {cronHealth.map((c) => (
            <div key={c.job} className="rounded-2xl border border-line-warm bg-calcaire p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-onyx">{c.label}</p>
                  <p className="text-xs text-galet-ink">
                    /api/cron/{c.job} — {c.scheduleLabel}
                  </p>
                </div>
                <Pill tone={CRON_TONE[c.state].tone}>{CRON_TONE[c.state].label}</Pill>
              </div>
              <p className="mt-2 text-xs text-galet-ink">
                {c.lastRun
                  ? `Dernier passage : ${formatDateCH(c.lastRun.startedAt, true)} (${c.lastRun.status})`
                  : "Aucun passage tracé — normal si la migration cron_runs vient d'être posée."}
                {c.lastRun?.details && Object.keys(c.lastRun.details).length > 0 && (
                  <span className="ml-1 text-galet">{JSON.stringify(c.lastRun.details)}</span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-onyx">Historique récent</h3>
          {runs.length === 0 ? (
            <EmptyState title="Pas encore d'exécution tracée.">
              L&apos;historique se remplit au premier passage des crons après application de la
              migration cron_runs. En attendant, le snapshot billing reste vérifiable ci-dessous.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line-warm">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
                    <th className="px-4 py-2.5">Job</th>
                    <th className="px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5">Début</th>
                    <th className="px-4 py-2.5">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b border-line-warm last:border-0">
                      <td className="px-4 py-2.5 font-medium text-onyx">{r.job}</td>
                      <td className="px-4 py-2.5">
                        {r.status === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> ok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <XCircle className="h-3.5 w-3.5" aria-hidden /> erreur
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-galet-ink">{formatDateCH(r.startedAt, true)}</td>
                      <td className="max-w-[260px] truncate px-4 py-2.5 text-xs text-galet" title={JSON.stringify(r.details)}>
                        {JSON.stringify(r.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 rounded-2xl border border-line-warm bg-calcaire p-3 text-xs text-galet-ink">
          Vérification croisée : dernier snapshot billing ={" "}
          <span className="font-semibold text-onyx">
            {tech.lastSnapshot ? `${tech.lastSnapshot.period} (${tech.lastSnapshot.merchants} marchands)` : "jamais"}
          </span>
          {tech.snapshotCurrentMonthOk ? " — le mois courant est couvert." : " — le mois courant n'est pas encore figé."}
        </p>
      </Section>

      {/* ── Intégrations ─────────────────────────────────────────────── */}
      <Section title="Intégrations" description="Présence des variables d'environnement (jamais leurs valeurs).">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {integrations.map((i) => (
            <div key={i.key} className="rounded-2xl border border-line-warm bg-calcaire p-4">
              <div className={`flex items-center gap-2 font-bold ${i.configured ? "text-emerald-600" : "text-red-600"}`}>
                {i.configured ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0" aria-hidden />}
                {i.label}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-galet-ink">
                {i.configured ? "Configuré sur cet environnement." : i.missingImpact}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Audit log & backups ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-halo" aria-hidden /> Santé de l&apos;audit log
            </span>
          }
        >
          <div className="space-y-2 text-sm text-galet-ink">
            <p>
              <span className="font-bold text-onyx">{tech.audit.count24h}</span> événements sur 24 h — dernier :{" "}
              <span className="font-medium text-onyx">{tech.audit.lastAction ?? "aucun"}</span>
              {tech.audit.lastAt ? ` (${formatDateCH(tech.audit.lastAt, true)})` : ""}.
            </p>
            <p className="text-xs">
              Piège connu : une action absente du CHECK est rejetée en silence — le test
              auditActionsSync échoue à la CI si la liste du code et la migration divergent
              (invariant n°1).
            </p>
          </div>
        </Section>

        <Section
          title={
            <span className="flex items-center gap-2">
              <Database className="h-5 w-5 text-halo" aria-hidden /> Backups base de données
            </span>
          }
        >
          {backup.lastVerifiedAt ? (
            <div className="space-y-2 text-sm">
              <p className={`flex items-center gap-2 font-bold ${backup.fresh ? "text-emerald-600" : "text-amber-600"}`}>
                {backup.fresh ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                Dernier dump vérifié : {formatDateCH(backup.lastVerifiedAt, true)}
              </p>
              {!backup.fresh && <p className="text-xs text-galet-ink">Plus de 7 jours — refaire un dump + test de restauration.</p>}
              {backup.note && <p className="text-xs text-galet-ink">{backup.note}</p>}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-bold text-red-600">
                <XCircle className="h-4 w-4" aria-hidden /> Aucun backup vérifié
              </p>
              <p className="text-xs leading-relaxed text-galet-ink">
                Constat de l&apos;audit 360° : aucune sauvegarde garantie. Après chaque dump vérifié
                (pg_dump + restauration de test), attestez-le dans Réglages plateforme — la date
                s&apos;affichera ici et virera à l&apos;orange après 7 jours.
              </p>
            </div>
          )}
        </Section>
      </div>

      {/* ── Garde-fous testés ────────────────────────────────────────── */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-halo" aria-hidden /> Garde-fous vérifiés par la CI
          </span>
        }
        description="Tests statiques qui échouent à la CI si un invariant est violé — la liste vivante est dans le code."
      >
        <ul className="space-y-2 text-sm text-galet-ink">
          <li>• Chaque route /api/admin/* appelle requireAdminApi (fail-closed) — surfaceGuards.test.ts</li>
          <li>• Le layout /admin pose requireAdminPage pour toutes les pages — surfaceGuards.test.ts</li>
          <li>• La couche cross-tenant lib/admin n&apos;est importée que par la surface admin — surfaceGuards.test.ts</li>
          <li>• Toute AuditAction figure dans le CHECK SQL le plus récent — auditActionsSync.test.ts</li>
          <li>• Les gardes 401/403 de requireAdminApi/requireAdminPage sont testées unitairement — adminAuth.test.ts</li>
        </ul>
        <p className="mt-3 text-xs text-galet">
          Lancer localement : <code className="rounded bg-calcaire px-1">npx vitest run</code> — statut RLS réel : politiques
          dans supabase/migrations, vérifiées à chaque audit.
        </p>
      </Section>
    </div>
  );
}
