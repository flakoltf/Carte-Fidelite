// Masquage des données personnelles avant journalisation (RGPD — roadmap I3).
// Ne JAMAIS logger emails/noms/téléphones en clair dans les logs applicatifs.

const MASK = "***";

/** john.doe@example.com -> j***@e***.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return MASK;
  const local = email[0];
  const domain = email.slice(at + 1);
  const dot = domain.indexOf(".");
  if (dot < 1) return MASK;
  const tld = domain.slice(dot); // ".com", ".co.uk"...
  return `${local}${MASK}@${domain[0]}${MASK}${tld}`;
}

/** John Doe -> J*** D*** */
export function maskName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return MASK;
  return words.map((w) => `${w[0]}${MASK}`).join(" ");
}

/** +41791234567 -> +41********* (garde les 3 premiers caractères) */
export function maskPhone(phone: string): string {
  if (phone.length <= 3) return MASK;
  return phone.slice(0, 3) + "*".repeat(phone.length - 3);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Masque les emails présents dans une chaîne de texte libre (message d'erreur, log…). */
export function redactPIIString(s: string): string {
  return s.replace(EMAIL_RE, (m) => maskEmail(m));
}

function maskByKey(key: string, value: string): string {
  const k = key.toLowerCase();
  if (k.includes("email")) return maskEmail(value);
  if (k.includes("phone")) return maskPhone(value);
  if (k.includes("name")) return maskName(value);
  return MASK;
}

/**
 * Copie en masquant les valeurs des clés sensibles (email/nom/téléphone),
 * récursivement. N'altère jamais l'objet d'origine.
 */
export function redactPII<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redactPII(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = typeof v === "string" && isSensitiveKey(k) ? maskByKey(k, v) : redactPII(v);
    }
    return out as T;
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("email") || k.includes("phone") || k.includes("name");
}
