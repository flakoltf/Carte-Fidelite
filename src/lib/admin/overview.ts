// Couche d'accès données du dashboard SUPER-ADMIN — cross-tenant par
// conception. À n'importer QUE depuis des pages/routes sous le gate admin
// (layout (app)/admin → requireAdminPage ; API → requireAdminApi) : le test
// adminSurfaceGuard.test.ts vérifie qu'aucun code marchand ne l'importe.
//
// Clients utilisés :
//  - client UTILISATEUR (RLS) pour tout ce que les policies « OR is_admin() »
//    couvrent (merchants, billing_active_cards, leads, billing_snapshots,
//    audit_logs) — un non-admin qui atteindrait ce code ne verrait QUE ses
//    propres lignes, défense en profondeur ;
//  - service-role UNIQUEMENT pour merchant_health (REVOKE anon/authenticated :
//    la vue agrège tous les tenants et reste invisible des comptes marchands).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePlan } from "@/lib/billing/usage";
import { effectiveCap } from "./merchantControls";
import { isDemoMerchant, type HealthRow, type UsageRow } from "./overviewCompute";

// ── Santé marchands : merchant_health (service-role) ⋈ merchants (RLS) ─────
export async function fetchHealthRows(supabase: SupabaseClient): Promise<HealthRow[]> {
  const [{ data: health, error: hErr }, { data: merchants, error: mErr }] = await Promise.all([
    supabaseAdmin
      .from("merchant_health")
      .select(
        "merchant_id, shop_name, merchant_since, cartes_total, cartes_actives_90j, scans_30j, nouveaux_clients_30j, dernier_scan, health_score, statut"
      ),
    supabase.from("merchants").select("id, email, plan, role"),
  ]);
  if (hErr || mErr) throw hErr ?? mErr;

  const byId = new Map((merchants ?? []).map((m) => [m.id as string, m]));
  return (health ?? [])
    .filter((h) => byId.get(h.merchant_id as string)?.role === "merchant")
    .map((h) => {
      const m = byId.get(h.merchant_id as string);
      return {
        merchantId: h.merchant_id as string,
        shopName: (h.shop_name as string) ?? "—",
        email: (m?.email as string) ?? null,
        plan: normalizePlan(m?.plan),
        healthScore: (h.health_score as number) ?? 0,
        statut: (h.statut as HealthRow["statut"]) ?? "rouge",
        scans30j: (h.scans_30j as number) ?? 0,
        cartesActives90j: (h.cartes_actives_90j as number) ?? 0,
        cartesTotal: (h.cartes_total as number) ?? 0,
        nouveauxClients30j: (h.nouveaux_clients_30j as number) ?? 0,
        dernierScan: (h.dernier_scan as string) ?? null,
        merchantSince: (h.merchant_since as string) ?? new Date(0).toISOString(),
        isDemo: isDemoMerchant(m?.email as string | null),
      } satisfies HealthRow;
    });
}

// ── Conso vs plafond : billing_active_cards (security_invoker, RLS admin) ──
// Le plafond retourné est le plafond EFFECTIF : plan_cap_override (ajustement
// manuel admin) prioritaire sur le plafond du palier — sinon les opportunités
// d'upsell de la god-view seraient calculées sur un plafond faux.
export async function fetchUsageRows(supabase: SupabaseClient): Promise<UsageRow[]> {
  const { data, error } = await supabase
    .from("billing_active_cards")
    .select("merchant_id, plan, active_cards_90d, plan_cap");
  if (error) throw error;
  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, shop_name, role, plan_cap_override");
  const byId = new Map((merchants ?? []).map((m) => [m.id as string, m]));
  return (data ?? [])
    .filter((r) => byId.get(r.merchant_id as string)?.role === "merchant")
    .map((r) => {
      const m = byId.get(r.merchant_id as string);
      const plan = normalizePlan(r.plan);
      return {
        merchantId: r.merchant_id as string,
        shopName: (m?.shop_name as string) ?? "—",
        plan,
        activeCards90: (r.active_cards_90d as number) ?? 0,
        planCap: effectiveCap(plan, (m?.plan_cap_override as number | null) ?? null),
      };
    });
}

// ── Croissance : leads + signups ────────────────────────────────────────────
export interface LeadRow {
  id: string;
  businessName: string;
  trade: string | null;
  contact: string;
  plan: string | null;
  createdAt: string;
}

export async function fetchRecentLeads(supabase: SupabaseClient, limit = 8): Promise<LeadRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, business_name, trade, contact, plan, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id as string,
    businessName: l.business_name as string,
    trade: (l.trade as string) ?? null,
    contact: l.contact as string,
    plan: (l.plan as string) ?? null,
    createdAt: l.created_at as string,
  }));
}

export async function fetchLeadCounts(supabase: SupabaseClient, now: Date) {
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [w, m] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since7),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since30),
  ]);
  return { last7d: w.count ?? 0, last30d: m.count ?? 0 };
}

export async function fetchMerchantSignupDates(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("created_at, role")
    .eq("role", "merchant");
  if (error) throw error;
  return (data ?? []).map((m) => m.created_at as string);
}

// ── Santé technique ─────────────────────────────────────────────────────────
export interface TechHealth {
  /** Dernier snapshot billing : period (YYYY-MM-DD) + nb marchands, ou null si jamais tourné. */
  lastSnapshot: { period: string; merchants: number } | null;
  /** Le snapshot du mois courant a-t-il tourné ? */
  snapshotCurrentMonthOk: boolean;
  /** Audit log : dernier événement + volume 24 h (0 prolongé = suspect). */
  audit: { lastAction: string | null; lastAt: string | null; count24h: number };
  sentryConfigured: boolean;
  emailConfigured: boolean;
}

export async function fetchTechHealth(supabase: SupabaseClient, now: Date): Promise<TechHealth> {
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const since24h = new Date(now.getTime() - 86400000).toISOString();

  const [snapRes, snapCountRes, lastAuditRes, auditCountRes] = await Promise.all([
    supabase
      .from("billing_snapshots")
      .select("period")
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("billing_snapshots")
      .select("id", { count: "exact", head: true })
      .order("period", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("action, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h),
  ]);

  let lastSnapshot: TechHealth["lastSnapshot"] = null;
  if (snapRes.data?.period) {
    const { count } = await supabase
      .from("billing_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("period", snapRes.data.period as string);
    lastSnapshot = { period: snapRes.data.period as string, merchants: count ?? snapCountRes.count ?? 0 };
  }

  return {
    lastSnapshot,
    snapshotCurrentMonthOk: lastSnapshot?.period === currentPeriod,
    audit: {
      lastAction: (lastAuditRes.data?.action as string) ?? null,
      lastAt: (lastAuditRes.data?.created_at as string) ?? null,
      count24h: auditCountRes.count ?? 0,
    },
    sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };
}
