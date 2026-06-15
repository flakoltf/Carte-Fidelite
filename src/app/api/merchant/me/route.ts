import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
// Dépend de la session + du cookie d'impersonation : jamais mis en cache (sinon
// une réponse d'un autre contexte/marchand pourrait être resservie).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const merchantId = await currentMerchantId();
    if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
    const { data } = await supabaseAdmin
      .from("merchants")
      .select("id, shop_name, email, slug, primary_color, logo_url, address, stamp_goal, latitude, longitude, reward_label, business_hours, phone")
      .eq("id", merchantId)
      .maybeSingle();
    return NextResponse.json({ merchant: data });
  } catch (e) {
    // Jamais de throw nu (→ 500 HTML opaque) : réponse JSON stable que le client
    // sait distinguer d'un 401 et d'un marchand vide.
    console.error("GET /api/merchant/me a échoué :", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  const src = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  for (const field of ["shop_name", "primary_color", "logo_url"] as const) {
    if (field in src) {
      if (typeof src[field] !== "string") {
        return NextResponse.json({ error: `${field} doit être une chaîne` }, { status: 400 });
      }
      updates[field] = src[field] as string;
    }
  }

  // Identité commerce (Feature 1) — champs poussés sur la carte wallet.
  let identityTouched = false;
  if ("reward_label" in src) {
    const raw = src.reward_label;
    if (raw === null || raw === "") {
      updates.reward_label = null;
    } else if (typeof raw === "string" && raw.trim().length >= 1 && raw.trim().length <= 80) {
      updates.reward_label = raw.trim();
    } else {
      return NextResponse.json({ error: "reward_label : 1 à 80 caractères" }, { status: 400 });
    }
    identityTouched = true;
  }
  if ("business_hours" in src) {
    const { normalizeBusinessHours } = await import("@/lib/merchant-config/hours");
    updates.business_hours = normalizeBusinessHours(src.business_hours);
    identityTouched = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "aucun champ à mettre à jour" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("merchants")
    .update(updates)
    .eq("id", merchantId);

  if (error) {
    return NextResponse.json({ error: "échec de la mise à jour" }, { status: 500 });
  }

  // Rafraîchit les cartes en circulation pour refléter la nouvelle identité.
  // Best-effort : un échec de push ne fait pas échouer l'enregistrement.
  if (identityTouched) {
    try {
      const { refreshMerchantPasses } = await import("@/lib/wallet/refresh");
      await refreshMerchantPasses(merchantId);
    } catch (e) {
      console.error("refreshMerchantPasses (identité) a échoué :", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true });
}
