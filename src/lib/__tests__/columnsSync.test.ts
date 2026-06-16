import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// GARDE DE DRIFT SCHÉMA ↔ CODE — généralisation de merchantsColumnsSync.test.ts
// aux 5 autres tables sensibles (customers, loyalty_cards, scan_history,
// campaigns, audit_logs).
//
// Même principe que pour merchants (cf. le hotfix 15.06 où le code lisait
// merchants.phone avant que la migration ne crée la colonne → 42703 masqué) :
//   1. dériver l'ensemble des colonnes DÉFINIES par les migrations
//      (CREATE TABLE <t> + tous les ALTER TABLE <t> ADD COLUMN) ;
//   2. extraire l'ensemble des colonnes LUES par le code via
//      `.from("<t>").select("…")` (colonnes simples de PREMIER niveau ;
//      les relations imbriquées « customers(full_name) » sont retirées) ;
//   3. exiger lues ⊆ définies, sinon échec CI AVANT merge.
//
// Limite assumée (identique à merchantsColumnsSync) : seuls les `select("…")`
// à littéral inline sont scannés ; un `select(CONST)` (variable) n'est pas
// résolu. C'est un filet, pas une preuve exhaustive.

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SRC_DIR = join(ROOT, "src");

const TABLES = ["customers", "loyalty_cards", "scan_history", "campaigns", "audit_logs"] as const;

// Sanity : au moins une colonne connue par table doit être retrouvée par le
// parseur de migrations (sinon le CREATE TABLE n'a pas été capté → faux PASS).
const KNOWN_COLUMN: Record<(typeof TABLES)[number], string> = {
  customers: "merchant_id",
  loyalty_cards: "stamps_count",
  scan_history: "scanned_at",
  campaigns: "audience",
  audit_logs: "action",
};

// ALLOWLIST DE DRIFTS CONNUS — bugs latents documentés, tolérés par le garde
// le temps d'un correctif dédié et revu. Chaque entrée est AUTO-NETTOYANTE :
// si le drift disparaît (colonne créée OU lecture corrigée), le test
// « pas d'entrée périmée » échoue et force le retrait de l'entrée.
//
// ⚠️ loyalty_cards.email — BUG LATENT (révélé par ce garde, PR chore/db-hygiene).
//   src/lib/email/channel.ts lit `.from("loyalty_cards").select("email, …")`,
//   mais l'email est sur `customers` (loyalty_cards → customer_id → customers.email).
//   Conséquence : la requête échoue (42703), l'erreur est avalée, EmailChannel
//   renvoie { pushed: 0 } → AUCUN email envoyé aux clients sans Wallet (silencieux).
//   Correctif recommandé (PR dédiée, implications consentement nLPD/RGPD) :
//   lire `customers(email)` via le join au lieu de loyalty_cards.email.
const KNOWN_DRIFT: Record<(typeof TABLES)[number], Set<string>> = {
  customers: new Set(),
  loyalty_cards: new Set(["email"]),
  scan_history: new Set(),
  campaigns: new Set(),
  audit_logs: new Set(),
};

const NON_COLUMN = new Set([
  "primary",
  "unique",
  "check",
  "constraint",
  "foreign",
  "references",
  "like",
]);

// Retire les commentaires SQL de ligne (un `;` dans un commentaire tronquerait
// une instruction ALTER multi-lignes). On ne touche pas aux blocs /* */.
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

function definedColumns(sql: string, table: string): Set<string> {
  const cols = new Set<string>();

  // 1. CREATE TABLE [IF NOT EXISTS] [public.]<table> ( … ) ;
  //    \b après le nom évite que « loyalty_cards » matche « loyalty_cards_unique ».
  const createRe = new RegExp(
    `CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\s*\\)\\s*;`,
    "gi"
  );
  for (const m of sql.matchAll(createRe)) {
    for (const rawLine of m[1].split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("--")) continue;
      const id = /^"?([a-z_][a-z0-9_]*)"?/i.exec(line)?.[1]?.toLowerCase();
      if (id && !NON_COLUMN.has(id)) cols.add(id);
    }
  }

  // 2. ALTER TABLE [public.]<table> … ADD COLUMN [IF NOT EXISTS] <name>
  const alterRe = new RegExp(`ALTER TABLE\\s+(?:public\\.)?${table}\\b([\\s\\S]*?);`, "gi");
  for (const m of sql.matchAll(alterRe)) {
    const addRe = /ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
    for (const a of m[1].matchAll(addRe)) cols.add(a[1].toLowerCase());
  }

  return cols;
}

// Retire les relations imbriquées « [alias:]relname(...) » (PostgREST embeds) AVANT
// le split, sinon « customers » dans `.select("id, customers(full_name)")` serait
// pris pour une colonne de la table parente. Boucle pour gérer l'imbriqué.
function stripEmbeds(select: string): string {
  let prev: string;
  let out = select;
  do {
    prev = out;
    out = out.replace(/[\w:!.]*\([^()]*\)/g, "");
  } while (out !== prev);
  return out;
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

// Récolte tout `.from("<table>").select("…")` et renvoie, par fichier, les
// colonnes simples de premier niveau lues.
function readColumns(table: string): { file: string; columns: string[] }[] {
  const selectRe = new RegExp(
    `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)\\s*\\.select\\(\\s*["'\`]([^"'\`]+)["'\`]`,
    "g"
  );
  const results: { file: string; columns: string[] }[] = [];
  for (const file of walk(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const m of content.matchAll(selectRe)) {
      const columns = stripEmbeds(m[1])
        .split(",")
        .map((c) => c.trim())
        .filter((c) => /^[a-z_][a-z0-9_]*$/i.test(c)) // colonnes simples uniquement
        .map((c) => c.toLowerCase());
      if (columns.length) results.push({ file: file.replace(ROOT + "/", ""), columns });
    }
  }
  return results;
}

const MIGRATION_SQL = allMigrationSql();

describe.each(TABLES)("%s — cohérence schéma (migrations) ↔ colonnes lues (code)", (table) => {
  const defined = definedColumns(MIGRATION_SQL, table);

  it("le parseur retrouve une colonne connue (sanity)", () => {
    expect(
      defined.has(KNOWN_COLUMN[table]),
      `colonne ${KNOWN_COLUMN[table]} introuvable dans les migrations pour ${table}`
    ).toBe(true);
  });

  // Drifts bruts (colonne lue mais non définie), avant filtrage de l'allowlist.
  function rawDriftColumns(): { col: string; file: string }[] {
    const out: { col: string; file: string }[] = [];
    for (const { file, columns } of readColumns(table)) {
      for (const col of columns) if (!defined.has(col)) out.push({ col, file });
    }
    return out;
  }

  it("toute colonne lue par le code existe dans les migrations (hors drifts connus)", () => {
    const known = KNOWN_DRIFT[table];
    const offenders = rawDriftColumns()
      .filter((d) => !known.has(d.col))
      .map((d) => `${d.col}  (lu dans ${d.file})`);
    expect(
      offenders,
      `Colonnes ${table} lues par le code mais ABSENTES des migrations ` +
        `(drift schéma — ajouter une migration ADD COLUMN avant merge, ` +
        `ou inscrire dans KNOWN_DRIFT si bug latent documenté) :\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("l'allowlist KNOWN_DRIFT ne contient pas d'entrée périmée", () => {
    const stillDrifting = new Set(rawDriftColumns().map((d) => d.col));
    const stale = [...KNOWN_DRIFT[table]].filter((c) => !stillDrifting.has(c));
    expect(
      stale,
      `Entrées KNOWN_DRIFT périmées pour ${table} (le drift a disparu — ` +
        `RETIRER ces colonnes de l'allowlist) : ${stale.join(", ")}`
    ).toEqual([]);
  });
});
