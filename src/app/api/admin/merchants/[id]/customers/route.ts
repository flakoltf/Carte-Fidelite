import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;

// GET /api/admin/merchants/[id]/customers — données personnelles des clients
// finaux d'UN marchand. nLPD : accès minimisé (pagination, pas de dump global),
// déclenché explicitement depuis l'UI, TOUJOURS audité ADMIN_CUSTOMER_DATA_ACCESSED.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const url = new URL(req.url);
    const rawPage = Number(url.searchParams.get("page"));
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, role, shop_name")
      .eq("id", id)
      .maybeSingle();
    if (!merchant || merchant.role !== "merchant") {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    const from = (page - 1) * PAGE_SIZE;
    // Invariant n°3 : service-role TOUJOURS filtré sur le tenant.
    const [{ data: customers, error, count }, { data: cards }] = await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id, full_name, email, phone, created_at", { count: "exact" })
        .eq("merchant_id", id)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
      supabaseAdmin
        .from("loyalty_cards")
        .select("customer_id, stamps_count, last_scan, pass_type")
        .eq("merchant_id", id),
    ]);
    if (error) {
      return NextResponse.json({ error: "Lecture échouée" }, { status: 500 });
    }

    const cardByCustomer = new Map((cards ?? []).map((c) => [c.customer_id as string, c]));
    const rows = (customers ?? []).map((c) => {
      const card = cardByCustomer.get(c.id as string);
      return {
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        phone: c.phone,
        createdAt: c.created_at,
        stamps: (card?.stamps_count as number) ?? null,
        lastScanAt: (card?.last_scan as string) ?? null,
        passType: (card?.pass_type as string) ?? null,
      };
    });

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "ADMIN_CUSTOMER_DATA_ACCESSED",
      merchant_id: id,
      user_id: userId ?? undefined,
      details: { shop_name: merchant.shop_name, page, rows: rows.length },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({
      rows,
      total: count ?? 0,
      page,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    });
  } catch (error) {
    console.error("Admin customers read error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
