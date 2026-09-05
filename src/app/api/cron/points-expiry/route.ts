import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualStr } from "@/lib/timingSafe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, type AuditAction } from "@/lib/auditLog";
import { recordCronRun } from "@/lib/cron/recordRun";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { pointsCycleExpired } from "@/lib/loyalty/points";
import { cycleCardExpired } from "@/lib/loyalty/cycleExpiry";
import type { CycleExpiration } from "@/lib/loyalty/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Expiration des cycles de fidélité — quotidien, idempotent.
// • points (spec 2026-08-26) : ancre points_cycle_started_at (posée au 1er scan
//   du cycle, remise à null au reset → jamais re-touchée avant un nouveau scan).
// • stamp_card / amount_points (spec 2026-09-05, échéance GLISSANTE) : ancre =
//   last_scan (repli created_at), AUCUNE colonne dédiée ; idempotent parce que
//   seules les cartes à compteur > 0 sont considérées. La remise à zéro vit ICI,
//   pas dans la RPC de scan (même décision d'architecture que points).
// visit_based / tiered : PAS d'expiration (progression à vie — cf. types.ts).

const CYCLE_TYPES = ["points", "stamp_card", "amount_points"] as const;

// Refresh silencieux des passes remis à zéro (best-effort, sans message —
// même pattern que scan/revert et geo/applyLocation).
async function refreshPasses(cardIds: string[]) {
  if (cardIds.length === 0) return;
  try {
    const { getChannels } = await import("@/lib/wallet/channel");
    for (const ch of getChannels()) await ch.notify(cardIds);
  } catch (e) {
    console.error("[points-expiry] push failed:", e);
  }
}

// Remise à zéro d'un lot de cartes d'UN marchand (tenancy double filtre sur
// l'update) + audit par carte. Renvoie les ids effectivement remis à zéro.
async function resetCards(
  merchantId: string,
  cards: { id: string; values: Record<string, unknown>; action: AuditAction; details: Record<string, unknown> }[]
): Promise<string[]> {
  const done: string[] = [];
  for (const c of cards) {
    const { error } = await supabaseAdmin
      .from("loyalty_cards")
      .update(c.values)
      .eq("id", c.id)
      .eq("merchant_id", merchantId); // invariant 3 : double filtre tenancy
    if (error) {
      console.error("[points-expiry] reset failed:", c.id, error.code, error.message);
      continue;
    }
    done.push(c.id);
    await logAuditEvent({ action: c.action, merchant_id: merchantId, card_id: c.id, details: c.details });
  }
  return done;
}

async function run(): Promise<NextResponse> {
  const startedAt = new Date();
  let reset = 0;
  try {
    // TODO(pagination) : PostgREST plafonne les SELECT à 1000 lignes par défaut.
    // Au-delà de 1000 marchands à mécanique de cycle (ce select) — ou de 1000
    // cartes éligibles par marchand (selects ci-dessous) — cette requête ne
    // verrait qu'une partie des lignes et laisserait des cycles expirés non
    // réinitialisés en silence. Piste : paginer avec `.range(offset, offset +
    // 999)` et boucler jusqu'à une page incomplète.
    const { data: merchants } = await supabaseAdmin
      .from("merchants")
      .select("id, loyalty_type, loyalty_config, stamp_goal")
      .in("loyalty_type", [...CYCLE_TYPES]);

    for (const m of merchants ?? []) {
      const program = resolveLoyaltyProgram(m);
      const now = new Date();

      if (program.type === "points") {
        const expiration = program.config.expiration;
        if (!expiration || expiration.type === "none") continue;

        const { data: cards } = await supabaseAdmin
          .from("loyalty_cards")
          .select("id, points_balance, points_cycle_started_at")
          .eq("merchant_id", m.id) // invariant 3 : tenancy explicite
          .not("points_cycle_started_at", "is", null);

        const expired = (cards ?? []).filter((c) =>
          pointsCycleExpired(expiration, c.points_cycle_started_at ? new Date(c.points_cycle_started_at) : null, now)
        );
        const done = await resetCards(
          m.id,
          expired.map((c) => ({
            id: c.id,
            values: { points_balance: 0, redeemed_tiers: [], points_cycle_started_at: null },
            action: "POINTS_EXPIRED",
            details: { previous_balance: c.points_balance, expiration },
          }))
        );
        reset += done.length;
        await refreshPasses(done);
        continue;
      }

      // stamp_card / amount_points : échéance glissante sur le dernier passage.
      // (Le select filtre déjà sur CYCLE_TYPES ; ce garde narrowe pour TS et
      // protège d'une jsonb loyalty_type incohérente.)
      if (program.type !== "stamp_card" && program.type !== "amount_points") continue;
      const expiration: CycleExpiration | undefined = program.config.expiration;
      if (!expiration || expiration.type === "none") continue;

      const countColumn = program.type === "stamp_card" ? "stamps_count" : "points_balance";
      const { data: cards } = await supabaseAdmin
        .from("loyalty_cards")
        .select(`id, ${countColumn}, last_scan, created_at`)
        .eq("merchant_id", m.id) // invariant 3 : tenancy explicite
        .gt(countColumn, 0); // cartes à zéro ignorées → idempotent après reset

      const expired = ((cards ?? []) as unknown as Record<string, unknown>[]).filter((c) =>
        cycleCardExpired({
          expiration,
          count: (c[countColumn] as number) ?? 0,
          lastScan: (c.last_scan as string) ?? null,
          createdAt: (c.created_at as string) ?? null,
          now,
        })
      );
      const done = await resetCards(
        m.id,
        expired.map((c) => ({
          id: c.id as string,
          values: { [countColumn]: 0 },
          action: (program.type === "stamp_card" ? "STAMPS_EXPIRED" : "POINTS_EXPIRED") as AuditAction,
          details:
            program.type === "stamp_card"
              ? { previous_stamps: c[countColumn], expiration }
              : { previous_balance: c[countColumn], expiration, loyalty_type: "amount_points" },
        }))
      );
      reset += done.length;
      await refreshPasses(done);
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
