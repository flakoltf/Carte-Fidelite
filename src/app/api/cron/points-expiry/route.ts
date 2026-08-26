import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualStr } from "@/lib/timingSafe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";
import { recordCronRun } from "@/lib/cron/recordRun";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { pointsCycleExpired } from "@/lib/loyalty/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Expiration des cycles de points (spec 2026-08-26) : quotidien, idempotent
// (une carte remise à zéro a points_cycle_started_at = null → jamais re-touchée
// tant qu'elle n'a pas repris un nouveau cycle via un scan).
async function run(): Promise<NextResponse> {
  const startedAt = new Date();
  let reset = 0;
  try {
    const { data: merchants } = await supabaseAdmin
      .from("merchants")
      .select("id, loyalty_type, loyalty_config, stamp_goal")
      .eq("loyalty_type", "points");

    for (const m of merchants ?? []) {
      const program = resolveLoyaltyProgram(m);
      if (program.type !== "points" || !program.config.expiration || program.config.expiration.type === "none") continue;

      const { data: cards } = await supabaseAdmin
        .from("loyalty_cards")
        .select("id, points_balance, points_cycle_started_at")
        .eq("merchant_id", m.id) // invariant 3 : tenancy explicite
        .not("points_cycle_started_at", "is", null);

      const now = new Date();
      const expired = (cards ?? []).filter((c) =>
        pointsCycleExpired(program.config.expiration, c.points_cycle_started_at ? new Date(c.points_cycle_started_at) : null, now)
      );

      for (const c of expired) {
        const { error } = await supabaseAdmin
          .from("loyalty_cards")
          .update({ points_balance: 0, redeemed_tiers: [], points_cycle_started_at: null })
          .eq("id", c.id)
          .eq("merchant_id", m.id); // double filtre tenancy sur l'update
        if (error) {
          console.error("[points-expiry] reset failed:", c.id, error.code, error.message);
          continue;
        }
        reset++;
        await logAuditEvent({
          action: "POINTS_EXPIRED",
          merchant_id: m.id,
          card_id: c.id,
          details: { previous_balance: c.points_balance, expiration: program.config.expiration },
        });
      }

      if (expired.length > 0) {
        // Refresh silencieux des passes concernés (best-effort, sans message —
        // même pattern que scan/revert et geo/applyLocation).
        try {
          const { getChannels } = await import("@/lib/wallet/channel");
          for (const ch of getChannels()) await ch.notify(expired.map((c) => c.id));
        } catch (e) {
          console.error("[points-expiry] push failed:", e);
        }
      }
    }

    await recordCronRun({ job: "points-expiry", status: "ok", startedAt, details: { reset } });
    return NextResponse.json({ ok: true, reset });
  } catch (e) {
    console.error("[points-expiry]", e);
    await recordCronRun({ job: "points-expiry", status: "error", startedAt, details: { reset } });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Comparaison en temps constant ; fail-closed si CRON_SECRET absent.
  if (!secret || !timingSafeEqualStr(req.headers.get("authorization"), `Bearer ${secret}`))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run();
}

// Vercel Cron déclenche en GET ; on délègue à la même logique.
export async function GET(req: NextRequest) {
  return POST(req);
}
