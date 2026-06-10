import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualStr } from "@/lib/timingSafe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Snapshot mensuel du comptage « cartes actives 90 j » (CGV §6 : calculé le
// 1er jour de chaque mois, fait foi pour la détermination du palier).
// Idempotent : UNIQUE (merchant_id, period) — relancer le cron ne duplique rien.
async function runSnapshot() {
  const { data: counts, error } = await supabaseAdmin
    .from("billing_active_cards")
    .select("merchant_id, plan, active_cards_90d");
  if (error) {
    console.error("billing snapshot read failed:", error.code, error.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const rows = (counts ?? []).map((c) => ({
    merchant_id: c.merchant_id,
    period,
    active_cards_90d: c.active_cards_90d ?? 0,
    plan: c.plan,
  }));

  if (rows.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("billing_snapshots")
      .upsert(rows, { onConflict: "merchant_id,period", ignoreDuplicates: true });
    if (upErr) {
      console.error("billing snapshot write failed:", upErr.code, upErr.message);
      return NextResponse.json({ error: "write_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ period, merchants: rows.length });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Comparaison en temps constant ; fail-closed si CRON_SECRET absent.
  return Boolean(secret && timingSafeEqualStr(req.headers.get("authorization"), `Bearer ${secret}`));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return runSnapshot();
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return runSnapshot();
}
