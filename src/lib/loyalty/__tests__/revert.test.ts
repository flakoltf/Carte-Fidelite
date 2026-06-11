import { describe, expect, it } from "vitest";
import {
  REVERT_WINDOW_SECONDS,
  normalizeRevertStatus,
  revertStatusMessage,
  revertSecondsLeft,
} from "../revert";

describe("annulation de tampon — logique pure", () => {
  it("fenêtre de 5 minutes", () => {
    expect(REVERT_WINDOW_SECONDS).toBe(300);
  });

  it("normalise défensivement les statuts RPC", () => {
    expect(normalizeRevertStatus("reverted")).toBe("reverted");
    expect(normalizeRevertStatus("expired")).toBe("expired");
    expect(normalizeRevertStatus("empty")).toBe("empty");
    expect(normalizeRevertStatus("notfound")).toBe("notfound");
    expect(normalizeRevertStatus("autre")).toBeNull();
    expect(normalizeRevertStatus(undefined)).toBeNull();
  });

  it("chaque statut a un message marchand en mots simples", () => {
    for (const s of ["reverted", "expired", "empty", "notfound"] as const) {
      const msg = revertStatusMessage(s);
      expect(msg.length).toBeGreaterThan(10);
      // pas de jargon technique dans les messages comptoir
      expect(msg).not.toMatch(/RPC|SQL|token|merchant_id/i);
    }
  });

  it("revertSecondsLeft : compte à rebours borné à zéro", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const lastScan = new Date(now.getTime() - 60_000).toISOString(); // il y a 1 min
    expect(revertSecondsLeft(lastScan, now)).toBe(240);
    const old = new Date(now.getTime() - 10 * 60_000).toISOString(); // il y a 10 min
    expect(revertSecondsLeft(old, now)).toBe(0);
    expect(revertSecondsLeft(null, now)).toBe(0);
    expect(revertSecondsLeft("pas-une-date", now)).toBe(0);
  });
});
