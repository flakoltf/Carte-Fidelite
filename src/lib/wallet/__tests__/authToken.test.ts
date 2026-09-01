import { beforeEach, describe, it, expect, vi } from "vitest";
import { clearCardMessage, parseApplePassAuth } from "@/lib/wallet/authToken";

// Enregistre la forme des requêtes supabase (update + filtres chaînés, thenable).
const updateCalls: { table: string; values: Record<string, unknown>; filters: [string, unknown[]][] }[] = [];
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        const rec = { table, values, filters: [] as [string, unknown[]][] };
        updateCalls.push(rec);
        const builder = {
          eq: (...a: unknown[]) => { rec.filters.push(["eq", a]); return builder; },
          neq: (...a: unknown[]) => { rec.filters.push(["neq", a]); return builder; },
          then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.resolve({ error: null }).then(resolve, reject),
        };
        return builder;
      },
    }),
  },
}));

beforeEach(() => {
  updateCalls.length = 0;
});

describe("parseApplePassAuth", () => {
  it("extrait le token du header ApplePass", () => {
    expect(parseApplePassAuth("ApplePass abc123")).toBe("abc123");
  });
  it("renvoie null si header absent ou mauvais schéma", () => {
    expect(parseApplePassAuth(null)).toBeNull();
    expect(parseApplePassAuth("Bearer xyz")).toBeNull();
  });
});

describe("clearCardMessage", () => {
  it("UPDATE pass_message='' filtré par id ET merchant_id (tenancy), avec neq anti-écriture-inutile", async () => {
    await clearCardMessage("card-1", "merchant-1");
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe("loyalty_cards");
    expect(updateCalls[0].values).toEqual({ pass_message: "" });
    expect(updateCalls[0].filters).toContainEqual(["eq", ["id", "card-1"]]);
    expect(updateCalls[0].filters).toContainEqual(["eq", ["merchant_id", "merchant-1"]]);
    // Chemin le plus chaud de l'app : pas d'écriture quand il n'y a rien à effacer.
    expect(updateCalls[0].filters).toContainEqual(["neq", ["pass_message", ""]]);
  });
});
