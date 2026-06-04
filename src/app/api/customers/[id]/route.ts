import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateCustomerUpdate } from "@/lib/customers/validate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RGPD — droit à l'oubli. Supprime définitivement un client et toutes ses
// données rattachées (cartes, scans). Les audit_logs gardent une trace
// (FK ON DELETE SET NULL) pour la conformité, sans identifiant client.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(`customer-delete:${user.id}`, 20, 3600000); // 20/hour
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Trop de suppressions. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!merchant) {
      return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, merchant_id")
      .eq("id", id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    if (customer.merchant_id !== merchant.id) {
      return NextResponse.json(
        { error: "Ce client n'appartient pas à votre boutique" },
        { status: 403 }
      );
    }

    // Capture des card_ids AVANT suppression (pour l'audit + la purge RGPD).
    const { data: cards } = await supabaseAdmin
      .from("loyalty_cards")
      .select("id")
      .eq("customer_id", id);
    const cardIds = cards?.map((c) => c.id as string) ?? [];

    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CUSTOMER_DELETED",
      merchant_id: merchant.id,
      user_id: user.id,
      details: {
        customer_id: id,
        card_ids: cardIds,
        reason: "RGPD_ERASURE",
      },
      ...meta,
    });

    // RGPD : purge des tables rattachées NON couvertes par le CASCADE DB
    // (wallet_device_registrations et campaign_sends n'ont pas de FK vers loyalty_cards).
    if (cardIds.length) {
      await supabaseAdmin.from("wallet_device_registrations").delete().in("serial_number", cardIds);
      await supabaseAdmin.from("campaign_sends").delete().in("card_id", cardIds);
    }

    // Suppression définitive. CASCADE: customers → loyalty_cards → scan_history.
    const { error: delError } = await supabaseAdmin
      .from("customers")
      .delete()
      .eq("id", id);

    if (delError) throw delError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer delete error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const rateLimitResult = await rateLimit(`customer-update:${user.id}`, 30, 3600000); // 30/hour
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Trop de modifications. Réessayez plus tard." }, { status: 429 });
    }

    const { data: merchant } = await supabaseAdmin
      .from("merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });

    const { data: customer } = await supabaseAdmin
      .from("customers").select("id, merchant_id").eq("id", id).maybeSingle();
    if (!customer) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    if (customer.merchant_id !== merchant.id) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre boutique" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateCustomerUpdate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (v.value.fullName !== undefined) update.full_name = v.value.fullName;
    if (v.value.email !== undefined) update.email = v.value.email;
    if (v.value.phone !== undefined) update.phone = v.value.phone;

    const { error: updErr } = await supabaseAdmin.from("customers").update(update).eq("id", id);
    if (updErr) {
      if ((updErr as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Email déjà utilisé par un autre client" }, { status: 409 });
      }
      throw updErr;
    }

    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CUSTOMER_UPDATED",
      merchant_id: merchant.id,
      user_id: user.id,
      details: { customer_id: id, fields: Object.keys(update) },
      ...meta,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 });
  }
}
