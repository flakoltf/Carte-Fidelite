// Trace d'exécution des crons dans cron_runs (page admin « Santé technique »).
// Best-effort comme logAuditEvent : une panne de trace ne casse JAMAIS le job.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CronJobName } from "@/lib/admin/systemHealth";

export async function recordCronRun(args: {
  job: CronJobName;
  status: "ok" | "error";
  startedAt: Date;
  details?: Record<string, unknown>;
}) {
  try {
    const { error } = await supabaseAdmin.from("cron_runs").insert({
      job: args.job,
      status: args.status,
      started_at: args.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      details: args.details ?? {},
    });
    if (error) console.error("cron_runs insert rejected:", error.code, error.message, args.job);
  } catch (error) {
    console.error("cron_runs insert failed:", error);
  }
}
