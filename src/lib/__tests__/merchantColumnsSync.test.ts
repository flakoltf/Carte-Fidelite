import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Piège connu (leçon F1) : du code qui lit merchants.<col> mergé sans la migration
// jumelle qui crée la colonne. Ça « marche » en prod (colonne ajoutée à la main)
// mais casse en staging / CI / local où le schéma vient des migrations.
// Ce test SELECT chaque colonne de `merchants` lue par le code et vérifie qu'une
// migration la crée — exactement comme auditActionsSync garde le CHECK des AuditAction.

const MIGRATIONS = join(__dirname, "../../../supabase/migrations");
const SRC = join(__dirname, "../..");

// Retire les commentaires SQL (`-- …`) : ils peuvent contenir des « ; » qui
// tronqueraient la lecture des instructions ALTER/CREATE.
const stripSqlComments = (sql: string): string => sql.replace(/--[^\n]*/g, "");

// Colonnes de `merchants` définies par les migrations (CREATE TABLE + ALTER … ADD COLUMN).
function merchantsColumnsFromMigrations(): Set<string> {
  const cols = new Set<string>();
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const sql = stripSqlComments(readFileSync(join(MIGRATIONS, f), "utf8"));

    const create = sql.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?merchants\s*\(([\s\S]*?)\n\)\s*;/i);
    if (create) {
      for (const line of create[1].split("\n")) {
        const t = line.trim();
        if (!t || /^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK)\b/i.test(t)) continue;
        const m = t.match(/^"?([a-z_][a-z0-9_]*)"?\b/i);
        if (m) cols.add(m[1]);
      }
    }

    const alterRe = /ALTER TABLE\s+(?:public\.)?merchants\b([\s\S]*?);/gi;
    let a: RegExpExecArray | null;
    while ((a = alterRe.exec(sql))) {
      const colRe = /ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
      let c: RegExpExecArray | null;
      while ((c = colRe.exec(a[1]))) cols.add(c[1]);
    }
  }
  return cols;
}

// Colonnes de `merchants` lues par le code : tout `from("merchants").select("…")`.
function merchantsColumnsReadByCode(): { col: string; file: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return e === "__tests__" || e === "node_modules" ? [] : walk(p);
      return /\.tsx?$/.test(e) ? [p] : [];
    });

  const out: { col: string; file: string }[] = [];
  for (const file of walk(SRC)) {
    const code = readFileSync(file, "utf8");
    const fromRe = /from\(\s*["']merchants["']\s*\)/g;
    let fm: RegExpExecArray | null;
    while ((fm = fromRe.exec(code))) {
      // `.select(…)` suit toujours `.from(…)` côté supabase-js ; fenêtre généreuse pour le multi-ligne.
      const sel = code.slice(fm.index, fm.index + 600).match(/\.select\(\s*[`"']([^`"']*)[`"']/);
      if (!sel) continue;
      for (let tok of sel[1].split(",")) {
        tok = tok.trim();
        if (!tok || tok === "*" || tok.includes("(")) continue; // ignore `*` et les relations imbriquées
        tok = tok.includes(":") ? tok.split(":").pop()!.trim() : tok; // alias:colonne
        if (/^[a-z_][a-z0-9_]*$/i.test(tok)) out.push({ col: tok, file: file.slice(file.indexOf("src/")) });
      }
    }
  }
  return out;
}

describe("synchronisation colonnes merchants ↔ migrations", () => {
  it("toute colonne merchants lue par le code est créée par une migration", () => {
    const schema = merchantsColumnsFromMigrations();
    expect(schema.size).toBeGreaterThan(0);

    for (const { col, file } of merchantsColumnsReadByCode()) {
      expect(
        schema.has(col),
        `merchants.${col} est lu dans ${file} mais aucune migration ne le crée — ajouter une migration jumelle (ALTER TABLE merchants ADD COLUMN IF NOT EXISTS ${col} …).`,
      ).toBe(true);
    }
  });
});
