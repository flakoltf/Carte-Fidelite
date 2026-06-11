// Table de pilotage des marchands (/admin/merchants) — fetch + modèle riche.
// Surface ADMIN UNIQUEMENT (gate requireAdminPage). Calculs purs dans
// merchantsListCompute.ts (testés sans réseau).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePlan } from "@/lib/billing/usage";
import { effectiveCap, merchantAdminStatus } from "./merchantControls";
import { isDemoMerchant } from "./overviewCompute";
import type { MerchantTableRow } from "./merchantsListCompute";

export async function fetchMerchantTableRows(supabase: SupabaseClient): Promise<MerchantTableRow[]> {
  const [{ data: merchants, error: mErr }, { data: health, error: hErr }, { data: usage }, { data: pinned }] =
    await Promise.all([
      supabase
        .from("merchants")
        .select(
          "id, shop_name, email, role, plan, business_type, address, created_at, managed_by_concierge, suspended_at, plan_cap_override, slug"
        )
        .eq("role", "merchant"),
      // Vue cross-tenant REVOKE anon/authenticated → service-role (lecture seule).
      supabaseAdmin
        .from("merchant_health")
        .select("merchant_id, health_score, statut, scans_30j, cartes_actives_90j, cartes_total, dernier_scan"),
      supabase.from("billing_active_cards").select("merchant_id, active_cards_90d"),
      supabase.from("admin_notes").select("merchant_id").eq("pinned", true).not("merchant_id", "is", null),
    ]);
  if (mErr || hErr) throw mErr ?? hErr;

  const healthById = new Map((health ?? []).map((h) => [h.merchant_id as string, h]));
  const usageById = new Map((usage ?? []).map((u) => [u.merchant_id as string, (u.active_cards_90d as number) ?? 0]));
  const flagged = new Set((pinned ?? []).map((n) => n.merchant_id as string));

  return (merchants ?? []).map((m) => {
    const h = healthById.get(m.id as string);
    const plan = normalizePlan(m.plan);
    const capOverride = (m.plan_cap_override as number) ?? null;
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
      plan,
      cap: effectiveCap(plan, capOverride),
      capOverride,
      activeCards90: usageById.get(m.id as string) ?? (h?.cartes_actives_90j as number) ?? 0,
      cardsTotal: (h?.cartes_total as number) ?? 0,
      scans30d: (h?.scans_30j as number) ?? 0,
      lastScanAt: (h?.dernier_scan as string) ?? null,
      healthScore: (h?.health_score as number) ?? null,
      healthStatus: (h?.statut as MerchantTableRow["healthStatus"]) ?? null,
      flaggedForFollowup: flagged.has(m.id as string),
      isDemo: isDemoMerchant((m.email as string) ?? null),
    } satisfies MerchantTableRow;
  });
}
