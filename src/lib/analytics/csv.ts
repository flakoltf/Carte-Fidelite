function cell(v: string | number): string {
  // Les nombres ne sont jamais des formules (évite de casser ex. les négatifs).
  if (typeof v === "number") return String(v);
  // Anti formula-injection : une chaîne commençant par = + - @ (ou tab/CR) serait
  // interprétée comme une formule par Excel/LibreOffice → on la préfixe d'une apostrophe.
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
}

/**
 * Réponse HTTP d'export CSV — corps généré par `toCsv` (échappement +
 * anti-formula-injection inclus) et en-têtes de téléchargement standard.
 * `filename` est le nom de fichier complet (extension `.csv` comprise).
 */
export function csvResponse(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): Response {
  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
