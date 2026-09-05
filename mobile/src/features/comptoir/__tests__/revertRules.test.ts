import {
  REVERT_WINDOW_SECONDS,
  canRevertScan,
  revertActionLabel,
  revertDoneMessage,
  revertSecondsLeft,
} from "../revertRules";

// Miroir mobile de src/lib/loyalty/revert.ts (web). Ces tests reprennent les
// mêmes attentes que src/lib/loyalty/__tests__/revert.test.ts : si le web change
// sa règle, ces tests doivent tomber.
describe("canRevertScan", () => {
  it("autorise les mécaniques à compteur", () => {
    expect(canRevertScan("stamp_card")).toBe(true);
    expect(canRevertScan("visit_based")).toBe(true);
    expect(canRevertScan("tiered")).toBe(true);
  });

  it("exclut les mécaniques à points (décision produit du web)", () => {
    expect(canRevertScan("points")).toBe(false);
    expect(canRevertScan("amount_points")).toBe(false);
  });

  it("refuse un type inconnu ou absent", () => {
    expect(canRevertScan("")).toBe(false);
    expect(canRevertScan("cashback")).toBe(false);
    expect(canRevertScan(null)).toBe(false);
    expect(canRevertScan(undefined)).toBe(false);
  });
});

describe("revertActionLabel", () => {
  it("emploie le mot juste par mécanique", () => {
    expect(revertActionLabel("stamp_card")).toBe("Annuler ce tampon");
    expect(revertActionLabel("visit_based")).toBe("Annuler cette visite");
    expect(revertActionLabel("tiered")).toBe("Annuler ce passage");
  });
});

describe("revertDoneMessage", () => {
  it("confirme avec le même vocabulaire", () => {
    expect(revertDoneMessage("stamp_card")).toBe("Tampon annulé");
    expect(revertDoneMessage("visit_based")).toBe("Visite annulée");
    expect(revertDoneMessage("tiered")).toBe("Passage annulé");
  });
});

describe("revertSecondsLeft", () => {
  const at = new Date("2026-09-05T12:00:00.000Z");

  it("part de la fenêtre de 5 minutes du serveur", () => {
    expect(REVERT_WINDOW_SECONDS).toBe(300);
    expect(revertSecondsLeft(at, at)).toBe(300);
  });

  it("décompte le temps écoulé", () => {
    expect(revertSecondsLeft(at, new Date("2026-09-05T12:04:00.000Z"))).toBe(60);
  });

  it("tombe à zéro passé la fenêtre, jamais en négatif", () => {
    expect(revertSecondsLeft(at, new Date("2026-09-05T12:05:00.000Z"))).toBe(0);
    expect(revertSecondsLeft(at, new Date("2026-09-05T12:30:00.000Z"))).toBe(0);
  });

  it("renvoie zéro sans horodatage exploitable", () => {
    expect(revertSecondsLeft(null, at)).toBe(0);
    expect(revertSecondsLeft(new Date("pas une date"), at)).toBe(0);
  });
});
