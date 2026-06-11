// Opérations Wallet du panneau super-admin : état des canaux, parc de passes,
// échéance des certificats. Surface ADMIN UNIQUEMENT.
//
// Données réelles uniquement : les échecs d'émission ne sont PAS trackés en
// base aujourd'hui (logs Vercel/Sentry seulement) — la page le dit et propose
// l'instrumentation au lieu d'inventer un chiffre.

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Échéance certificats Apple (platform_settings.apple_cert_expires_at) ───
export interface CertExpiry {
  expiresAt: string | null;
  daysLeft: number | null;
  /** vert > 90 j, orange 30–90 j, rouge < 30 j (renouvellement Apple ~ 1 h, mais le faire à froid). */
  level: "ok" | "bientot" | "urgent" | "inconnu";
}

export function computeCertExpiry(value: unknown, now: Date): CertExpiry {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const raw = typeof v.date === "string" ? v.date : null;
  if (!raw || Number.isNaN(Date.parse(raw))) {
    return { expiresAt: null, daysLeft: null, level: "inconnu" };
  }
  const daysLeft = Math.floor((new Date(raw).getTime() - now.getTime()) / 86400000);
  return {
    expiresAt: raw,
    daysLeft,
    level: daysLeft < 30 ? "urgent" : daysLeft < 90 ? "bientot" : "ok",
  };
}

// ── Parc de passes & appareils ──────────────────────────────────────────────
export interface WalletFleet {
  applePasses: number;
  googlePasses: number;
  appleDevices: number;
  /** Passes mis à jour (pass_updated_at) sur les 7 derniers jours. */
  updatedPasses7d: number;
  /** Notifications wallet envoyées sur les 30 derniers jours. */
  notifications30d: number;
  /** Marchands avec design de carte synchronisé côté Google (classe créée). */
  merchantsWithGoogleClass: number;
  merchantsWithDesign: number;
}

export async function fetchWalletFleet(supabase: SupabaseClient, now: Date): Promise<WalletFleet> {
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [apple, google, devices, updated, notifs, designs, googleClasses] = await Promise.all([
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("pass_type", "apple"),
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("pass_type", "google"),
    supabase.from("wallet_device_registrations").select("id", { count: "exact", head: true }),
    supabase
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .gte("pass_updated_at", since7),
    supabase
      .from("wallet_notifications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30),
    supabase.from("card_designs").select("id", { count: "exact", head: true }),
    supabase.from("card_designs").select("id", { count: "exact", head: true }).not("google_class_id", "is", null),
  ]);

  return {
    applePasses: apple.count ?? 0,
    googlePasses: google.count ?? 0,
    appleDevices: devices.count ?? 0,
    updatedPasses7d: updated.count ?? 0,
    notifications30d: notifs.count ?? 0,
    merchantsWithDesign: designs.count ?? 0,
    merchantsWithGoogleClass: googleClasses.count ?? 0,
  };
}

// ── Dernières notifications wallet (tous marchands) ────────────────────────
export interface WalletNotificationRow {
  id: string;
  merchantId: string;
  shopName: string;
  title: string;
  sentCount: number;
  audience: string;
  createdAt: string;
}

export async function fetchRecentWalletNotifications(
  supabase: SupabaseClient,
  limit = 10
): Promise<WalletNotificationRow[]> {
  const [{ data: notifs, error }, { data: merchants }] = await Promise.all([
    supabase
      .from("wallet_notifications")
      .select("id, merchant_id, title, sent_count, audience, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("merchants").select("id, shop_name"),
  ]);
  if (error) throw error;
  const names = new Map((merchants ?? []).map((m) => [m.id as string, (m.shop_name as string) ?? "—"]));
  return (notifs ?? []).map((n) => ({
    id: n.id as string,
    merchantId: n.merchant_id as string,
    shopName: names.get(n.merchant_id as string) ?? "—",
    title: n.title as string,
    sentCount: (n.sent_count as number) ?? 0,
    audience: (n.audience as string) ?? "all",
    createdAt: n.created_at as string,
  }));
}

// ── Statut publishing Google (platform_settings.google_publishing_status) ──
export interface GooglePublishing {
  status: "en_attente" | "approuve" | "refuse" | "inconnu";
  note: string | null;
}

export function parseGooglePublishing(value: unknown): GooglePublishing {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const raw = typeof v.status === "string" ? v.status : "";
  const status = raw === "en_attente" || raw === "approuve" || raw === "refuse" ? raw : "inconnu";
  return { status, note: typeof v.note === "string" ? v.note : null };
}
