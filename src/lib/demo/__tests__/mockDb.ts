import { DEMO_EMAIL, DEMO_SLUG } from "../constants";

// Mock supabase-like minimal pour tester purge/reset/seed sans réseau.
// Enregistre chaque opération terminale dans `calls` et résout des données
// configurables. Couvre uniquement les chaînes utilisées par src/lib/demo.

export interface Call {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: Record<string, unknown>;
}

export interface MockState {
  /** Marchand renvoyé par .from("merchants").select(...).eq("slug",…).maybeSingle() (ou null). */
  merchant: { id: string; slug: string; email: string; role: string } | null;
  /** Cartes renvoyées par .from("loyalty_cards").select("id").eq("merchant_id",…). */
  cards: { id: string }[];
}

export function demoMerchantRow(over: Partial<MockState["merchant"]> = {}) {
  return { id: "m-demo", slug: DEMO_SLUG, email: DEMO_EMAIL, role: "merchant", ...over };
}

export function makeDb(state: MockState) {
  const calls: Call[] = [];
  let custSeq = 0;
  let cardSeq = 0;

  function resolve(ctx: Call): { data: unknown; error: null } {
    if (ctx.op === "select" && ctx.table === "merchants") {
      return { data: state.merchant, error: null };
    }
    if (ctx.op === "select" && ctx.table === "loyalty_cards") {
      return { data: state.cards, error: null };
    }
    if (ctx.op === "insert" && ctx.table === "customers") {
      return { data: { id: `cust-${++custSeq}` }, error: null };
    }
    if (ctx.op === "insert" && ctx.table === "loyalty_cards") {
      return { data: { id: `card-${++cardSeq}` }, error: null };
    }
    if (ctx.op === "insert" && ctx.table === "merchants") {
      return { data: { id: "m-demo" }, error: null };
    }
    return { data: null, error: null };
  }

  // Retour `any` : test double assignable au type strict DemoDb des fonctions
  // testées (les __tests__ autorisent `any`).
  function from(table: string): any {
    const ctx: Call = { table, op: "select", filters: {} };
    const builder: Record<string, unknown> = {
      select(cols?: string) { void cols; return builder; },
      insert(p: unknown) { ctx.op = "insert"; ctx.payload = p; return builder; },
      update(p: unknown) { ctx.op = "update"; ctx.payload = p; return builder; },
      delete() { ctx.op = "delete"; return builder; },
      eq(c: string, v: unknown) { ctx.filters[c] = v; return builder; },
      in(c: string, v: unknown) { ctx.filters[c] = { in: v }; return builder; },
      maybeSingle() { calls.push(ctx); return Promise.resolve(resolve(ctx)); },
      single() { calls.push(ctx); return Promise.resolve(resolve(ctx)); },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        calls.push(ctx);
        return Promise.resolve(resolve(ctx)).then(res, rej);
      },
    };
    return builder;
  }

  return { from, calls };
}

export function makeAuthAdmin(opts: { createError?: boolean } = {}) {
  const calls = { createUser: [] as unknown[], deleteUser: [] as string[] };
  return {
    calls,
    createUser: async (input: unknown) => {
      calls.createUser.push(input);
      if (opts.createError) return { data: { user: null }, error: { message: "boom" } };
      return { data: { user: { id: "user-demo-new" } }, error: null };
    },
    deleteUser: async (id: string) => {
      calls.deleteUser.push(id);
      return { data: {}, error: null };
    },
  };
}
