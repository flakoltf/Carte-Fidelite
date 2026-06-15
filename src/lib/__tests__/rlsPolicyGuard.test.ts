import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ════════════════════════════════════════════════════════════════════════════
// GARDE STRUCTUREL RLS (couche 1 — isolation multi-tenant)
//
// La RLS (Row Level Security) est la colonne vertébrale de l'isolation entre
// commerçants : sans elle, le Café du Rhône pourrait lire les clients du Salon
// Lumière. Le danger est qu'une policy se casse SILENCIEUSEMENT — une migration
// qui oublie d'activer la RLS sur une nouvelle table, ou qui supprime une policy
// sans la recréer, ne fait PAS planter le build.
//
// Ce test scanne les migrations et vérifie que chaque table sensible a bien la
// posture de sécurité attendue, déclarée explicitement ci-dessous. Il NE teste
// PAS le comportement à l'exécution (ça, c'est la couche 2, sur vraie base) —
// il garantit que les serrures EXISTENT et sont du bon type.
//
// 🔒 Règle d'or : toute nouvelle table en migration DOIT être déclarée dans
// TABLE_REGISTRY (sinon ce test échoue), ce qui force une décision de sécurité
// consciente plutôt qu'un oubli.
// ════════════════════════════════════════════════════════════════════════════

type Posture =
  | "tenant" // isolée par merchant_id (cœur multi-tenant)
  | "own-row" // chaque user ne voit que SA ligne (par user_id)
  | "admin" // back-office plateforme : lecture is_admin() uniquement
  | "deny-all"; // RLS activée SANS policy → personne via l'API, écrite par le service-role

// Source de vérité de la posture RLS attendue par table. Tenir à jour à CHAQUE
// nouvelle table (le test l'exige). Sert aussi de documentation du modèle.
const TABLE_REGISTRY: Record<string, Posture> = {
  // ── Tenant : isolation stricte par merchant_id ──────────────────────────
  customers: "tenant",
  loyalty_cards: "tenant",
  scan_history: "tenant",
  audit_logs: "tenant",
  campaigns: "tenant",
  wallet_notifications: "tenant",
  wallet_device_registrations: "tenant",
  billing_snapshots: "tenant",
  // ── Le compte marchand lui-même ─────────────────────────────────────────
  merchants: "own-row",
  // ── Back-office : lecture réservée aux admins (is_admin) ────────────────
  card_designs: "admin", // lecture admin ; écritures marchandes via service-role filtré
  leads: "admin",
  admin_notes: "admin",
  cron_runs: "admin",
  feature_flags: "admin",
  platform_settings: "admin",
  // ── Deny-all : RLS activée, aucune policy (écriture service-role/cron) ───
  campaign_sends: "deny-all",
};

const MIGRATIONS_DIR = join(__dirname, "../../../supabase/migrations");

// Retire les commentaires SQL pour ne jamais compter une directive désactivée :
// un `-- ALTER TABLE … ENABLE RLS` commenté NE protège rien, il ne doit pas
// satisfaire le garde.
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // blocs /* … */
    .replace(/--[^\n]*/g, " "); // lignes -- …
}

function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => stripSqlComments(readFileSync(join(MIGRATIONS_DIR, f), "utf8")))
    .join("\n");
}

const SQL = allMigrationsSql();

// Tables créées (CREATE TABLE [IF NOT EXISTS] [public.]nom).
function createdTables(sql: string): Set<string> {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi;
  const out = new Set<string>();
  for (const m of sql.matchAll(re)) out.add(m[1].toLowerCase());
  return out;
}

// Tables ayant ENABLE ROW LEVEL SECURITY.
function rlsEnabledTables(sql: string): Set<string> {
  const re = /alter\s+table\s+(?:public\.)?(\w+)\s+enable\s+row\s+level\s+security/gi;
  const out = new Set<string>();
  for (const m of sql.matchAll(re)) out.add(m[1].toLowerCase());
  return out;
}

// Corps de chaque CREATE POLICY, groupés par table (jusqu'au point-virgule).
function policyBodiesByTable(sql: string): Map<string, string[]> {
  const re = /create\s+policy\s+(?:"[^"]+"|\S+)\s+on\s+(?:public\.)?(\w+)([\s\S]*?);/gi;
  const out = new Map<string, string[]>();
  for (const m of sql.matchAll(re)) {
    const table = m[1].toLowerCase();
    const body = m[0].toLowerCase();
    if (!out.has(table)) out.set(table, []);
    out.get(table)!.push(body);
  }
  return out;
}

const CREATED = createdTables(SQL);
const RLS_ON = rlsEnabledTables(SQL);
const POLICIES = policyBodiesByTable(SQL);

describe("Garde RLS — registre ↔ migrations", () => {
  it("toute table créée en migration est déclarée dans TABLE_REGISTRY", () => {
    const undeclared = [...CREATED].filter((t) => !(t in TABLE_REGISTRY));
    expect(
      undeclared,
      `Tables non déclarées (posture RLS inconnue → ajouter à TABLE_REGISTRY) : ${undeclared.join(", ")}`
    ).toEqual([]);
  });

  it("toute table du registre existe réellement en migration (pas de table fantôme)", () => {
    const missing = Object.keys(TABLE_REGISTRY).filter((t) => !CREATED.has(t));
    expect(missing, `Tables au registre mais absentes des migrations : ${missing.join(", ")}`).toEqual([]);
  });
});

describe("Garde RLS — activation sur chaque table sensible", () => {
  for (const table of Object.keys(TABLE_REGISTRY)) {
    it(`${table} : ROW LEVEL SECURITY activée`, () => {
      expect(RLS_ON.has(table), `RLS NON activée sur ${table} (fuite potentielle)`).toBe(true);
    });
  }
});

describe("Garde RLS — présence et type de policy par posture", () => {
  for (const [table, posture] of Object.entries(TABLE_REGISTRY)) {
    const bodies = POLICIES.get(table) ?? [];

    if (posture === "deny-all") {
      it(`${table} : deny-all → RLS activée ET aucune policy (service-role uniquement)`, () => {
        expect(RLS_ON.has(table)).toBe(true);
        expect(bodies, `${table} devrait n'avoir AUCUNE policy (deny-all)`).toEqual([]);
      });
      continue;
    }

    it(`${table} : au moins une policy`, () => {
      expect(bodies.length, `${table} (${posture}) n'a aucune policy`).toBeGreaterThan(0);
    });

    if (posture === "tenant") {
      it(`${table} : une policy scope par merchant_id`, () => {
        expect(
          bodies.some((b) => b.includes("merchant_id")),
          `${table} (tenant) : aucune policy ne filtre par merchant_id`
        ).toBe(true);
      });
    }

    if (posture === "own-row") {
      it(`${table} : une policy scope par user_id`, () => {
        expect(bodies.some((b) => b.includes("user_id"))).toBe(true);
      });
    }

    if (posture === "admin") {
      it(`${table} : une policy réservée aux admins (is_admin)`, () => {
        expect(bodies.some((b) => b.includes("is_admin"))).toBe(true);
      });
    }
  }
});
