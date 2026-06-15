import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Garde anti-drift schéma ↔ code (même esprit qu'auditActionsSync pour les
// AuditAction). Leçon du 2026-06-15 : F1 a été mergée avec merchants.phone LU
// par le code mais créé par AUCUNE migration (ajouté en hotfix prod) — un
// staging/CI reconstruit depuis les migrations cassait à l'émission des passes.
//
// Ce test échoue à la CI si une colonne `merchants` lue par un
// `.from("merchants").select("…")` n'est déclarée par aucune migration.
// Limites assumées : ne couvre que les SELECT littéraux sur `merchants`
// (les `select("*")` et les sélections dynamiques sont ignorés) ; c'est
// précisément le motif qui a laissé passer le drift `phone`.

const ROOT = join(__dirname, "../../..");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const SRC = join(ROOT, "src");

// Mots-clés de contrainte à ne pas confondre avec un nom de colonne dans le
// CREATE TABLE.
const NON_COLUMN = new Set([
  "primary", "constraint", "unique", "check", "foreign", "create", "table", "if", "not", "exists",
]);

// Les commentaires SQL peuvent contenir un « ; » (ex. « côté admin ; le … ») :
// on les retire avant de découper les statements, sinon une ALTER multi-colonnes
// est tronquée au point-virgule du commentaire.
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function declaredMerchantColumns(): Set<string> {
  const cols = new Set<string>();
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));

  for (const f of files) {
    const sql = stripSqlComments(readFileSync(join(MIGRATIONS, f), "utf8"));

    // 1. CREATE TABLE … merchants ( … ) — colonnes inline (init).
    const create = sql.match(/CREATE TABLE[^;]*?\bmerchants\s*\(([\s\S]*?)\);/i);
    if (create) {
      for (const rawLine of create[1].split("\n")) {
        const line = rawLine.trim().replace(/,$/, "");
        if (!line) continue;
        const first = line.split(/\s+/)[0]?.toLowerCase();
        if (first && /^[a-z_][a-z0-9_]*$/.test(first) && !NON_COLUMN.has(first)) {
          cols.add(first);
        }
      }
    }

    // 2. ALTER TABLE … merchants … ADD COLUMN [IF NOT EXISTS] <name> (toutes,
    //    y compris multi-colonnes dans un même statement).
    const alterRe = /ALTER TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?merchants\b([\s\S]*?);/gi;
    let m: RegExpExecArray | null;
    while ((m = alterRe.exec(sql)) !== null) {
      const addRe = /ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;
      let a: RegExpExecArray | null;
      while ((a = addRe.exec(m[1])) !== null) cols.add(a[1].toLowerCase());
    }
  }
  return cols;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ((p.endsWith(".ts") || p.endsWith(".tsx")) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

// Sélections littérales immédiatement chaînées à .from("merchants").
const SELECT_RE = /from\(\s*["']merchants["']\s*\)\s*\.select\(\s*(["'`])([\s\S]*?)\1/g;

function parseColumns(selectBody: string): string[] {
  return selectBody
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && t !== "*" && !t.includes("(") && !t.includes("$") && !t.includes("{"))
    // alias:colonne → colonne réelle ; colonne->json → racine.
    .map((t) => (t.includes(":") ? t.split(":").pop()! : t).split("->")[0].trim().toLowerCase())
    .filter((t) => /^[a-z_][a-z0-9_]*$/.test(t));
}

function readMerchantColumns(): { column: string; file: string }[] {
  const found: { column: string; file: string }[] = [];
  for (const file of walk(SRC)) {
    const content = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    SELECT_RE.lastIndex = 0;
    while ((m = SELECT_RE.exec(content)) !== null) {
      for (const col of parseColumns(m[2])) {
        found.push({ column: col, file: file.replace(ROOT + "/", "") });
      }
    }
  }
  return found;
}

describe("synchronisation schéma merchants ↔ code", () => {
  const declared = declaredMerchantColumns();
  const reads = readMerchantColumns();

  it("le parseur trouve un schéma et des lectures plausibles (non vacuité)", () => {
    expect(declared.size, "colonnes merchants déclarées par les migrations").toBeGreaterThan(10);
    expect(reads.length, "colonnes merchants lues par le code").toBeGreaterThan(10);
  });

  it("toute colonne merchants lue par le code est créée par une migration", () => {
    const orphans = reads.filter((r) => !declared.has(r.column));
    const detail = [...new Set(orphans.map((o) => `${o.column} (${o.file})`))].sort();
    expect(detail, "colonnes lues mais déclarées par AUCUNE migration").toEqual([]);
  });
});
