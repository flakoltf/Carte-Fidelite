// Export CSV (pur, testé) — utilisé par les exports admin, tous audités
// DATA_EXPORTED. Échappement RFC 4180 + neutralisation des formules tableur.

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralise l'injection de formule (=, +, -, @) à l'ouverture dans Excel/Sheets.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return `﻿${lines.join("\r\n")}\r\n`; // BOM : accents corrects dans Excel
}
