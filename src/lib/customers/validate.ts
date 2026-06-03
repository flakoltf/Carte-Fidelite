const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}\s'-]{2,100}$/u;
const PHONE_RE = /^[0-9+()\s-]{4,30}$/;

export type CustomerUpdateInput = { fullName?: unknown; email?: unknown; phone?: unknown };
export type ValidatedCustomerUpdate = { fullName?: string; email?: string; phone?: string | null };

export type ValidateResult =
  | { ok: true; value: ValidatedCustomerUpdate }
  | { ok: false; error: string };

export function validateCustomerUpdate(input: CustomerUpdateInput): ValidateResult {
  const value: ValidatedCustomerUpdate = {};

  if (input.fullName !== undefined) {
    if (typeof input.fullName !== "string") return { ok: false, error: "Nom invalide" };
    const name = input.fullName.trim();
    if (!NAME_RE.test(name)) return { ok: false, error: "Nom invalide" };
    value.fullName = name;
  }

  if (input.email !== undefined) {
    if (typeof input.email !== "string") return { ok: false, error: "Email invalide" };
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Email invalide" };
    value.email = email;
  }

  if (input.phone !== undefined) {
    if (typeof input.phone !== "string") return { ok: false, error: "Téléphone invalide" };
    const phone = input.phone.trim();
    if (phone === "") {
      value.phone = null;
    } else if (!PHONE_RE.test(phone)) {
      return { ok: false, error: "Téléphone invalide" };
    } else {
      value.phone = phone;
    }
  }

  if (Object.keys(value).length === 0) return { ok: false, error: "Aucune modification" };
  return { ok: true, value };
}
