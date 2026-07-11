import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualStr } from "@/lib/timingSafe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordCronRun } from "@/lib/cron/recordRun";
import { sendEmail } from "@/lib/email/send";
import { computeBillingAlerts, type AlertSnapshotRow } from "@/lib/billing/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Émet les alertes de dépassement de palier à partir du comptage figé.
// Best-effort et isolé : une panne ici ne doit JAMAIS casser le snapshot.
// Renvoie le nombre d'alertes émises (pour la trace cron).
async function emitBillingAlerts(rows: AlertSnapshotRow[], period: string): Promise<number> {
  try {
    // Niveaux déjà notifiés ce mois-ci (lus AVANT tout, pour l'idempotence).
    const { data: existing } = await supabaseAdmin
      .from("billing_snapshots")
      .select("merchant_id, alert_level")
      .eq("period", period);

    // Noms de commerce pour un récap lisible.
    const { data: names } = await supabaseAdmin.from("merchants").select("id, shop_name");
    const nameById = new Map((names ?? []).map((m) => [m.id as string, m.shop_name as string | null]));
    const withNames = rows.map((r) => ({ ...r, merchant_name: nameById.get(r.merchant_id) ?? null }));

    const { alerts, digest } = computeBillingAlerts(withNames, existing ?? [], period);
    if (alerts.length === 0) return 0;

    // 1) Récap au fondateur (no-op propre si Resend / destinataire absents).
    const to = process.env.BILLING_ALERT_EMAIL;
    if (to && digest) {
      await sendEmail({ to, subject: digest.subject, html: digest.html, text: digest.text });
    }

    // 2) Note système + mémorisation du niveau (idempotence durable).
    for (const a of alerts) {
      await supabaseAdmin
        .from("admin_notes")
        .insert({ merchant_id: a.merchantId, body: a.noteBody, source: "system:billing", pinned: true });
      await supabaseAdmin
        .from("billing_snapshots")
        .update({ alert_level: a.level })
        .eq("merchant_id", a.merchantId)
        .eq("period", period);
    }
    return alerts.length;
  } catch (error) {
    console.error("billing alerts emission failed:", error);
    return 0;
  }
}

// Snapshot mensuel du comptage « cartes actives 90 j » (CGV §6 : calculé le
// 1er jour de chaque mois, fait foi pour la détermination du palier).
// Idempotent : UNIQUE (merchant_id, period) — relancer le cron ne duplique rien.
async function runSnapshot() {
  const startedAt = new Date();
  const { data: counts, error } = await supabaseAdmin
    .from("billing_active_cards")
    .select("merchant_id, plan, active_cards_90d");
  if (error) {
    console.error("billing snapshot read failed:", error.code, error.message);
    await recordCronRun({ job: "billing-snapshot", status: "error", startedAt, details: { step: "read" } });
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
      await recordCronRun({ job: "billing-snapshot", status: "error", startedAt, details: { step: "write" } });
      return NextResponse.json({ error: "write_failed" }, { status: 500 });
    }
  }

  // Alertes de palier : une fois le comptage figé pour la période.
  const alertsSent = await emitBillingAlerts(rows, period);

  await recordCronRun({
    job: "billing-snapshot",
    status: "ok",
    startedAt,
    details: { period, merchants: rows.length, alerts: alertsSent },
  });
  return NextResponse.json({ period, merchants: rows.length, alerts: alertsSent });
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
