import { describe, expect, it } from "vitest";
import { computeCronHealth, computeBackupStatus, integrationStatuses, type CronRun } from "../systemHealth";
import { computeCertExpiry, parseGooglePublishing } from "../walletOps";

const now = new Date("2026-06-10T12:00:00Z");

const run = (over: Partial<CronRun>): CronRun => ({
  id: "r1",
  job: "campaigns",
  status: "ok",
  startedAt: "2026-06-10T09:00:00Z",
  finishedAt: "2026-06-10T09:00:05Z",
  details: {},
  ...over,
});

describe("computeCronHealth", () => {
  it("jamais_execute sans aucun run", () => {
    const health = computeCronHealth([], now);
    expect(health.every((h) => h.state === "jamais_execute")).toBe(true);
  });

  it("ok si dernier run récent et réussi", () => {
    const health = computeCronHealth([run({})], now);
    expect(health.find((h) => h.job === "campaigns")?.state).toBe("ok");
  });

  it("erreur si le dernier run a échoué", () => {
    const health = computeCronHealth([run({ status: "error" }), run({ id: "r0", startedAt: "2026-06-09T09:00:00Z" })], now);
    expect(health.find((h) => h.job === "campaigns")?.state).toBe("erreur");
    expect(health.find((h) => h.job === "campaigns")?.lastOkAt).toBe("2026-06-09T09:00:00Z");
  });

  it("en_retard si silence au-delà de la fenêtre du job", () => {
    const health = computeCronHealth([run({ startedAt: "2026-06-07T09:00:00Z" })], now);
    expect(health.find((h) => h.job === "campaigns")?.state).toBe("en_retard");
  });
});

describe("computeBackupStatus", () => {
  it("fresh si vérifié il y a moins de 7 jours", () => {
    expect(computeBackupStatus({ last_verified_at: "2026-06-08T00:00:00Z" }, now).fresh).toBe(true);
    expect(computeBackupStatus({ last_verified_at: "2026-05-01T00:00:00Z" }, now).fresh).toBe(false);
  });

  it("tolère valeur absente ou malformée", () => {
    expect(computeBackupStatus(null, now)).toEqual({ lastVerifiedAt: null, note: null, fresh: false });
    expect(computeBackupStatus({ last_verified_at: 42 }, now).lastVerifiedAt).toBeNull();
  });
});

describe("integrationStatuses", () => {
  it("lit la présence des variables, jamais leurs valeurs", () => {
    const statuses = integrationStatuses({
      SENTRY_DSN: "x",
      RESEND_API_KEY: "x",
      EMAIL_FROM: "x",
    } as NodeJS.ProcessEnv);
    expect(statuses.find((s) => s.key === "sentry")?.configured).toBe(true);
    expect(statuses.find((s) => s.key === "resend")?.configured).toBe(true);
    expect(statuses.find((s) => s.key === "upstash")?.configured).toBe(false);
    expect(statuses.find((s) => s.key === "google_wallet")?.configured).toBe(false);
  });
});

describe("computeCertExpiry", () => {
  it("niveaux ok / bientot / urgent selon l'échéance", () => {
    expect(computeCertExpiry({ date: "2027-06-28" }, now).level).toBe("ok");
    expect(computeCertExpiry({ date: "2026-08-01" }, now).level).toBe("bientot");
    expect(computeCertExpiry({ date: "2026-06-20" }, now).level).toBe("urgent");
  });

  it("inconnu si valeur absente ou invalide", () => {
    expect(computeCertExpiry(null, now).level).toBe("inconnu");
    expect(computeCertExpiry({ date: "bientôt" }, now).level).toBe("inconnu");
  });
});

describe("parseGooglePublishing", () => {
  it("statuts connus + note", () => {
    expect(parseGooglePublishing({ status: "en_attente", note: "déposé" })).toEqual({ status: "en_attente", note: "déposé" });
    expect(parseGooglePublishing({ status: "approuve" }).status).toBe("approuve");
  });

  it("inconnu par défaut", () => {
    expect(parseGooglePublishing(null).status).toBe("inconnu");
    expect(parseGooglePublishing({ status: "wat" }).status).toBe("inconnu");
  });
});
