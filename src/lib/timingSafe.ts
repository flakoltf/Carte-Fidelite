import crypto from "crypto";

// Comparaison de chaînes en temps constant (timing-safe).
// Retourne false si l'une est vide ou si les longueurs diffèrent (la longueur peut
// fuiter, mais pas le contenu du secret). À utiliser pour comparer des secrets/tokens.
export function timingSafeEqualStr(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
