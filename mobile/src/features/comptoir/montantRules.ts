// Logique pure du pavé numérique CHF (<PaveMontant>) — MIROIR des bornes du
// serveur (`POST /api/scan`, branche amount_points : montant > 0, ≤ 10 000,
// au plus 2 décimales) et de la saisie du comptoir web
// (`src/lib/comptoir/amountPad.ts`). Le mobile ne peut pas importer le code du
// web (projet séparé) ; cette copie est volontairement minuscule et testée avec
// les mêmes attentes. La décision finale reste au serveur : il revalide tout.
//
// Saisie « décimale » à la suisse : on tape la partie entière, une virgule,
// puis au plus 2 centimes. L'entrée est une chaîne brute (chiffres + une seule
// virgule) ; l'affichage et le montant numérique en dérivent.

/** Borne serveur (route /api/scan) : un montant au-delà est refusé en 400. */
export const MONTANT_MAX_CHF = 10_000;

export type ToucheMontant = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "back";

// Disposition 3×4 : 1-9, puis virgule · 0 · effacer (même pavé que le web).
export const LIGNES_PAVE: readonly (readonly ToucheMontant[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [",", "0", "back"],
];

export function saisieVersChf(saisie: string): number {
  if (!saisie) return 0;
  const n = parseFloat(saisie.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Le montant peut-il partir au serveur ? (> 0 — le plafond est déjà tenu à la saisie.) */
export function montantValide(chf: number): boolean {
  return chf > 0 && chf <= MONTANT_MAX_CHF;
}

// Applique une touche à l'entrée courante, en respectant : une seule virgule,
// au plus 2 décimales, pas de zéro initial superflu, plafond MONTANT_MAX_CHF.
export function appliquerTouche(saisie: string, touche: ToucheMontant): string {
  if (touche === "back") return saisie.slice(0, -1);

  if (touche === ",") {
    if (saisie.includes(",")) return saisie;
    return saisie === "" ? "0," : saisie + ",";
  }

  let candidate: string;
  if (saisie.includes(",")) {
    const dec = saisie.split(",")[1] ?? "";
    if (dec.length >= 2) return saisie; // déjà 2 centimes
    candidate = saisie + touche;
  } else {
    // évite « 05 » : un « 0 » seul est remplacé par le chiffre tapé.
    candidate = saisie === "0" ? touche : saisie + touche;
  }

  if (saisieVersChf(candidate) > MONTANT_MAX_CHF) return saisie; // plafond serveur
  return candidate;
}

// Affichage suisse : « CHF 12.— » (sans centimes) ou « CHF 12.50 ». Calculé sur
// le montant numérique (centimes entiers) pour éviter les artefacts flottants.
export function afficherChf(chf: number): string {
  const totalCents = Math.round(chf * 100);
  const fr = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  return cents === 0 ? `CHF ${fr}.—` : `CHF ${fr}.${String(cents).padStart(2, "0")}`;
}
