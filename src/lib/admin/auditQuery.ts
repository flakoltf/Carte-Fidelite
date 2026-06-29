// Journal d'audit du panneau super-admin : filtres purs (testés) + fetch.
// Surface ADMIN UNIQUEMENT — la policy RLS audit_logs inclut is_admin(),
// le client RLS suffit donc en lecture.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/auditLog";
import { UUID_RE } from "@/lib/validation/uuid";

// Événements « sensibles » : pouvoir admin, données personnelles, sécurité.
export const SENSITIVE_ACTIONS: readonly AuditAction[] = [
  "ADMIN_IMPERSONATION_START",
  "ADMIN_IMPERSONATION_STOP",
  "MERCHANT_SUSPENDED",
  "MERCHANT_REACTIVATED",
  "MERCHANT_PLAN_CHANGED",
  "MERCHANT_LIMIT_ADJUSTED",
  "MERCHANT_BILLING_UPDATED",
  "MERCHANT_PASSWORD_RESET",
  "ADMIN_CUSTOMER_DATA_ACCESSED",
  "DATA_EXPORTED",
  "CUSTOMER_DELETED",
  "MERCHANT_TOKEN_ROTATED",
  "MFA_DISABLED",
  "FEATURE_FLAG_UPDATED",
  "PLATFORM_SETTING_UPDATED",
  "LOGIN_FAILED",
] as const;

export interface AuditFilters {
  action: AuditAction | null;
  merchantId: string | null;
  sensitiveOnly: boolean;
  /** Jours d'historique (1–365). */
  days: number;
  page: number;
}

export const AUDIT_PAGE_SIZE = 50;

/** Parse les searchParams de la page audit — tolérant, jamais d'exception. */
export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const rawAction = first(params.action);
  const action =
    rawAction && (AUDIT_ACTIONS as readonly string[]).includes(rawAction) ? (rawAction as AuditAction) : null;

  const rawMerchant = first(params.merchant);
  const merchantId = rawMerchant && UUID_RE.test(rawMerchant) ? rawMerchant : null;

  const rawDays = Number(first(params.days));
  const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= 365 ? rawDays : 30;

  const rawPage = Number(first(params.page));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  return { action, merchantId, sensitiveOnly: first(params.sensitive) === "1", days, page };
}

export interface AuditLogRow {
  id: string;
  action: string;
  merchantId: string | null;
  userId: string | null;
  cardId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageCount: number;
}

export async function fetchAuditPage(supabase: SupabaseClient, filters: AuditFilters): Promise<AuditPage> {
  const since = new Date(Date.now() - filters.days * 86400000).toISOString();
  let q = supabase
    .from("audit_logs")
    .select("id, action, merchant_id, user_id, card_id, details, ip_address, user_agent, created_at", {
      count: "exact",
    })
    .gte("created_at", since);

  if (filters.action) q = q.eq("action", filters.action);
  if (filters.merchantId) q = q.eq("merchant_id", filters.merchantId);
  if (filters.sensitiveOnly) q = q.in("action", [...SENSITIVE_ACTIONS]);

  const from = (filters.page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) throw error;

  const total = count ?? 0;
  return {
    rows: (data ?? []).map((r) => ({
      id: r.id as string,
      action: r.action as string,
      merchantId: (r.merchant_id as string) ?? null,
      userId: (r.user_id as string) ?? null,
      cardId: (r.card_id as string) ?? null,
      details: (r.details as Record<string, unknown>) ?? null,
      ipAddress: (r.ip_address as string) ?? null,
      userAgent: (r.user_agent as string) ?? null,
      createdAt: r.created_at as string,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}

// ── Panneau sécurité : compteurs ciblés ─────────────────────────────────────
export interface SecuritySummary {
  failedLogins7d: number;
  impersonations30d: number;
  sensitive30d: number;
  exports30d: number;
}

export async function fetchSecuritySummary(supabase: SupabaseClient, now: Date): Promise<SecuritySummary> {
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [failed, imp, sensitive, exports] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "LOGIN_FAILED")
      .gte("created_at", since7),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "ADMIN_IMPERSONATION_START")
      .gte("created_at", since30),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .in("action", [...SENSITIVE_ACTIONS])
      .gte("created_at", since30),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "DATA_EXPORTED")
      .gte("created_at", since30),
  ]);

  return {
    failedLogins7d: failed.count ?? 0,
    impersonations30d: imp.count ?? 0,
    sensitive30d: sensitive.count ?? 0,
    exports30d: exports.count ?? 0,
  };
}
