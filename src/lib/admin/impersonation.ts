import crypto from "crypto";
import { cookies } from "next/headers";

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

export const IMPERSONATION_COOKIE = "imp_mid";

/** Lit + vérifie le cookie. Renvoie le merchantId impersonné ou null. */
export async function readImpersonationCookie(): Promise<string | null> {
  const store = await cookies();
  return verifyImpersonationToken(store.get(IMPERSONATION_COOKIE)?.value);
}

/** Pose le cookie signé (à appeler dans un route handler). */
export async function setImpersonationCookie(merchantId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, signImpersonationToken(merchantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 h
  });
}

export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
