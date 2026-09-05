import { describe, it, expect } from "vitest";
import { cycleCardExpired } from "../cycleExpiry";

// Échéance glissante stamp_card / amount_points : le cycle repart à zéro si
// AUCUN passage pendant N mois. L'ancre est le dernier passage (last_scan),
// avec repli sur created_at (carte jamais scannée, ex. tampon de bienvenue).
// Logique pure — le cron ne fait que filtrer/écrire.

const NOW = new Date("2026-09-05T12:00:00Z");
const ROLLING_6 = { type: "rolling", months: 6 } as const;

function card(over: Partial<Parameters<typeof cycleCardExpired>[0]> = {}) {
  return {
    expiration: ROLLING_6 as { type: "rolling"; months: number } | { type: "none" } | undefined,
    count: 5,
    lastScan: "2026-01-01T10:00:00Z", // > 6 mois avant NOW
    createdAt: "2025-12-01T10:00:00Z",
    now: NOW,
    ...over,
  };
}

describe("cycleCardExpired", () => {
  it("expire une carte inactive depuis plus de N mois", () => {
    expect(cycleCardExpired(card())).toBe(true);
  });

  it("n'expire jamais sans expiration configurée (undefined ou none)", () => {
    expect(cycleCardExpired(card({ expiration: undefined }))).toBe(false);
    expect(cycleCardExpired(card({ expiration: { type: "none" } }))).toBe(false);
  });

  it("ignore les cartes à zéro (rien à remettre à zéro → idempotent après reset)", () => {
    expect(cycleCardExpired(card({ count: 0 }))).toBe(false);
  });

  it("borne exacte : un passage juste à l'intérieur de la fenêtre ne fait pas expirer", () => {
    expect(cycleCardExpired(card({ lastScan: "2026-03-06T12:00:00Z" }))).toBe(false); // < 6 mois
    expect(cycleCardExpired(card({ lastScan: "2026-03-04T12:00:00Z" }))).toBe(true); // > 6 mois
  });

  it("l'ancre est le DERNIER passage, pas la création de la carte", () => {
    expect(cycleCardExpired(card({ lastScan: "2026-08-01T10:00:00Z", createdAt: "2020-01-01T00:00:00Z" }))).toBe(false);
  });

  it("carte jamais scannée : repli sur created_at (tampon de bienvenue seul)", () => {
    expect(cycleCardExpired(card({ lastScan: null, createdAt: "2026-01-01T10:00:00Z" }))).toBe(true);
    expect(cycleCardExpired(card({ lastScan: null, createdAt: "2026-08-01T10:00:00Z" }))).toBe(false);
  });

  it("aucune ancre exploitable → jamais expiré (défensif)", () => {
    expect(cycleCardExpired(card({ lastScan: null, createdAt: null }))).toBe(false);
  });
});
