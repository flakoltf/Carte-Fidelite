// Facturation & abonnements — accès données + calculs purs du panneau admin.
// Surface ADMIN UNIQUEMENT (gate requireAdminPage/requireAdminApi).

import type { SupabaseClient } from "@supabase/supabase-js";
import { BILLING_PLANS, normalizePlan, NEAR_THRESHOLD, type PlanKey } from "@/lib/billing/usage";
import { effectiveCap } from "./merchantControls";
import { isDemoMerchant } from "./overviewCompute";

export interface BillingRow {
  merchantId: string;
  shopName: string;
  email: string | null;
  plan: PlanKey;
  planStartedAt: string | null;
  billingCycle: "monthly" | "annual";
  launchPartner: boolean;
  trialEndsAt: string | null;
  trialActive: boolean;
  suspendedAt: string | null;
  capOverride: number | null;
  /** Plafond effectif : override manuel sinon plafond du palier. */
  cap: number | null;
  activeCards90: number;
  /** ok / near (≥ 80 %) / over (> 100 %) / uncapped. */
  usageState: "ok" | "near" | "over" | "uncapped";
  /** Prix mensuel du palier — null pour custom (sur devis). */
  priceChf: number | null;
  isDemo: boolean;
}

export function computeUsageState(activeCards: number, cap: number | null): BillingRow["usageState"] {
  if (cap === null || cap <= 0) return "uncapped";
  const ratio = activeCards / cap;
  if (ratio > 1) return "over";
  if (ratio >= NEAR_THRESHOLD) return "near";
  return "ok";
}

export async function fetchBillingRows(supabase: SupabaseClient, now: Date): Promise<BillingRow[]> {
  const [{ data: merchants, error: mErr }, { data: usage, error: uErr }] = await Promise.all([
    supabase
      .from("merchants")
      .select(
        "id, shop_name, email, role, plan, plan_started_at, billing_cycle, launch_partner, trial_ends_at, suspended_at, plan_cap_override"
      )
      .eq("role", "merchant"),
    supabase.from("billing_active_cards").select("merchant_id, active_cards_90d"),
  ]);
  if (mErr || uErr) throw mErr ?? uErr;

  const usageById = new Map((usage ?? []).map((u) => [u.merchant_id as string, (u.active_cards_90d as number) ?? 0]));

  return (merchants ?? []).map((m) => {
    const plan = normalizePlan(m.plan);
    const capOverride = (m.plan_cap_override as number) ?? null;
    const cap = effectiveCap(plan, capOverride);
    const activeCards90 = usageById.get(m.id as string) ?? 0;
    const trialEndsAt = (m.trial_ends_at as string) ?? null;
    return {
      merchantId: m.id as string,
      shopName: (m.shop_name as string) ?? "—",
      email: (m.email as string) ?? null,
      plan,
      planStartedAt: (m.plan_started_at as string) ?? null,
      billingCycle: m.billing_cycle === "annual" ? "annual" : "monthly",
      launchPartner: Boolean(m.launch_partner),
      trialEndsAt,
      trialActive: Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime()),
      suspendedAt: (m.suspended_at as string) ?? null,
      capOverride,
      cap,
      activeCards90,
      usageState: computeUsageState(activeCards90, cap),
      priceChf: BILLING_PLANS[plan].priceChf,
      isDemo: isDemoMerchant((m.email as string) ?? null),
    } satisfies BillingRow;
  });
}

// ── Répartition par palier (hors démo) ──────────────────────────────────────
export interface PlanDistribution {
  plan: PlanKey;
  label: string;
  count: number;
  mrrChf: number;
}

export function computePlanDistribution(rows: BillingRow[]): PlanDistribution[] {
  const keys = Object.keys(BILLING_PLANS) as PlanKey[];
  return keys.map((plan) => {
    const inPlan = rows.filter((r) => r.plan === plan && !r.isDemo);
    const billable = inPlan.filter((r) => !r.trialActive);
    return {
      plan,
      label: BILLING_PLANS[plan].label,
      count: inPlan.length,
      mrrChf: (BILLING_PLANS[plan].priceChf ?? 0) * billable.length,
    };
  });
}

// ── Historique des snapshots mensuels ───────────────────────────────────────
export interface SnapshotPeriod {
  period: string;
  merchants: number;
  totalActiveCards: number;
}

export async function fetchSnapshotHistory(supabase: SupabaseClient, limit = 12): Promise<SnapshotPeriod[]> {
  const { data, error } = await supabase
    .from("billing_snapshots")
    .select("period, active_cards_90d")
    .order("period", { ascending: false });
  if (error) throw error;

  const byPeriod = new Map<string, { merchants: number; totalActiveCards: number }>();
  for (const s of data ?? []) {
    const key = s.period as string;
    const entry = byPeriod.get(key) ?? { merchants: 0, totalActiveCards: 0 };
    entry.merchants++;
    entry.totalActiveCards += (s.active_cards_90d as number) ?? 0;
    byPeriod.set(key, entry);
  }
  return [...byPeriod.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limit)
    .map(([period, v]) => ({ period, ...v }));
}

/** Snapshots d'UN marchand (page détail). */
export interface MerchantSnapshot {
  period: string;
  activeCards90: number;
  plan: string;
}

export async function fetchMerchantSnapshots(
  supabase: SupabaseClient,
  merchantId: string,
  limit = 12
): Promise<MerchantSnapshot[]> {
  const { data, error } = await supabase
    .from("billing_snapshots")
    .select("period, active_cards_90d, plan")
    .eq("merchant_id", merchantId)
    .order("period", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    period: s.period as string,
    activeCards90: (s.active_cards_90d as number) ?? 0,
    plan: (s.plan as string) ?? "—",
  }));
}
