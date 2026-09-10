import { ApiError, type ApiClient } from "@/lib/api";
import { submitRedeem, submitRevert, submitScan } from "../scanApi";

/** Faux client API : aucun réseau, jamais de scan réel. */
function fakeClient(post: jest.Mock): ApiClient {
  return {
    post,
    request: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  } as unknown as ApiClient;
}

describe("submitScan", () => {
  it("poste l'identifiant scanné sur /api/scan et traduit la réponse", async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      added: true,
      rewardReady: false,
      loyaltyType: "stamp_card",
      stampGoal: 8,
      card: { stamps_count: 4 },
    });

    const outcome = await submitScan("payload-qr", fakeClient(post));

    expect(post).toHaveBeenCalledWith("/api/scan", { cardId: "payload-qr" });
    expect(outcome).toMatchObject({ kind: "credit", title: "+1 tampon", detail: "4 / 8" });
  });

  it("transmet le refus du serveur sans le réinterpréter", async () => {
    const post = jest.fn().mockRejectedValue(
      new ApiError("Carte déjà scannée à l'instant. Patientez quelques secondes.", 429, {
        cooldown: true,
      }),
    );

    const outcome = await submitScan("payload-qr", fakeClient(post));

    expect(outcome.kind).toBe("cooldown");
  });

  it("traduit une coupure réseau (statut 0 du client API)", async () => {
    const post = jest.fn().mockRejectedValue(
      new ApiError("Connexion impossible. Vérifiez votre réseau.", 0),
    );

    expect((await submitScan("payload-qr", fakeClient(post))).kind).toBe("offline");
  });

  it("n'explose jamais sur une erreur inattendue", async () => {
    const post = jest.fn().mockRejectedValue(new Error("boum"));

    const outcome = await submitScan("payload-qr", fakeClient(post));

    expect(outcome.kind).toBe("refused");
    expect(outcome.message).toBeTruthy();
  });

  it("supporte une réponse vide", async () => {
    const outcome = await submitScan("payload-qr", fakeClient(jest.fn().mockResolvedValue(null)));

    expect(outcome.kind).toBe("refused");
  });

  it("joint le montant CHF quand le pavé le fournit (amount_points)", async () => {
    const post = jest.fn().mockResolvedValue({ success: true, currentValue: 62, pointsEarned: 12, rewardReady: false });

    const outcome = await submitScan("payload-qr", fakeClient(post), 12.5);

    expect(post).toHaveBeenCalledWith("/api/scan", { cardId: "payload-qr", amountChf: 12.5 });
    expect(outcome).toMatchObject({ kind: "credit", title: "+12 points" });
  });

  it("sans montant, le corps ne porte JAMAIS de clé amountChf", async () => {
    const post = jest.fn().mockResolvedValue({ success: true });

    await submitScan("payload-qr", fakeClient(post));

    expect(post).toHaveBeenCalledWith("/api/scan", { cardId: "payload-qr" });
  });
});

describe("submitRedeem", () => {
  it("poste sur /api/scan/redeem avec le payload QR seul (tampons, amount_points)", async () => {
    const post = jest.fn().mockResolvedValue({ success: true, card: { stamps_count: 0 } });

    const result = await submitRedeem("payload-qr", undefined, fakeClient(post));

    expect(post).toHaveBeenCalledWith("/api/scan/redeem", { cardId: "payload-qr" });
    expect(result).toEqual({ ok: true, cycleReset: false, tierReward: null });
  });

  it("joint le palier choisi pour une carte à points (contrat du comptoir web)", async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      tier: { threshold: 200, reward: "Menu offert" },
      cycleReset: true,
    });

    const result = await submitRedeem("payload-qr", 200, fakeClient(post));

    expect(post).toHaveBeenCalledWith("/api/scan/redeem", { cardId: "payload-qr", tierThreshold: 200 });
    expect(result).toEqual({ ok: true, cycleReset: true, tierReward: "Menu offert" });
  });

  it("remonte tel quel le refus du serveur (déjà encaissée, palier non atteint…)", async () => {
    const post = jest.fn().mockRejectedValue(new ApiError("Carte non complète ou déjà encaissée", 409));

    const result = await submitRedeem("payload-qr", undefined, fakeClient(post));

    expect(result).toEqual({ ok: false, offline: false, message: "Carte non complète ou déjà encaissée" });
  });

  it("dit clairement que rien n'a été encaissé si le réseau tombe", async () => {
    const post = jest.fn().mockRejectedValue(new ApiError("Connexion impossible. Vérifiez votre réseau.", 0));

    const result = await submitRedeem("payload-qr", undefined, fakeClient(post));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offline).toBe(true);
      expect(result.message).toMatch(/rien n'a été encaissé/i);
    }
  });

  it("réponse sans drapeau success : traitée comme un refus, jamais comme un encaissement", async () => {
    const result = await submitRedeem("payload-qr", undefined, fakeClient(jest.fn().mockResolvedValue(null)));

    expect(result.ok).toBe(false);
  });
});

describe("submitRevert", () => {
  it("poste sur /api/scan/revert et confirme avec le mot de la mécanique", async () => {
    const post = jest.fn().mockResolvedValue({ success: true, message: "Tampon annulé. Le compte est corrigé." });

    const result = await submitRevert("carte-1", "visit_based", fakeClient(post));

    expect(post).toHaveBeenCalledWith("/api/scan/revert", { cardId: "carte-1" });
    expect(result).toEqual({ ok: true, message: "Visite annulée" });
  });

  it("remonte tel quel le refus du serveur (fenêtre dépassée)", async () => {
    const post = jest.fn().mockRejectedValue(
      new ApiError("Trop tard pour annuler : plus de 5 minutes se sont écoulées depuis ce tampon.", 409),
    );

    const result = await submitRevert("carte-1", "stamp_card", fakeClient(post));

    expect(result).toEqual({
      ok: false,
      message: "Trop tard pour annuler : plus de 5 minutes se sont écoulées depuis ce tampon.",
    });
  });

  it("dit clairement que rien n'a été annulé si le réseau tombe", async () => {
    const post = jest.fn().mockRejectedValue(new ApiError("Connexion impossible. Vérifiez votre réseau.", 0));

    const result = await submitRevert("carte-1", "stamp_card", fakeClient(post));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/rien n'a été annulé/i);
  });
});
