// Construit l'en-tête « De » au format « Nom de la boutique <adresse-plateforme> »
// (modèle B) : le client voit le nom du commerçant, l'adresse technique reste
// celle de la plateforme (domaine vérifié sur Resend).

/** Extrait l'adresse email d'une base type "TonApp <noreply@x.ch>" ou "noreply@x.ch". */
function extractAddress(base: string): string {
  const m = base.match(/<([^>]+)>/);
  return (m ? m[1] : base).trim();
}

/** Retire les caractères qui casseraient l'en-tête (chevrons, guillemets, retours ligne). */
function cleanName(name: string): string {
  return name.replace(/["<>\r\n]/g, "").trim();
}

export function formatSender(displayName: string, baseFrom: string): string {
  const address = extractAddress(baseFrom);
  const name = cleanName(displayName);
  if (!name) return address;
  // Une virgule dans le nom impose des guillemets (RFC 5322).
  return name.includes(",") ? `"${name}" <${address}>` : `${name} <${address}>`;
}
