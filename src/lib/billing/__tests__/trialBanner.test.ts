import { describe, expect, it } from "vitest";
import { trialBannerInfo, trialWriteBlockReason } from "../subscription";

const NOW = new Date("2026-06-15T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("trialBannerInfo (bandeau d'essai)", () => {
  it("essai en cours : visible, jours restants arrondis au supérieur", () => {
    const info = trialBannerInfo({ billing_status: "trial", trial_ends_at: days(7.5) }, NOW);
    expect(info).toEqual({ show: true, expired: false, daysLeft: 8, urgent: false });
  });

  it("J-3 et moins : ton pressant", () => {
    expect(trialBannerInfo({ billing_status: "trial", trial_ends_at: days(3) }, NOW).urgent).toBe(true);
    expect(trialBannerInfo({ billing_status: "trial", trial_ends_at: days(0.5) }, NOW)).toMatchObject({
      daysLeft: 1,
      urgent: true,
    });
  });

  it("essai expiré (statut dérivé 'pending') : bandeau « terminé »", () => {
    const info = trialBannerInfo({ billing_status: "trial", trial_ends_at: days(-1) }, NOW);
    expect(info).toEqual({ show: true, expired: true, daysLeft: 0, urgent: true });
  });

  it("compte actif, suspendu ou pré-migration : aucun bandeau", () => {
    expect(trialBannerInfo({ billing_status: "active" }, NOW).show).toBe(false);
    expect(trialBannerInfo({}, NOW).show).toBe(false);
    expect(
      trialBannerInfo({ billing_status: "trial", trial_ends_at: days(5), suspended_at: days(-1) }, NOW).show
    ).toBe(false);
  });
});

describe("trialWriteBlockReason (lecture seule douce)", () => {
  it("bloque les envois UNIQUEMENT après expiration de l'essai", () => {
    expect(trialWriteBlockReason({ billing_status: "trial", trial_ends_at: days(2) }, NOW)).toBeNull();
    expect(trialWriteBlockReason({ billing_status: "active" }, NOW)).toBeNull();
    const reason = trialWriteBlockReason({ billing_status: "trial", trial_ends_at: days(-2) }, NOW);
    expect(reason).toBeTruthy();
    // Le message rassure : le comptoir ne casse jamais.
    expect(reason).toContain("scan");
  });

  it("'pending' stocké (relance manuelle) : même pause douce", () => {
    expect(trialWriteBlockReason({ billing_status: "pending" }, NOW)).toBeTruthy();
  });
});
