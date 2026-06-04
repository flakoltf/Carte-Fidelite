import crypto from "crypto";

function secret(): string {
  return process.env.IMPERSONATION_SECRET || process.env.QR_SIGNATURE_SECRET || "";
}

/** "merchantId.signature" — HMAC-SHA256 du merchantId, base64url. */
export function signImpersonationToken(merchantId: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(merchantId).digest("base64url");
  return `${merchantId}.${sig}`;
}

export function verifyImpersonationToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const merchantId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret()).update(merchantId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return merchantId;
}

export type SessionRole = "admin" | "merchant" | null;

export interface EffectiveMerchantArgs {
  sessionRole: SessionRole;
  ownMerchantId: string | null;
  impersonatedMerchantId: string | null; // déjà vérifié HMAC
  impersonatedExists: boolean;
}

export function resolveEffectiveMerchantId(a: EffectiveMerchantArgs): string | null {
  if (a.sessionRole === "admin" && a.impersonatedMerchantId && a.impersonatedExists) {
    return a.impersonatedMerchantId;
  }
  return a.ownMerchantId;
}
