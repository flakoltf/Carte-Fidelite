import { ApiError, type ApiClient } from "@/lib/api";
import { submitRevert, submitScan } from "../scanApi";

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
