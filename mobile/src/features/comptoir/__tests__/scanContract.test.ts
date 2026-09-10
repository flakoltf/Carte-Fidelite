import { interpretScanResult, type ScanApiResult } from "../scanContract";

const ok = (body: Record<string, unknown>): ScanApiResult => ({ ok: true, body });
const ko = (status: number, message: string, payload: unknown = {}): ScanApiResult => ({
  ok: false,
  status,
  message,
  payload,
});

// Le serveur décide, l'écran affiche. Ces tests figent la traduction des
// réponses RÉELLES de POST /api/scan (src/app/api/scan/route.ts) en états
// d'écran — aucune règle métier n'est recalculée ici.
describe("interpretScanResult — crédit simple", () => {
  it("carte à tampons : « +1 tampon » et la progression du serveur", () => {
    const outcome = interpretScanResult(
      ok({
        success: true,
        added: true,
        rewardReady: false,
        loyaltyType: "stamp_card",
        stampGoal: 8,
        card: { stamps_count: 4, customers: { full_name: "Marie Favre" } },
      }),
      "carte-1",
    );

    expect(outcome).toMatchObject({
      kind: "credit",
      title: "+1 tampon",
      detail: "4 / 8",
      customerName: "Marie Favre",
      loyaltyType: "stamp_card",
    });
  });

  it("carte de passages : le mot juste, sans objectif", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "visit_based", card: { stamps_count: 3 } }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "credit", title: "Visite enregistrée", detail: "3 visites" });
  });

  it("carte à paliers : « Passage compté »", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "tiered", card: { stamps_count: 12 } }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "credit", title: "Passage compté", detail: "12 passages" });
  });

  it("points par scan : points ajoutés et solde sur le seuil", () => {
    const outcome = interpretScanResult(
      ok({
        success: true,
        added: true,
        rewardReady: false,
        loyaltyType: "points",
        pointsAdded: 10,
        currentValue: 130,
        maxThreshold: 200,
      }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "credit", title: "+10 points", detail: "130 / 200" });
  });

  it("points par montant : la réponse ne porte pas de loyaltyType", () => {
    const outcome = interpretScanResult(
      ok({ success: true, currentValue: 42, pointsEarned: 12, rewardReady: false }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "credit", title: "+12 points", detail: "42 points" });
  });

  it("accorde le singulier", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "points", pointsAdded: 1, currentValue: 1, maxThreshold: 50 }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ title: "+1 point" });
  });

  it("survit à une réponse sans progression exploitable", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "stamp_card" }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "credit", title: "+1 tampon", detail: null });
  });
});

describe("interpretScanResult — récompense", () => {
  it("carte pleine au moment du scan : état récompense, pas crédit", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: true, rewardUnlocked: true, loyaltyType: "stamp_card", stampGoal: 8, card: { stamps_count: 8, customers: { full_name: "Ali Zeroual" } } }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "reward", detail: "8 / 8", customerName: "Ali Zeroual" });
  });

  it("carte déjà pleine, rien ajouté : même état récompense", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: false, rewardReady: true, loyaltyType: "stamp_card", stampGoal: 10, card: { stamps_count: 10 } }),
      "carte-1",
    );

    expect(outcome.kind).toBe("reward");
  });

  it("points : palier franchi", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: true, loyaltyType: "points", currentValue: 200, maxThreshold: 200, redeemableTiers: [{ threshold: 200, reward: "Un café offert" }] }),
      "carte-1",
    );

    expect(outcome.kind).toBe("reward");
  });
});

describe("interpretScanResult — plan d'encaissement", () => {
  it("carte à tampons pleine : un seul bouton OFFRIR (mode single)", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: false, rewardReady: true, loyaltyType: "stamp_card", stampGoal: 8, card: { stamps_count: 8 } }),
      "carte-1",
    );

    expect(outcome.redeem).toEqual({ mode: "single", rewardLabel: null });
    expect(outcome.cardId).toBe("carte-1");
  });

  it("amount_points au seuil : mode single, avec le libellé de récompense du serveur", () => {
    const outcome = interpretScanResult(
      ok({ success: true, currentValue: 120, pointsEarned: 20, rewardReady: true, rewardLabel: "Café offert" }),
      "carte-1",
    );

    expect(outcome.redeem).toEqual({ mode: "single", rewardLabel: "Café offert" });
  });

  it("carte à points : un bouton par palier validable du serveur (jamais recalculés)", () => {
    const outcome = interpretScanResult(
      ok({
        success: true, added: true, rewardReady: true, loyaltyType: "points",
        currentValue: 120, maxThreshold: 200,
        redeemableTiers: [
          { threshold: 50, reward: "Café offert" },
          { threshold: 100, reward: "Menu offert" },
        ],
      }),
      "carte-1",
    );

    expect(outcome.redeem).toEqual({
      mode: "tiers",
      tiers: [
        { threshold: 50, reward: "Café offert" },
        { threshold: 100, reward: "Menu offert" },
      ],
      maxThreshold: 200,
    });
  });

  it("paliers illisibles → aucun plan : l'écran informe sans proposer de bouton", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: true, loyaltyType: "points", currentValue: 200, redeemableTiers: [{ threshold: "x" }] }),
      "carte-1",
    );

    expect(outcome.kind).toBe("reward");
    expect(outcome.redeem).toBeNull();
  });

  it("visites et paliers d'ancienneté : purement informatifs, rien à encaisser", () => {
    const visites = interpretScanResult(
      ok({ success: true, added: true, rewardReady: true, loyaltyType: "visit_based", card: { stamps_count: 10 } }),
      "carte-1",
    );
    const paliers = interpretScanResult(
      ok({ success: true, added: true, rewardReady: true, loyaltyType: "tiered", card: { stamps_count: 20 } }),
      "carte-1",
    );

    expect(visites.redeem).toBeNull();
    expect(paliers.redeem).toBeNull();
  });

  it("jamais de plan hors récompense (crédit simple, refus)", () => {
    const credit = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "stamp_card", stampGoal: 8, card: { stamps_count: 4 } }),
      "carte-1",
    );

    expect(credit.redeem).toBeNull();
    expect(interpretScanResult(ko(404, "Carte invalide ou introuvable"), "carte-1").redeem).toBeNull();
  });
});

describe("interpretScanResult — refus du serveur", () => {
  it("cooldown : le drapeau du serveur fait foi", () => {
    const outcome = interpretScanResult(
      ko(429, "Carte déjà scannée à l'instant. Patientez quelques secondes.", {
        error: "Carte déjà scannée à l'instant. Patientez quelques secondes.",
        cooldown: true,
      }),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "cooldown", title: "Déjà scanné il y a un instant" });
    expect(outcome.message).toContain("Patientez");
  });

  it("429 sans drapeau cooldown : c'est le plafond de scans, pas un doublon", () => {
    const outcome = interpretScanResult(
      ko(429, "Trop de scans. Réessayez dans 1 minute.", { error: "Trop de scans. Réessayez dans 1 minute." }),
      "carte-1",
    );

    expect(outcome.kind).toBe("refused");
    expect(outcome.message).toBe("Trop de scans. Réessayez dans 1 minute.");
  });

  it("carte inconnue (404)", () => {
    const outcome = interpretScanResult(ko(404, "Carte invalide ou introuvable"), "carte-1");

    expect(outcome).toMatchObject({ kind: "unknown-card", title: "Carte inconnue" });
  });

  it("QR forgé (400) : refus, message du serveur", () => {
    const outcome = interpretScanResult(ko(400, "QR code invalide ou forgé"), "carte-1");

    expect(outcome).toMatchObject({ kind: "refused", message: "QR code invalide ou forgé" });
  });

  it("carte d'un autre établissement (403)", () => {
    const outcome = interpretScanResult(
      ko(403, "Cette carte appartient à un autre établissement"),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "refused", message: "Cette carte appartient à un autre établissement" });
  });

  it("montant requis (400 amount_points) : état dédié, qui ouvre le pavé CHF", () => {
    const outcome = interpretScanResult(
      ko(400, "Le montant en CHF est requis (> 0, ≤ 10000, max 2 décimales).", {
        ok: false,
        error: "Le montant en CHF est requis (> 0, ≤ 10000, max 2 décimales).",
      }),
      "carte-1",
    );

    expect(outcome.kind).toBe("amount-required");
    expect(outcome.message).toMatch(/montant/i);
    // Le pavé renverra le MÊME payload QR signé, avec le montant tapé.
    expect(outcome.cardId).toBe("carte-1");
  });

  it("hors ligne : le client API remonte un statut 0", () => {
    const outcome = interpretScanResult(
      ko(0, "Connexion impossible. Vérifiez votre réseau."),
      "carte-1",
    );

    expect(outcome).toMatchObject({ kind: "offline", title: "Pas de réseau" });
    expect(outcome.message).toMatch(/n'a pas été enregistré/);
  });

  it("session expirée (401)", () => {
    const outcome = interpretScanResult(ko(401, "Session expirée. Reconnectez-vous."), "carte-1");

    expect(outcome).toMatchObject({ kind: "refused", message: "Session expirée. Reconnectez-vous." });
  });

  it("succès sans drapeau success : traité comme un refus", () => {
    const outcome = interpretScanResult(ok({ error: "Scan refusé." }), "carte-1");

    expect(outcome.kind).toBe("refused");
  });
});

describe("interpretScanResult — éligibilité de l'annulation", () => {
  it("propose l'annulation après un crédit sur compteur", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "stamp_card", stampGoal: 8, card: { stamps_count: 4 } }),
      "carte-42",
    );

    expect(outcome.revert).toEqual({ cardId: "carte-42", loyaltyType: "stamp_card" });
  });

  it("jamais pour les mécaniques à points", () => {
    const points = interpretScanResult(
      ok({ success: true, added: true, rewardReady: false, loyaltyType: "points", pointsAdded: 5, currentValue: 5, maxThreshold: 50 }),
      "carte-42",
    );
    const amount = interpretScanResult(
      ok({ success: true, pointsEarned: 5, currentValue: 5, rewardReady: false }),
      "carte-42",
    );

    expect(points.revert).toBeNull();
    expect(amount.revert).toBeNull();
  });

  it("jamais quand la récompense est atteinte (l'encaissement fait foi)", () => {
    const outcome = interpretScanResult(
      ok({ success: true, added: true, rewardReady: true, loyaltyType: "stamp_card", stampGoal: 8, card: { stamps_count: 8 } }),
      "carte-42",
    );

    expect(outcome.revert).toBeNull();
  });

  it("jamais après un refus", () => {
    expect(interpretScanResult(ko(404, "Carte invalide ou introuvable"), "carte-42").revert).toBeNull();
  });
});
