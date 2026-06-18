// Logique pure du pavé numérique CHF (<AmountPad>). Saisie « décimale » à la
// suisse : on tape la partie entière, une virgule, puis au plus 2 centimes.
// L'entrée est une chaîne brute (chiffres + une seule virgule) ; l'affichage et
// le montant numérique en dérivent. Testable sans DOM.

export const MAX_CHF = 9999.95;

export type AmountKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "back";

// Disposition 3×4 : 1-9, puis virgule · 0 · effacer.
export const KEYPAD_ROWS: ReadonlyArray<ReadonlyArray<AmountKey>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [",", "0", "back"],
];

export function entryToChf(entry: string): number {
  if (!entry) return 0;
  const n = parseFloat(entry.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Applique une touche à l'entrée courante, en respectant : une seule virgule,
// au plus 2 décimales, pas de zéro initial superflu, plafond MAX_CHF.
export function applyKey(entry: string, key: AmountKey): string {
  if (key === "back") return entry.slice(0, -1);

  if (key === ",") {
    if (entry.includes(",")) return entry;
    return entry === "" ? "0," : entry + ",";
  }

  let candidate: string;
  if (entry.includes(",")) {
    const dec = entry.split(",")[1] ?? "";
    if (dec.length >= 2) return entry; // déjà 2 centimes
    candidate = entry + key;
  } else {
    // évite « 05 » : un « 0 » seul est remplacé par le chiffre tapé.
    candidate = entry === "0" ? key : entry + key;
  }

  if (entryToChf(candidate) > MAX_CHF) return entry; // plafond
  return candidate;
}

// Affichage suisse : « CHF 12.— » (sans centimes) ou « CHF 12.50 ». Calculé sur
// le montant numérique (centimes entiers) pour éviter les artefacts flottants.
export function displayChf(chf: number): string {
  const totalCents = Math.round(chf * 100);
  const fr = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  return cents === 0 ? `CHF ${fr}.—` : `CHF ${fr}.${String(cents).padStart(2, "0")}`;
}
