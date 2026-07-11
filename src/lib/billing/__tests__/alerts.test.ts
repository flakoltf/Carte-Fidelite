import { describe, expect, it } from "vitest";
import { computeBillingAlerts, type AlertSnapshotRow, type ExistingAlertState } from "../alerts";

const PERIOD = "2026-07-01";

function row(overrides: Partial<AlertSnapshotRow> & { merchant_id: string }): AlertSnapshotRow {
  return { plan: "essentiel", active_cards_90d: 0, ...overrides };
}

describe("computeBillingAlerts — bascule des seuils", () => {
  it("n'alerte pas en usage normal (< 80 %)", () => {
    const res = computeBillingAlerts([row({ merchant_id: "m1", active_cards_90d: 100 })], [], PERIOD);
    expect(res.alerts).toHaveLength(0);
    expect(res.digest).toBeNull();
  });

  it("alerte 'near' exactement à 80 % du plafond (Essentiel = 200 → 160)", () => {
    const res = computeBillingAlerts([row({ merchant_id: "m1", active_cards_90d: 160 })], [], PERIOD);
    expect(res.alerts).toHaveLength(1);
    expect(res.alerts[0].level).toBe("near");
    expect(res.alerts[0].cap).toBe(200);
  });

  it("juste en dessous du seuil (159) reste sous le radar", () => {
    const res = computeBillingAlerts([row({ merchant_id: "m1", active_cards_90d: 159 })], [], PERIOD);
    expect(res.alerts).toHaveLength(0);
  });

  it("alerte 'over' au-delà du plafond", () => {
    const res = computeBillingAlerts([row({ merchant_id: "m1", active_cards_90d: 240 })], [], PERIOD);
    expect(res.alerts[0].level).toBe("over");
  });

  it("ignore le palier sur mesure (custom, sans plafond)", () => {
    const res = computeBillingAlerts([row({ merchant_id: "m1", plan: "custom", active_cards_90d: 9999 })], [], PERIOD);
    expect(res.alerts).toHaveLength(0);
    expect(res.digest).toBeNull();
  });
});

describe("computeBillingAlerts — idempotence", () => {
  it("ne ré-alerte pas si le même niveau a déjà été notifié ce mois-ci", () => {
    const rows = [row({ merchant_id: "m1", active_cards_90d: 240 })];
    const existing: ExistingAlertState[] = [{ merchant_id: "m1", alert_level: "over" }];
    const res = computeBillingAlerts(rows, existing, PERIOD);
    expect(res.alerts).toHaveLength(0);
  });

  it("ré-alerte lors d'une montée de sévérité (near déjà notifié → over)", () => {
    const rows = [row({ merchant_id: "m1", active_cards_90d: 240 })];
    const existing: ExistingAlertState[] = [{ merchant_id: "m1", alert_level: "near" }];
    const res = computeBillingAlerts(rows, existing, PERIOD);
    expect(res.alerts).toHaveLength(1);
    expect(res.alerts[0].level).toBe("over");
  });

  it("n'alerte pas de nouveau à near quand over a déjà été notifié (pas de rétrogradation)", () => {
    const rows = [row({ merchant_id: "m1", active_cards_90d: 170 })]; // near
    const existing: ExistingAlertState[] = [{ merchant_id: "m1", alert_level: "over" }];
    const res = computeBillingAlerts(rows, existing, PERIOD);
    expect(res.alerts).toHaveLength(0);
  });

  it("alerte à la première bascule quand aucun niveau n'est encore enregistré (null)", () => {
    const rows = [row({ merchant_id: "m1", active_cards_90d: 170 })];
    const existing: ExistingAlertState[] = [{ merchant_id: "m1", alert_level: null }];
    const res = computeBillingAlerts(rows, existing, PERIOD);
    expect(res.alerts).toHaveLength(1);
  });
});

describe("computeBillingAlerts — récap", () => {
  it("agrège plusieurs marchands et compte les dépassements dans le sujet", () => {
    const rows = [
      row({ merchant_id: "m1", merchant_name: "Café Lumière", active_cards_90d: 240 }), // over
      row({ merchant_id: "m2", merchant_name: "Fleuriste Rose", plan: "croissance", active_cards_90d: 620 }), // near (620/750 = 82,6 %)
      row({ merchant_id: "m3", active_cards_90d: 10 }), // rien
    ];
    const res = computeBillingAlerts(rows, [], PERIOD);
    expect(res.alerts).toHaveLength(2);
    expect(res.digest).not.toBeNull();
    expect(res.digest!.subject).toContain("1 en dépassement");
    expect(res.digest!.text).toContain("Café Lumière");
    expect(res.digest!.html).toContain("Fleuriste Rose");
    expect(res.digest!.text).toContain(PERIOD);
  });

  it("retombe sur l'identifiant quand le nom du commerce est absent", () => {
    const rows = [row({ merchant_id: "abc-123", active_cards_90d: 240 })];
    const res = computeBillingAlerts(rows, [], PERIOD);
    expect(res.alerts[0].merchantName).toBeNull();
    expect(res.digest!.text).toContain("abc-123");
  });
});
