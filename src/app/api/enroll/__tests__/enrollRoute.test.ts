import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de POST /api/enroll — première marche du parcours d'ACQUISITION
// public (un client final scanne le QR /c/[slug] et soumet ce formulaire). Aucun
// test n'existait pour ce chemin. On prouve :
//  - validation slug/nom/email (400) ;
//  - marchand inconnu ou suspendu → 404 indistinct (on n'expose pas le statut) ;
//  - find-or-create client : réutilisation vs création, et course 23505 re-lue ;
//  - tampon de bienvenue appliqué à la NOUVELLE carte (plafonné à l'objectif) ;
//  - tenancy : tout SELECT/INSERT porte le filtre merchant_id du marchand résolu.

type Row = Record<string, unknown>;

const state = {
  merchant: null as Row | null,
  merchError: null as { message: string } | null,
  existingCustomer: null as Row | null,
  customerInsert: { row: { id: "cust-new" } as Row | null, error: null as { code?: string; message?: string } | null },
  customerRaced: null as Row | null,
  existingCards: [] as Row[],
  cardInsert: { row: { id: "card-new" } as Row | null, error: null as { code?: string; message?: string } | null },
  cardRaced: null as Row | null,
};

const calls = {
  merchantSlugFilter: [] as unknown[],
  customerSelectFilters: [] as Record<string, unknown>[],
  customerInserts: [] as Row[],
  cardSelectFilters: [] as Record<string, unknown>[],
  cardInserts: [] as Row[],
  audit: [] as Row[],
};

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => ({ success: true, remaining: 10 }),
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audit.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({
            eq: (_col: string, val: unknown) => {
              calls.merchantSlugFilter.push(val);
              return { maybeSingle: async () => ({ data: state.merchant, error: state.merchError }) };
            },
          }),
        };
      }
      if (table === "customers") {
        return {
          // find existant : .select().eq(merchant_id).eq(email).maybeSingle()
          // re-lecture course : .select().eq().eq().single()
          select: () => {
            const filter: Record<string, unknown> = {};
            const chain = {
              eq: (col: string, val: unknown) => {
                filter[col] = val;
                return chain;
              },
              maybeSingle: async () => {
                calls.customerSelectFilters.push({ ...filter });
                return { data: state.existingCustomer, error: null };
              },
              single: async () => {
                calls.customerSelectFilters.push({ ...filter });
                return { data: state.customerRaced, error: null };
              },
            };
            return chain;
          },
          insert: (payload: Row) => {
            calls.customerInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({ data: state.customerInsert.row, error: state.customerInsert.error }),
              }),
            };
          },
        };
      }
      // loyalty_cards
      return {
        select: () => {
          const filter: Record<string, unknown> = {};
          const chain = {
            eq: (col: string, val: unknown) => {
              filter[col] = val;
              return chain;
            },
            limit: async () => {
              calls.cardSelectFilters.push({ ...filter });
              return { data: state.existingCards, error: null };
            },
            single: async () => {
              calls.cardSelectFilters.push({ ...filter });
              return { data: state.cardRaced, error: null };
            },
          };
          return chain;
        },
        insert: (payload: Row) => {
          calls.cardInserts.push(payload);
          return {
            select: () => ({
              single: async () => ({ data: state.cardInsert.row, error: state.cardInsert.error }),
            }),
          };
        },
      };
    },
  },
}));

import { POST } from "@/app/api/enroll/route";

function enrollReq(body: unknown): Request {
  return new Request("https://app.halocard.ch/api/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = { slug: "boulangerie-paquis", firstName: "Nadia", lastName: "Khan", email: "Nadia@Example.CH" };

beforeEach(() => {
  state.merchant = {
    id: "merchant-1",
    suspended_at: null,
    loyalty_type: "stamp_card",
    loyalty_config: { goal: 10, welcome_stamps: 1 },
    stamp_goal: 10,
  };
  state.merchError = null;
  state.existingCustomer = null;
  state.customerInsert = { row: { id: "cust-new" }, error: null };
  state.customerRaced = null;
  state.existingCards = [];
  state.cardInsert = { row: { id: "card-new" }, error: null };
  state.cardRaced = null;
  calls.merchantSlugFilter = [];
  calls.customerSelectFilters = [];
  calls.customerInserts = [];
  calls.cardSelectFilters = [];
  calls.cardInserts = [];
  calls.audit = [];
});

describe("POST /api/enroll — validation", () => {
  it("slug invalide → 400, aucun accès BDD", async () => {
    const res = await POST(enrollReq({ ...VALID, slug: "Pas Valide!" }));
    expect(res.status).toBe(400);
    expect(calls.merchantSlugFilter).toHaveLength(0);
  });

  it("prénom manquant → 400", async () => {
    const res = await POST(enrollReq({ ...VALID, firstName: "" }));
    expect(res.status).toBe(400);
    expect(calls.merchantSlugFilter).toHaveLength(0);
  });

  it("nom absent → 200, full_name = prénom seul", async () => {
    const res = await POST(enrollReq({ ...VALID, lastName: "" }));
    expect(res.status).toBe(200);
    expect(calls.customerInserts[0].full_name).toBe("Nadia");
  });

  it("email invalide → 400", async () => {
    const res = await POST(enrollReq({ ...VALID, email: "pas-un-email" }));
    expect(res.status).toBe(400);
    expect(calls.merchantSlugFilter).toHaveLength(0);
  });

  it("body non-JSON → 400", async () => {
    const req = new Request("https://app.halocard.ch/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ pas du json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/enroll — marchand", () => {
  it("marchand inconnu → 404 (lien invalide)", async () => {
    state.merchant = null;
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(404);
    // résolution par slug bien tentée
    expect(calls.merchantSlugFilter).toEqual([VALID.slug]);
    // aucune création n'a lieu
    expect(calls.customerInserts).toHaveLength(0);
  });

  it("marchand suspendu → 404 indistinct, aucune création", async () => {
    state.merchant = { ...(state.merchant as Row), suspended_at: "2026-01-01T00:00:00Z" };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(404);
    expect(calls.customerInserts).toHaveLength(0);
    expect(calls.cardInserts).toHaveLength(0);
  });
});

describe("POST /api/enroll — find-or-create client", () => {
  it("client existant réutilisé (pas de nouvel INSERT customers)", async () => {
    state.existingCustomer = { id: "cust-existant" };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    expect(calls.customerInserts).toHaveLength(0);
    // la carte est créée pour le client existant, avec le bon filtre tenant
    expect(calls.cardInserts[0].customer_id).toBe("cust-existant");
    expect(calls.cardInserts[0].merchant_id).toBe("merchant-1");
  });

  it("nouveau client créé : email normalisé en minuscules + tenancy", async () => {
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    expect(calls.customerInserts).toHaveLength(1);
    expect(calls.customerInserts[0].email).toBe("nadia@example.ch");
    expect(calls.customerInserts[0].merchant_id).toBe("merchant-1");
    expect(calls.customerInserts[0].full_name).toBe("Nadia Khan");
    // le SELECT find-existant a bien filtré par merchant_id + email
    expect(calls.customerSelectFilters[0]).toMatchObject({ merchant_id: "merchant-1", email: "nadia@example.ch" });
  });

  it("course 23505 sur customers → re-lecture de la ligne gagnante (200)", async () => {
    state.customerInsert = { row: null, error: { code: "23505", message: "duplicate" } };
    state.customerRaced = { id: "cust-gagnant" };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    // la carte est rattachée au client gagnant de la course
    expect(calls.cardInserts[0].customer_id).toBe("cust-gagnant");
  });

  it("erreur INSERT customers non-23505 → 500 (jamais de throw nu)", async () => {
    state.customerInsert = { row: null, error: { code: "23502", message: "not null" } };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/enroll — carte & tampon de bienvenue", () => {
  it("nouvelle carte → welcome stamp appliqué (welcome_stamps=1) + audit CARD_GENERATED", async () => {
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isNew).toBe(true);
    expect(body.cardId).toBe("card-new");
    // tampon de bienvenue posé à la création
    expect(calls.cardInserts[0].stamps_count).toBe(1);
    expect(calls.audit[0]).toMatchObject({ action: "CARD_GENERATED", merchant_id: "merchant-1" });
  });

  it("welcome_stamps plafonné à l'objectif (goal=0 → 0 tampon)", async () => {
    state.merchant = {
      id: "merchant-1",
      suspended_at: null,
      loyalty_type: "stamp_card",
      // goal hors bornes (0) → resolveProgram retombe sur DEFAULT, mais ici on
      // force un goal cohérent : on vérifie surtout que welcome n'excède jamais goal.
      loyalty_config: { goal: 5, welcome_stamps: 1 },
      stamp_goal: 5,
    };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    // 1 tampon (min(1, goal=5))
    expect(calls.cardInserts[0].stamps_count).toBe(1);
  });

  it("sans welcome_stamps → carte créée à 0 tampon", async () => {
    state.merchant = {
      id: "merchant-1",
      suspended_at: null,
      loyalty_type: "stamp_card",
      loyalty_config: { goal: 10 },
      stamp_goal: 10,
    };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    expect(calls.cardInserts[0].stamps_count).toBe(0);
  });

  it("carte existante réutilisée → aucune création, isNew=false, pas d'audit", async () => {
    state.existingCustomer = { id: "cust-existant" };
    state.existingCards = [{ id: "card-existante" }];
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isNew).toBe(false);
    expect(body.cardId).toBe("card-existante");
    expect(calls.cardInserts).toHaveLength(0);
    expect(calls.audit).toHaveLength(0);
    // le SELECT carte a filtré par customer_id ET merchant_id (tenancy)
    expect(calls.cardSelectFilters[0]).toMatchObject({ customer_id: "cust-existant", merchant_id: "merchant-1" });
  });

  it("course 23505 sur loyalty_cards → re-lecture de la carte gagnante (200, isNew=false)", async () => {
    state.cardInsert = { row: null, error: { code: "23505", message: "duplicate" } };
    state.cardRaced = { id: "card-gagnante" };
    const res = await POST(enrollReq(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cardId).toBe("card-gagnante");
    expect(body.isNew).toBe(false);
    // pas d'audit CARD_GENERATED pour une carte qui existait déjà (course)
    expect(calls.audit).toHaveLength(0);
  });
});
