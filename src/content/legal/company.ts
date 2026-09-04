// ────────────────────────────────────────────────────────────────────────
// SOURCE UNIQUE des informations société / légales du site HALO.
//
// Les pages légales (confidentialité, mentions légales, CGU, CGV, cookies,
// contact) lisent ces valeurs. Remplis les champs `null` UNE SEULE FOIS, dès
// que la raison individuelle est enregistrée (IDE obtenu) — toutes les pages
// se mettront à jour automatiquement.
//
// Tant qu'un champ vaut `null`, il apparaît en surbrillance « à compléter »
// sur le site → la politique de confidentialité n'est PAS soumissible en
// l'état à Google / Samsung.
// ────────────────────────────────────────────────────────────────────────

export const company = {
  raisonSociale: "HALOCARD - Letaief", // raison sociale officielle (registre du commerce)
  formeJuridique: "Raison individuelle",
  adresse: "Genève", // ⚠️ pas de rue+numéro fournis — à préciser si nécessaire
  npa: "1223",
  localite: "Cologny",
  pays: "Suisse",
  ide: "CHE-242.720.495" as string | null,
  emailContact: "contact@halocard.ch", // domaine halocard.ch acquis (juin 2026)
  emailDpo: "contact@halocard.ch",
  telephone: "+41 79 939 24 69",
  responsablePublication: "HALOCARD - Letaief",
  siteWeb: "https://halocard.ch" as string | null,
  dateMaj: "4 septembre 2026",
};

// Correspondance jeton ([…] dans les .md) → champ + libellé pour le marqueur.
const FIELDS: { token: string; value: string | null; label: string }[] = [
  { token: "[HALO — RAISON SOCIALE]", value: company.raisonSociale, label: "raison sociale" },
  { token: "[FORME JURIDIQUE]", value: company.formeJuridique, label: "forme juridique" },
  { token: "[ADRESSE COMPLÈTE]", value: company.adresse, label: "adresse" },
  { token: "[NPA]", value: company.npa, label: "NPA" },
  { token: "[LOCALITÉ]", value: company.localite, label: "localité" },
  { token: "[IDE]", value: company.ide, label: "IDE" },
  { token: "[EMAIL DE CONTACT]", value: company.emailContact, label: "email de contact" },
  { token: "[EMAIL PROTECTION DONNÉES]", value: company.emailDpo, label: "email protection des données" },
  { token: "[TÉLÉPHONE]", value: company.telephone, label: "téléphone" },
  { token: "[Prénom Nom]", value: company.responsablePublication, label: "responsable de publication" },
  { token: "[SITE WEB]", value: company.siteWeb, label: "site web" },
  { token: "[DATE DE DERNIÈRE MISE À JOUR]", value: company.dateMaj, label: "date de mise à jour" },
];

/**
 * Remplace les jetons `[…]` des documents par les valeurs de `company`.
 * Les champs non renseignés deviennent un marqueur `⟦à compléter : … ⟧`
 * que le renderer Markdown affiche en surbrillance ambre.
 */
export function fillPlaceholders(md: string): string {
  let out = md;
  for (const { token, value, label } of FIELDS) {
    const replacement = value ?? `⟦à compléter : ${label}⟧`;
    out = out.split(token).join(replacement);
  }
  return out;
}

/** Y a-t-il encore des champs à compléter ? (utilisé pour un bandeau d'alerte) */
export const hasMissingInfo = FIELDS.some((f) => f.value == null);
