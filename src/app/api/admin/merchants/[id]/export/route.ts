import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { buildCsv } from "@/lib/admin/csv";
import { UUID_RE } from "@/lib/validation/uuid";

// GET /api/admin/merchants/[id]/export — export CSV des clients + cartes d'UN
// marchand (portabilité / relation concierge). Contient des données
// personnelles → confirmation explicite côté UI + audit DATA_EXPORTED.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, role, shop_name")
      .eq("id", id)
      .maybeSingle();
    if (!merchant || merchant.role !== "merchant") {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    // Invariant n°3 : service-role TOUJOURS filtré sur le tenant.
    const [{ data: customers, error: cErr }, { data: cards, error: lErr }] = await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id, full_name, email, phone, created_at")
        .eq("merchant_id", id)
        .order("created_at"),
      supabaseAdmin
        .from("loyalty_cards")
        .select("customer_id, stamps_count, pass_type, last_scan, created_at")
        .eq("merchant_id", id),
    ]);
    if (cErr || lErr) {
      return NextResponse.json({ error: "Lecture échouée" }, { status: 500 });
    }

    const cardByCustomer = new Map((cards ?? []).map((c) => [c.customer_id as string, c]));
    const csv = buildCsv(
      ["nom", "email", "telephone", "inscrit_le", "tampons", "wallet", "dernier_scan"],
      (customers ?? []).map((c) => {
        const card = cardByCustomer.get(c.id as string);
        return [
          c.full_name,
          c.email,
          c.phone,
          c.created_at,
          card?.stamps_count ?? "",
          card?.pass_type ?? "",
          card?.last_scan ?? "",
        ];
      })
    );

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "DATA_EXPORTED",
      merchant_id: id,
      user_id: userId ?? undefined,
      details: { scope: "merchant_customers_csv", shop_name: merchant.shop_name, rows: customers?.length ?? 0 },
      ...extractRequestMeta(req),
    });

    const slug = (merchant.shop_name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "marchand";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="halo-clients-${slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Admin export error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
