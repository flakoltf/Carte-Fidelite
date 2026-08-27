// Santé technique du panneau super-admin : crons, intégrations, backups.
// Surface ADMIN UNIQUEMENT. Calculs purs séparés pour les tests.

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Définition des jobs planifiés (vercel.json — source de vérité du repo) ──
export const CRON_JOBS = [
  {
    job: "campaigns" as const,
    label: "Campagnes marketing",
    schedule: "0 9 * * *",
    scheduleLabel: "tous les jours à 09:00 UTC",
    /** Au-delà de cette fenêtre sans run OK, le job est considéré en retard. */
    maxSilenceHours: 26,
  },
  {
    job: "billing-snapshot" as const,
    label: "Snapshot facturation",
    schedule: "0 5 1 * *",
    scheduleLabel: "le 1er du mois à 05:00 UTC",
    maxSilenceHours: 24 * 32,
  },
  {
    job: "points-expiry" as const,
    label: "Expiration cycles de points",
    schedule: "0 4 * * *",
    scheduleLabel: "tous les jours à 04:00 UTC",
    maxSilenceHours: 26,
  },
];

export type CronJobName = (typeof CRON_JOBS)[number]["job"];

export interface CronRun {
  id: string;
  job: CronJobName;
  status: "ok" | "error";
  startedAt: string;
  finishedAt: string | null;
  details: Record<string, unknown>;
}

export type CronState = "ok" | "en_retard" | "erreur" | "jamais_execute";

export interface CronJobHealth {
  job: CronJobName;
  label: string;
  scheduleLabel: string;
  state: CronState;
  lastRun: CronRun | null;
  lastOkAt: string | null;
}

// Pur : dérive l'état de chaque job depuis son historique (runs triés récents d'abord).
export function computeCronHealth(runs: CronRun[], now: Date): CronJobHealth[] {
  return CRON_JOBS.map((def) => {
    const jobRuns = runs.filter((r) => r.job === def.job);
    const lastRun = jobRuns[0] ?? null;
    const lastOk = jobRuns.find((r) => r.status === "ok") ?? null;

    let state: CronState;
    if (!lastRun) {
      state = "jamais_execute";
    } else if (lastRun.status === "error") {
      state = "erreur";
    } else if (now.getTime() - new Date(lastRun.startedAt).getTime() > def.maxSilenceHours * 3600000) {
      state = "en_retard";
    } else {
      state = "ok";
    }

    return {
      job: def.job,
      label: def.label,
      scheduleLabel: def.scheduleLabel,
      state,
      lastRun,
      lastOkAt: lastOk?.startedAt ?? null,
    };
  });
}

export async function fetchCronRuns(supabase: SupabaseClient, limit = 60): Promise<CronRun[]> {
  const { data, error } = await supabase
    .from("cron_runs")
    .select("id, job, status, started_at, finished_at, details")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    job: r.job as CronJobName,
    status: r.status as CronRun["status"],
    startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string) ?? null,
    details: (r.details as Record<string, unknown>) ?? {},
  }));
}

// ── Intégrations : présence des variables d'environnement (jamais les valeurs)
export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  /** Conséquence concrète si absent — pas de jargon. */
  missingImpact: string;
}

export function integrationStatuses(env: NodeJS.ProcessEnv = process.env): IntegrationStatus[] {
  return [
    {
      key: "sentry",
      label: "Sentry (erreurs)",
      configured: Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN),
      missingImpact: "Aveugle sur les erreurs prod — poser SENTRY_DSN.",
    },
    {
      key: "resend",
      label: "Email (Resend)",
      configured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
      missingImpact: "Tous les envois d'emails sont des no-op silencieux.",
    },
    {
      key: "upstash",
      label: "Rate-limit (Upstash)",
      configured: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
      missingImpact: "Login/enrôlement/scan sans limitation de débit.",
    },
    {
      key: "cron_secret",
      label: "Crons (CRON_SECRET)",
      configured: Boolean(env.CRON_SECRET),
      missingImpact: "Les routes /api/cron/* refusent tout déclenchement.",
    },
    {
      key: "apple_wallet",
      label: "Apple Wallet (émission)",
      configured: Boolean(env.NEXT_PUBLIC_APPLE_WALLET_ENABLED === "true" || env.SIGNER_CERT_BASE64),
      missingImpact: "Émission Apple Wallet inactive sur cet environnement.",
    },
    {
      key: "google_wallet",
      label: "Google Wallet (bouton client)",
      configured: env.NEXT_PUBLIC_GOOGLE_WALLET_READY === "true",
      missingImpact: "Bouton Google Wallet masqué (publishing access en attente).",
    },
  ];
}

// ── Attestation backup (platform_settings.db_backup) ───────────────────────
export interface BackupStatus {
  lastVerifiedAt: string | null;
  note: string | null;
  /** true si vérifié il y a moins de 7 jours. */
  fresh: boolean;
}

export function computeBackupStatus(value: unknown, now: Date): BackupStatus {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const lastVerifiedAt = typeof v.last_verified_at === "string" ? v.last_verified_at : null;
  const note = typeof v.note === "string" ? v.note : null;
  const fresh = Boolean(
    lastVerifiedAt &&
      !Number.isNaN(Date.parse(lastVerifiedAt)) &&
      now.getTime() - new Date(lastVerifiedAt).getTime() < 7 * 86400000
  );
  return { lastVerifiedAt, note, fresh };
}
