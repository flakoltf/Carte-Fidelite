// Détail marchand 360° du panneau super-admin — profil, usage, activité.
// Surface ADMIN UNIQUEMENT (gate requireAdminPage/requireAdminApi).
//
// nLPD : ce module n'expose AUCUNE donnée personnelle de client final — les
// clients sont agrégés. L'accès nominatif passe par /api/admin/merchants/[id]/
// customers, minimisé et audité ADMIN_CUSTOMER_DATA_ACCESSED.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePlan, type PlanKey } from "@/lib/billing/usage";
import { effectiveCap, merchantAdminStatus, type MerchantAdminStatus } from "./merchantControls";

export interface MerchantDetail {
  id: string;
  shopName: string;
  email: string | null;
  slug: string | null;
  businessType: string | null;
  address: string | null;
  createdAt: string;
  managedByConcierge: boolean;
  status: MerchantAdminStatus;
  suspendedAt: string | null;
  suspendedReason: string | null;
  plan: PlanKey;
  planStartedAt: string | null;
  billingCycle: "monthly" | "annual";
  launchPartner: boolean;
  trialEndsAt: string | null;
  capOverride: number | null;
  cap: number | null;
  loyaltyType: string | null;
  stampGoal: number | null;
  primaryColor: string | null;
  userId: string | null;
}

export async function fetchMerchantDetail(
  supabase: SupabaseClient,
  merchantId: string
): Promise<MerchantDetail | null> {
  const { data: m, error } = await supabase
    .from("merchants")
    .select(
      "id, shop_name, email, slug, business_type, address, created_at, managed_by_concierge, suspended_at, suspended_reason, plan, plan_started_at, billing_cycle, launch_partner, trial_ends_at, plan_cap_override, loyalty_type, stamp_goal, primary_color, role, user_id"
    )
    .eq("id", merchantId)
    .maybeSingle();
  if (error) throw error;
  if (!m || m.role !== "merchant") return null;

  const capOverride = (m.plan_cap_override as number) ?? null;
  const plan = normalizePlan(m.plan);
  return {
    id: m.id as string,
    shopName: (m.shop_name as string) ?? "—",
    email: (m.email as string) ?? null,
    slug: (m.slug as string) ?? null,
    businessType: (m.business_type as string) ?? null,
    address: (m.address as string) ?? null,
    createdAt: m.created_at as string,
    managedByConcierge: Boolean(m.managed_by_concierge),
    status: merchantAdminStatus((m.suspended_at as string) ?? null),
    suspendedAt: (m.suspended_at as string) ?? null,
    suspendedReason: (m.suspended_reason as string) ?? null,
    plan,
    planStartedAt: (m.plan_started_at as string) ?? null,
    billingCycle: m.billing_cycle === "annual" ? "annual" : "monthly",
    launchPartner: Boolean(m.launch_partner),
    trialEndsAt: (m.trial_ends_at as string) ?? null,
    capOverride,
    cap: effectiveCap(plan, capOverride),
    loyaltyType: (m.loyalty_type as string) ?? null,
    stampGoal: (m.stamp_goal as number) ?? null,
    primaryColor: (m.primary_color as string) ?? null,
    userId: (m.user_id as string) ?? null,
  };
}

// ── Agrégats d'usage (zéro donnée nominative) ───────────────────────────────
export interface MerchantUsageStats {
  customers: number;
  cards: number;
  activeCards90: number;
  scans30d: number;
  scansTotal: number;
  lastScanAt: string | null;
  appleCards: number;
  googleCards: number;
  registeredDevices: number;
  campaignsActive: number;
  healthScore: number | null;
  healthStatus: "vert" | "orange" | "rouge" | null;
}

export async function fetchMerchantUsageStats(
  supabase: SupabaseClient,
  merchantId: string,
  now: Date
): Promise<MerchantUsageStats> {
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [customers, cards, usage, scans30, scansTotal, lastScan, apple, google, devices, campaigns, health] =
    await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
      supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
      supabase.from("billing_active_cards").select("active_cards_90d").eq("merchant_id", merchantId).maybeSingle(),
      supabase
        .from("scan_history")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .gte("scanned_at", since30),
      supabase.from("scan_history").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
      supabase
        .from("scan_history")
        .select("scanned_at")
        .eq("merchant_id", merchantId)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("loyalty_cards")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .eq("pass_type", "apple"),
      supabase
        .from("loyalty_cards")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .eq("pass_type", "google"),
      supabase
        .from("wallet_device_registrations")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .eq("active", true),
      // merchant_health est REVOKE pour anon/authenticated → service-role,
      // filtré sur CE marchand (invariant n°3).
      supabaseAdmin
        .from("merchant_health")
        .select("health_score, statut")
        .eq("merchant_id", merchantId)
        .maybeSingle(),
    ]);

  return {
    customers: customers.count ?? 0,
    cards: cards.count ?? 0,
    activeCards90: (usage.data?.active_cards_90d as number) ?? 0,
    scans30d: scans30.count ?? 0,
    scansTotal: scansTotal.count ?? 0,
    lastScanAt: (lastScan.data?.scanned_at as string) ?? null,
    appleCards: apple.count ?? 0,
    googleCards: google.count ?? 0,
    registeredDevices: devices.count ?? 0,
    campaignsActive: campaigns.count ?? 0,
    healthScore: (health.data?.health_score as number) ?? null,
    healthStatus: (health.data?.statut as MerchantUsageStats["healthStatus"]) ?? null,
  };
}

// ── Timeline d'activité : audit du marchand + derniers scans agrégés ────────
export interface TimelineEvent {
  id: string;
  kind: "audit" | "scan_day";
  label: string;
  at: string;
  details: Record<string, unknown> | null;
}

export async function fetchMerchantTimeline(
  supabase: SupabaseClient,
  merchantId: string,
  limit = 30
): Promise<TimelineEvent[]> {
  const [{ data: audit, error }, { data: scans }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id, action, details, created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("scan_history")
      .select("scanned_at")
      .eq("merchant_id", merchantId)
      .order("scanned_at", { ascending: false })
      .limit(500),
  ]);
  if (error) throw error;

  // Les scans sont agrégés par jour pour ne pas noyer la timeline.
  const scansByDay = new Map<string, number>();
  for (const s of scans ?? []) {
    const day = (s.scanned_at as string).slice(0, 10);
    scansByDay.set(day, (scansByDay.get(day) ?? 0) + 1);
  }

  const events: TimelineEvent[] = (audit ?? []).map((a) => ({
    id: a.id as string,
    kind: "audit" as const,
    label: a.action as string,
    at: a.created_at as string,
    details: (a.details as Record<string, unknown>) ?? null,
  }));

  for (const [day, count] of [...scansByDay.entries()].slice(0, 14)) {
    events.push({
      id: `scans-${day}`,
      kind: "scan_day",
      label: `${count} scan${count > 1 ? "s" : ""} au comptoir`,
      at: `${day}T23:59:59.000Z`,
      details: null,
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
