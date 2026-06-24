// Allowlist STRICTE du kit de démonstration multi-marchand.
//
// La garde mono-compte (constants.ts / identity.ts → `assertDemoMerchant`)
// protège l'unique « Boulangerie Démo ». Le kit de prospection pilote SIX
// marchands démo : on étend donc la garde à une allowlist d'identités réservées
// (slug + email @example.com), vérifiées présentes en prod (role=merchant,
// managed_by_concierge). Toute ligne marchand HORS de cette liste → DemoGuardError,
// jamais réécrite. C'est l'unique porte avant chaque write du seed du kit.

import { DemoGuardError, type DemoMerchantRow } from "./identity";

export type DemoIdentity = { slug: string; email: string };

// Les 6 comptes démo réservés. Slugs = ceux réellement matérialisés en base
// (auto-générés depuis le nom : « salon-lumi-re », « boulangerie-des-p-quis »…).
// L'email reste @example.com (jamais adressable) — double défense.
export const DEMO_KIT_ALLOWLIST: readonly DemoIdentity[] = [
  { slug: "demo", email: "demo@example.com" }, // Café du Rhône
  { slug: "boulangerie-des-p-quis", email: "demo-boulangerie@example.com" }, // Boulangerie des Pâquis
  { slug: "pizzeria-molino", email: "demo-pizzeria@example.com" }, // Pizzeria Molino
  { slug: "salon-lumi-re", email: "demo-salon@example.com" }, // Salon Lumière
  { slug: "institut-belle-rive", email: "demo-institut@example.com" }, // Institut Belle Rive
  { slug: "boulangerie-demo", email: "boulangerie-demo@example.com" }, // Boulangerie Démo (compte garde existant)
] as const;

export function isExampleEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith("@example.com"));
}

// Entrée d'allowlist correspondant EXACTEMENT à la ligne : le slug ET l'email
// doivent appartenir au MÊME couple réservé (jamais un appariement croisé). null
// si la ligne n'est pas un marchand démo réservé.
export function findAllowlistEntry(row: DemoMerchantRow | null | undefined): DemoIdentity | null {
  if (!row || !row.slug || !row.email) return null;
  return DEMO_KIT_ALLOWLIST.find((e) => e.slug === row.slug && e.email === row.email) ?? null;
}

// Porte stricte du kit, à appeler AVANT toute écriture : la ligne doit être un
// couple (slug, email) de l'allowlist, email @example.com, role marchand. Sinon
// throw — aucune écriture sur un marchand non réservé (mirror d'assertDemoMerchant
// mais pour la flotte). Réutilise DemoGuardError pour des codes HTTP cohérents.
export function assertDemoKitMerchant(
  row: DemoMerchantRow | null | undefined,
): asserts row is DemoMerchantRow {
  if (!row) throw new DemoGuardError("Marchand démo introuvable", "not_found");
  const entry = findAllowlistEntry(row);
  if (!entry) {
    throw new DemoGuardError(
      `Refus : (slug « ${row.slug ?? "?"} », email « ${row.email ?? "?"} ») hors allowlist démo`,
      "mismatch",
    );
  }
  if (!isExampleEmail(row.email)) {
    throw new DemoGuardError(`Refus : email « ${row.email ?? "?"} » n'est pas @example.com`, "mismatch");
  }
  if (row.role !== "merchant") {
    throw new DemoGuardError(`Refus : rôle « ${row.role ?? "?"} » n'est pas un marchand`, "mismatch");
  }
}
