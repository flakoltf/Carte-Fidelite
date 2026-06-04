import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { signQRCode, verifyQRCode } from "../qrSignature";

const SECRET = "test-qr-secret"; // = QR_SIGNATURE_SECRET de vitest.config.ts
const cardId = "11111111-1111-4111-8111-111111111111";

describe("qrSignature", () => {
  it("signQRCode produit cardId:HMAC COMPLET (64 hex, plus tronqué)", () => {
    const [id, sig] = signQRCode(cardId).split(":");
    expect(id).toBe(cardId);
    expect(sig).toHaveLength(64); // HMAC-SHA256 complet (256 bits)
  });

  it("verifyQRCode valide une signature correcte (round-trip)", () => {
    expect(verifyQRCode(signQRCode(cardId))).toEqual({ valid: true, cardId });
  });

  it("rejette une signature incorrecte/forgée", () => {
    expect(verifyQRCode(`${cardId}:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`)).toEqual({
      valid: false,
      cardId: null,
    });
  });

  it("rejette un contenu malformé", () => {
    expect(verifyQRCode("pasdesignature")).toEqual({ valid: false, cardId: null });
    expect(verifyQRCode("")).toEqual({ valid: false, cardId: null });
    expect(verifyQRCode(`${cardId}:`)).toEqual({ valid: false, cardId: null });
  });

  it("RÉTRO-COMPAT : accepte encore l'ancienne signature tronquée 16-car (QR déjà dans les Wallet)", () => {
    const fullSig = crypto.createHmac("sha256", SECRET).update(cardId).digest("hex");
    const legacyQr = `${cardId}:${fullSig.slice(0, 16)}`;
    expect(verifyQRCode(legacyQr)).toEqual({ valid: true, cardId });
  });
});
