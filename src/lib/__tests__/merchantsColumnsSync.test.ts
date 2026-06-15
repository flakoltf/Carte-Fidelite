import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// GARDE DE DRIFT SCHÉMA ↔ CODE (table merchants).
//
// Leçon du hotfix 15.06 : F1 a été mergée avec une migration INCOMPLÈTE — le
// code lisait merchants.phone alors que la migration ne créait que reward_label
// + business_hours. La requête échouait (42703), masquée par un front qui
// avalait l'erreur → faux « page d'inscription pas prête ».
//
// Ce test STATIQUE (zéro DB, comme auditActionsSync pour les AuditAction) :
//   1. dérive l'ensemble des colonnes `merchants` DÉFINIES par les migrations
//      (CREATE TABLE merchants + tous les ALTER TABLE merchants ADD COLUMN) ;
//   2. extrait l'ensemble des colonnes `merchants` LUES par le code
//      (tout `.from("merchants").select("…")`) ;
//   3. exige lues ⊆ définies. Une colonne lue mais non créée fait échouer la CI
//      AVANT le merge — exactement le drift qui a causé le bug.

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SRC_DIR = join(ROOT, "src");

// Mots-clés de définition de table qui ne sont PAS des noms de colonnes.
const NON_COLUMN = new Set([
  "primary",
  "unique",
  "check",
  "constraint",
  "foreign",
  "references",
  "like",
]);

// Retire les commentaires SQL de LIGNE — un `;` dans un commentaire
// (« Borné 1-80 ; … ») tronquerait sinon une instruction ALTER multi-lignes et
// masquerait des colonnes (cas réel dans la migration F1). On ne touche PAS aux
// blocs /* */ : un bloc mal apparié sur l'ensemble concaténé effacerait du vrai
// SQL d'un fichier à l'autre.
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

function allMigrationSql(): string {
  return stripSqlComments(
    readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
      .join("\n")
  );
}

function definedMerchantColumns(sql: string): Set<string> {
  const cols = new Set<string>();

  // 1. CREATE TABLE [IF NOT EXISTS] [public.]merchants ( … )
  const createRe = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?merchants\s*\(([\s\S]*?)\n\s*\)\s*;/gi;
  for (const m of sql.matchAll(createRe)) {
    for (const rawLine of m[1].split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("--")) continue;
      const id = /^"?([a-z_][a-z0-9_]*)"?/i.exec(line)?.[1]?.toLowerCase();
      if (id && !NON_COLUMN.has(id)) cols.add(id);
    }
  }

  // 2. ALTER TABLE [public.]merchants … ADD COLUMN [IF NOT EXISTS] <name>
  //    (une seule instruction peut enchaîner plusieurs ADD COLUMN).
  const alterRe = /ALTER TABLE\s+(?:public\.)?merchants\b([\s\S]*?);/gi;
  for (const m of sql.matchAll(alterRe)) {
    const body = m[1];
    const addRe = /ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
    for (const a of body.matchAll(addRe)) cols.add(a[1].toLowerCase());
  }

  return cols;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// Récolte tout `.from("merchants").select("col, col, …")` et renvoie, par
// fichier, l'ensemble des colonnes simples lues (alias/expressions ignorés).
function readMerchantColumns(): { file: string; columns: string[] }[] {
  const selectRe = /\.from\(\s*["'`]merchants["'`]\s*\)\s*\.select\(\s*["'`]([^"'`]+)["'`]/g;
  const results: { file: string; columns: string[] }[] = [];
  for (const file of walk(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const m of content.matchAll(selectRe)) {
      const columns = m[1]
        .split(",")
        .map((c) => c.trim())
        .filter((c) => /^[a-z_][a-z0-9_]*$/i.test(c)) // colonnes simples uniquement
        .map((c) => c.toLowerCase());
      if (columns.length) results.push({ file: file.replace(ROOT + "/", ""), columns });
    }
  }
  return results;
}

describe("merchants — cohérence schéma (migrations) ↔ colonnes lues (code)", () => {
  const defined = definedMerchantColumns(allMigrationSql());

  it("le parseur retrouve au moins les colonnes connues (sanity)", () => {
    for (const c of ["id", "shop_name", "email", "slug", "reward_label", "business_hours", "phone"]) {
      expect(defined.has(c), `colonne ${c} introuvable dans les migrations`).toBe(true);
    }
  });

  it("trouve au moins un SELECT merchants dans le code (sanity du scanner)", () => {
    expect(readMerchantColumns().length).toBeGreaterThan(0);
  });

  it("toute colonne merchants lue par le code existe dans les migrations", () => {
    const offenders: string[] = [];
    for (const { file, columns } of readMerchantColumns()) {
      for (const col of columns) {
        if (!defined.has(col)) offenders.push(`${col}  (lu dans ${file})`);
      }
    }
    expect(
      offenders,
      `Colonnes merchants lues par le code mais ABSENTES des migrations ` +
        `(drift schéma — ajouter une migration ADD COLUMN avant merge) :\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });
});
