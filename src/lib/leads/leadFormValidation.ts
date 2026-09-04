// Validation serveur du formulaire public /demarrer — fonction pure (testée
// sans réseau). On ne fait JAMAIS confiance au client : liste de secteurs
// fermée, bornes sur chaque champ, honeypot anti-bots.

export const LEAD_SECTORS = [
  "Boulangerie",
  "Café-restaurant",
  "Coiffeur-beauté",
  "Boucherie-épicerie",
  "Fleuriste",
  "Autre",
] as const;

export type LeadSector = (typeof LEAD_SECTORS)[number];

const PLANS = new Set(["essentiel", "croissance", "premium"]);

// Pragmatique (pas RFC 5321 complet) : un @, pas d'espaces, un point dans le domaine.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Chiffres, espaces et ponctuation téléphonique usuelle (+ () / . -), 6 à 30 caractères.
const PHONE_RE = /^[0-9+()/.\-\s]{6,30}$/;

export type LeadFormError = "champs" | "email" | "telephone" | "message";

export interface LeadFormValue {
  business: string;
  sector: LeadSector;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  plan: string | null;
}

export type LeadFormResult =
  | { ok: true; value: LeadFormValue }
  | { ok: false; error: LeadFormError }
  | { ok: false; bot: true };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validateLeadForm(raw: Record<string, unknown>): LeadFormResult {
  // Honeypot : un humain ne voit pas ce champ ; rempli = bot.
  if (str(raw.website)) return { ok: false, bot: true };

  const business = str(raw.business);
  const sector = str(raw.sector);
  const contactName = str(raw.contactName);
  const email = str(raw.email).toLowerCase();
  const phone = str(raw.phone);
  const message = str(raw.message);
  const plan = str(raw.plan).toLowerCase();

  if (business.length < 2 || business.length > 120) return { ok: false, error: "champs" };
  if (!(LEAD_SECTORS as readonly string[]).includes(sector)) return { ok: false, error: "champs" };
  if (contactName.length < 2 || contactName.length > 160) return { ok: false, error: "champs" };
  if (!email) return { ok: false, error: "champs" };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "email" };
  if (phone && !PHONE_RE.test(phone)) return { ok: false, error: "telephone" };
  if (message.length > 1000) return { ok: false, error: "message" };

  return {
    ok: true,
    value: {
      business,
      sector: sector as LeadSector,
      contactName,
      email,
      phone: phone || null,
      message: message || null,
      plan: PLANS.has(plan) ? plan : null,
    },
  };
}
