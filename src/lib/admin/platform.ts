// Réglages plateforme & feature flags — accès données du panneau admin.
// Surface ADMIN UNIQUEMENT. Lecture via client RLS (policies is_admin()),
// écriture via les routes /api/admin/* (service-role + audit).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}

export async function fetchFeatureFlags(supabase: SupabaseClient): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled, description, updated_at, updated_by")
    .order("key");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    key: f.key as string,
    enabled: Boolean(f.enabled),
    description: (f.description as string) ?? "",
    updatedAt: f.updated_at as string,
    updatedBy: (f.updated_by as string) ?? null,
  }));
}

export interface PlatformSetting {
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

export async function fetchPlatformSettings(supabase: SupabaseClient): Promise<Map<string, PlatformSetting>> {
  const { data, error } = await supabase.from("platform_settings").select("key, value, updated_at");
  if (error) throw error;
  return new Map(
    (data ?? []).map((s) => [
      s.key as string,
      {
        key: s.key as string,
        value: (s.value as Record<string, unknown>) ?? {},
        updatedAt: s.updated_at as string,
      },
    ])
  );
}

// ── Comptes super-admin (merchants.role = 'admin') ──────────────────────────
export interface AdminAccount {
  id: string;
  email: string | null;
  shopName: string | null;
  createdAt: string;
}

export async function fetchAdminAccounts(supabase: SupabaseClient): Promise<AdminAccount[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, email, shop_name, created_at")
    .eq("role", "admin")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id as string,
    email: (a.email as string) ?? null,
    shopName: (a.shop_name as string) ?? null,
    createdAt: a.created_at as string,
  }));
}

// ── Validations des écritures (pures, testées) ──────────────────────────────
const KEY_RE = /^[a-z0-9_.-]{2,64}$/;

export type FlagPatchResult =
  | { ok: true; value: { key: string; enabled: boolean; description: string | null } }
  | { ok: false; error: string };

export function validateFlagPatch(body: unknown): FlagPatchResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Corps de requête invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.key !== "string" || !KEY_RE.test(b.key)) {
    return { ok: false, error: "Clé de flag invalide (a-z, 0-9, _ . -, 2–64 caractères)" };
  }
  if (typeof b.enabled !== "boolean") return { ok: false, error: "enabled doit être un booléen" };
  const description =
    b.description === undefined
      ? null
      : typeof b.description === "string" && b.description.length <= 300
        ? b.description
        : undefined;
  if (description === undefined) return { ok: false, error: "Description invalide (300 caractères max)" };
  return { ok: true, value: { key: b.key, enabled: b.enabled, description } };
}

export type SettingPatchResult =
  | { ok: true; value: { key: string; value: Record<string, unknown> } }
  | { ok: false; error: string };

/** Clés modifiables depuis l'UI — liste fermée : pas de réglage arbitraire. */
export const EDITABLE_SETTINGS = ["apple_cert_expires_at", "google_publishing_status", "db_backup"] as const;

export function validateSettingPatch(body: unknown): SettingPatchResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Corps de requête invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.key !== "string" || !(EDITABLE_SETTINGS as readonly string[]).includes(b.key)) {
    return { ok: false, error: "Réglage inconnu ou non modifiable" };
  }
  if (typeof b.value !== "object" || b.value === null || Array.isArray(b.value)) {
    return { ok: false, error: "La valeur doit être un objet JSON" };
  }
  if (JSON.stringify(b.value).length > 2000) {
    return { ok: false, error: "Valeur trop longue (2000 caractères max)" };
  }
  return { ok: true, value: { key: b.key, value: b.value as Record<string, unknown> } };
}
