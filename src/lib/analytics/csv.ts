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
