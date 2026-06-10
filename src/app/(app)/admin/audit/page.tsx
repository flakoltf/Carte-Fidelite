import Link from "next/link";
import { ShieldAlert, UserCheck, Download, KeySquare } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { AUDIT_ACTIONS } from "@/lib/auditLog";
import {
  parseAuditFilters,
  fetchAuditPage,
  fetchSecuritySummary,
  SENSITIVE_ACTIONS,
  type AuditFilters,
} from "@/lib/admin/auditQuery";
import { KpiCard, PageHeader, Section, EmptyState, formatDateCH } from "../components/ui";

export const dynamic = "force-dynamic";

// Journal d'audit complet : recherchable/filtrable (action, marchand, période,
// sensibles uniquement), paginé. Le journal est immuable (append-only en DB).
export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const now = new Date();
  const filters = parseAuditFilters(await searchParams);

  const [page, summary, { data: merchants }] = await Promise.all([
    fetchAuditPage(supabase, filters),
    fetchSecuritySummary(supabase, now),
    supabase.from("merchants").select("id, shop_name"),
  ]);

  const names = new Map((merchants ?? []).map((m) => [m.id as string, (m.shop_name as string) ?? "—"]));
  const sensitiveSet = new Set<string>(SENSITIVE_ACTIONS);

  const buildHref = (overrides: Partial<AuditFilters>) => {
    const next = { ...filters, ...overrides };
    const params = new URLSearchParams();
    if (next.action) params.set("action", next.action);
    if (next.merchantId) params.set("merchant", next.merchantId);
    if (next.sensitiveOnly) params.set("sensitive", "1");
    if (next.days !== 30) params.set("days", String(next.days));
    if (next.page !== 1) params.set("page", String(next.page));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit & sécurité"
        subtitle="Qui a fait quoi, quand, depuis où — journal immuable (append-only), conservé en base."
      />

      {/* ── Compteurs sécurité ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          name="Connexions échouées (7 j)"
          value={summary.failedLogins7d}
          hint="LOGIN_FAILED — rate-limit Upstash en amont"
          icon={KeySquare}
          color={summary.failedLogins7d > 10 ? "text-red-600" : "text-halo"}
        />
        <KpiCard name="Impersonations (30 j)" value={summary.impersonations30d} hint="mode concierge — toutes tracées" icon={UserCheck} color="text-purple-600" />
        <KpiCard name="Événements sensibles (30 j)" value={summary.sensitive30d} hint="pouvoir admin, données, sécurité" icon={ShieldAlert} color="text-amber-600" />
        <KpiCard name="Exports de données (30 j)" value={summary.exports30d} hint="DATA_EXPORTED — nLPD" icon={Download} color="text-blue-600" />
      </div>

      {/* ── Journal filtrable ────────────────────────────────────────── */}
      <Section
        title="Journal d'audit"
        description={`${page.total} événement${page.total > 1 ? "s" : ""} sur ${filters.days} jours${filters.sensitiveOnly ? " (sensibles uniquement)" : ""}.`}
      >
        <form method="GET" className="mb-5 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-galet-ink">Action</span>
            <select
              name="action"
              defaultValue={filters.action ?? ""}
              className="mt-1 block rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            >
              <option value="">Toutes</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-galet-ink">Marchand</span>
            <select
              name="merchant"
              defaultValue={filters.merchantId ?? ""}
              className="mt-1 block max-w-56 rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            >
              <option value="">Tous</option>
              {[...names.entries()]
                .sort((a, b) => a[1].localeCompare(b[1], "fr"))
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-galet-ink">Période</span>
            <select
              name="days"
              defaultValue={String(filters.days)}
              className="mt-1 block rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            >
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="365">1 an</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-onyx">
            <input type="checkbox" name="sensitive" value="1" defaultChecked={filters.sensitiveOnly} className="h-4 w-4 accent-[#0D6B5E]" />
            Sensibles uniquement
          </label>
          <button
            type="submit"
            className="rounded-xl bg-onyx px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-onyx/80"
          >
            Filtrer
          </button>
        </form>

        {page.rows.length === 0 ? (
          <EmptyState title="Aucun événement pour ces filtres.">
            Élargissez la période ou retirez un filtre — le journal est append-only, rien n&apos;est
            supprimé.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line-warm">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
                  <th className="px-4 py-3">Quand</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Marchand</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Détails</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line-warm last:border-0 hover:bg-calcaire/60">
                    <td className="whitespace-nowrap px-4 py-2.5 text-galet-ink">{formatDateCH(r.createdAt, true)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                          sensitiveSet.has(r.action) ? "bg-amber-500/15 text-amber-700" : "bg-galet/15 text-galet-ink"
                        }`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.merchantId ? (
                        <Link href={`/admin/merchants/${r.merchantId}`} className="font-medium text-onyx hover:text-halo">
                          {names.get(r.merchantId) ?? r.merchantId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-galet">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-galet-ink">{r.ipAddress ?? "—"}</td>
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-xs text-galet" title={r.details ? JSON.stringify(r.details) : ""}>
                      {r.details ? JSON.stringify(r.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page.pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page.page > 1 ? (
              <Link href={buildHref({ page: page.page - 1 })} className="font-medium text-halo hover:underline">
                ← Plus récents
              </Link>
            ) : (
              <span />
            )}
            <span className="text-galet-ink">
              Page {page.page} / {page.pageCount}
            </span>
            {page.page < page.pageCount ? (
              <Link href={buildHref({ page: page.page + 1 })} className="font-medium text-halo hover:underline">
                Plus anciens →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </Section>

      {/* ── Limites connues ──────────────────────────────────────────── */}
      <Section title="Limites connues (honnêteté du panneau)">
        <ul className="space-y-2 text-sm leading-relaxed text-galet-ink">
          <li>
            • <span className="font-semibold text-onyx">Hits de rate-limit</span> : appliqués par Upstash
            (login, enrôlement, scan) mais non journalisés en base — instrumentation proposée : compteur
            d&apos;événements refusés dans audit_logs (action RATE_LIMITED + migration jumelle).
          </li>
          <li>
            • <span className="font-semibold text-onyx">Tentatives MFA échouées</span> : non auditées
            aujourd&apos;hui (constat audit 360°) — même mécanisme proposé.
          </li>
        </ul>
      </Section>
    </div>
  );
}
