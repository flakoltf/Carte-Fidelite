import crypto from "node:crypto";
import { timingSafeEqualStr } from "@/lib/timingSafe";
import { UUID_RE } from "@/lib/validation/uuid";

// Jetons signés des liens de consentement (confirmation double opt-in et
// désinscription en un clic). Modèle : signQRCode (HMAC-SHA256 complet), mais
// avec un secret DÉDIÉ — CONSENT_TOKEN_SECRET — pour qu'une fuite d'un lien
// email ne dise rien sur les QR des cartes, et inversement.
//
// Format : base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
//   payload = { c: customerId, m: merchantId, a: "confirm"|"unsubscribe", exp? }
//
// Règles :
//   - JAMAIS d'enrollment_token, d'email ni de secret dans le payload ;
//   - confirm expire (7 jours) ; unsubscribe n'expire jamais (un client doit
//     pouvoir se désinscrire depuis un vieil email) ;
//   - l'action est liée au jeton : un lien de confirmation ne désinscrit pas ;
//   - le secret est lu à l'appel (pas à l'import) : l'absence de variable ne
//     doit pas faire planter l'enrôlement, seulement l'émission du lien.

export type ConsentAction = "confirm" | "unsubscribe";

export interface ConsentTokenPayload {
  customerId: string;
  merchantId: string;
  action: ConsentAction;
  /** Expiration en ms epoch. Absent = sans expiration. */
  exp?: number;
}

export type ConsentTokenVerdict =
  | { valid: true; customerId: string; merchantId: string }
  | { valid: false; reason: "malformed" | "signature" | "expired" | "action" };

export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface WirePayload {
  c: string;
  m: string;
  a: ConsentAction;
  exp?: number;
}

function secret(): string {
  const s = process.env.CONSENT_TOKEN_SECRET;
  if (!s) throw new Error("CONSENT_TOKEN_SECRET is required to sign consent links. Set it in your environment.");
  return s;
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signConsentToken(p: ConsentTokenPayload): string {
  const wire: WirePayload = { c: p.customerId, m: p.merchantId, a: p.action };
  if (p.exp !== undefined) wire.exp = p.exp;
  const payload = Buffer.from(JSON.stringify(wire)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/** Décode le payload SANS vérifier la signature — diagnostic/tests uniquement. */
export function decodeConsentPayload(token: string): WirePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0]) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as WirePayload;
  } catch {
    return null;
  }
}

export function verifyConsentToken(
  token: string,
  expectedAction: ConsentAction,
  now: number = Date.now(),
): ConsentTokenVerdict {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false, reason: "malformed" };
  const [payload, sig] = parts;

  if (!timingSafeEqualStr(sig, hmac(payload))) return { valid: false, reason: "signature" };

  const wire = decodeConsentPayload(token);
  if (!wire || typeof wire.c !== "string" || typeof wire.m !== "string") return { valid: false, reason: "malformed" };
  if (!UUID_RE.test(wire.c) || !UUID_RE.test(wire.m)) return { valid: false, reason: "malformed" };
  if (wire.a !== expectedAction) return { valid: false, reason: "action" };
  if (wire.exp !== undefined && (typeof wire.exp !== "number" || now > wire.exp)) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, customerId: wire.c, merchantId: wire.m };
}

export interface ConsentIds {
  customerId: string;
  merchantId: string;
}

export function confirmToken(ids: ConsentIds, now: number = Date.now()): string {
  return signConsentToken({ ...ids, action: "confirm", exp: now + CONFIRM_TTL_MS });
}

export function unsubscribeToken(ids: ConsentIds): string {
  return signConsentToken({ ...ids, action: "unsubscribe" });
}
