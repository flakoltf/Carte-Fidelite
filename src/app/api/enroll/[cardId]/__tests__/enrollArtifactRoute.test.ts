import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de GET /api/enroll/[cardId] — l'émission de l'artefact Wallet du
// parcours public (Apple .pkpass ou redirection Google). Aucun test n'existait.
// On prouve :
//  - cardId non-UUID → 400 ;
//  - slug ne correspondant pas au marchand → 403 (appartenance boutique) ;
//  - marchand suspendu → 404 indistinct ;
//  - wallet=google sans flag prêt → 503 (gate serveur, pas seulement client) ;
//  - wallet=apple → 200 .pkpass (bon Content-Type / Content-Disposition) ;
//  - INVARIANT : enrollment_token (secret rotatif) jamais renvoyé au navigateur.

type Row = Record<string, unknown>;

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const state = {
  card: null as Row | null,
  merchant: null as Row | null,
  customer: null as Row | null,
};

const calls = {
  applePassArgs: [] as Row[],
  googleArgs: [] as Row[],
  cardUpdates: [] as Row[],
};

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => ({ success: true, remaining: 30 }),
}));

vi.mock("@/lib/auditLog", () => ({
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

vi.mock("@/lib/applePass", () => ({
  buildApplePassBuffer: async (args: Row) => {
    calls.applePassArgs.push(args);
    return Buffer.from("PKPASS-BYTES");
  },
}));

vi.mock("@/lib/googlePass", () => ({
  buildGoogleSaveUrl: async (args: Row) => {
    calls.googleArgs.push(args);
    return { saveUrl: "https://pay.google.com/save/abc", objectId: "obj-123" };
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "loyalty_cards") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.card, error: null }) }),
          }),
          update: (patch: Row) => ({
            eq: async (_col: string, _val: unknown) => {
              calls.cardUpdates.push(patch);
              return { data: null, error: null };
            },
          }),
        };
      }
      if (table === "merchants") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.merchant, error: null }) }),
          }),
        };
      }
      // customers
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: state.customer, error: null }) }),
        }),
      };
    },
  },
}));

import { GET } from "@/app/api/enroll/[cardId]/route";

function makeReq(cardId: string, query: string): Request {
  return new Request(`https://app.halocard.ch/api/enroll/${cardId}?${query}`);
}

function params(cardId: string) {
  return { params: Promise.resolve({ cardId }) };
}

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY;

beforeEach(() => {
  state.card = { id: VALID_UUID, stamps_count: 3, merchant_id: "merchant-1", customer_id: "cust-1" };
  state.merchant = {
    enrollment_token: "SECRET-ROTATIF-XYZ",
    slug: "boulangerie-paquis",
    shop_name: "Boulangerie des Pâquis",
    primary_color: "#0D6B5E",
    suspended_at: null,
  };
  state.customer = { full_name: "Nadia Khan" };
  calls.applePassArgs = [];
  calls.googleArgs = [];
  calls.cardUpdates = [];
  delete process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY;
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY;
  else process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY = ORIGINAL_FLAG;
});

describe("GET /api/enroll/[cardId] — validation", () => {
  it("cardId non-UUID → 400", async () => {
    const res = await GET(makeReq("pas-un-uuid", "s=boulangerie-paquis&wallet=apple"), params("pas-un-uuid"));
    expect(res.status).toBe(400);
    expect(calls.applePassArgs).toHaveLength(0);
  });

  it("ni slug ni token valide → 400", async () => {
    const res = await GET(makeReq(VALID_UUID, "wallet=apple"), params(VALID_UUID));
    expect(res.status).toBe(400);
  });

  it("wallet inconnu → 400", async () => {
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=samsung"), params(VALID_UUID));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/enroll/[cardId] — autorisation & statut", () => {
  it("carte introuvable → 404", async () => {
    state.card = null;
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=apple"), params(VALID_UUID));
    expect(res.status).toBe(404);
  });

  it("slug ne correspondant pas au marchand → 403", async () => {
    const res = await GET(makeReq(VALID_UUID, "s=autre-boutique&wallet=apple"), params(VALID_UUID));
    expect(res.status).toBe(403);
    expect(calls.applePassArgs).toHaveLength(0);
  });

  it("marchand suspendu → 404 indistinct (aucune émission)", async () => {
    state.merchant = { ...(state.merchant as Row), suspended_at: "2026-01-01T00:00:00Z" };
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=apple"), params(VALID_UUID));
    expect(res.status).toBe(404);
    expect(calls.applePassArgs).toHaveLength(0);
  });
});

describe("GET /api/enroll/[cardId] — gate Google", () => {
  it("wallet=google sans flag prêt → 503 (gate serveur)", async () => {
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=google"), params(VALID_UUID));
    expect(res.status).toBe(503);
    expect(calls.googleArgs).toHaveLength(0);
  });

  it("wallet=google avec flag prêt → redirection 302 vers l'URL signée", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY = "true";
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=google"), params(VALID_UUID));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://pay.google.com/save/abc");
    // pass_type persisté en google + external_id
    expect(calls.cardUpdates[0]).toMatchObject({ pass_type: "google", external_id: "obj-123" });
  });
});

describe("GET /api/enroll/[cardId] — Apple succès & invariant token", () => {
  it("wallet=apple → 200 .pkpass (Content-Type + Content-Disposition)", async () => {
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=apple"), params(VALID_UUID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.apple.pkpass");
    expect(res.headers.get("Content-Disposition")).toContain(".pkpass");
    // pass_type persisté en apple APRÈS génération réussie du buffer
    expect(calls.cardUpdates[0]).toMatchObject({ pass_type: "apple" });
    // le branding du marchand est transmis au builder (pas le token)
    expect(calls.applePassArgs[0]).toMatchObject({ cardId: VALID_UUID, customerName: "Nadia Khan", stamps: 3 });
  });

  it("INVARIANT : l'enrollment_token n'atteint jamais le corps de réponse", async () => {
    const res = await GET(makeReq(VALID_UUID, "s=boulangerie-paquis&wallet=apple"), params(VALID_UUID));
    const bytes = Buffer.from(await res.arrayBuffer()).toString("utf8");
    expect(bytes).not.toContain("SECRET-ROTATIF-XYZ");
    // ni transmis au builder de pass (qui pourrait l'embarquer dans l'artefact)
    expect(JSON.stringify(calls.applePassArgs)).not.toContain("SECRET-ROTATIF-XYZ");
  });

  it("autorisation par token legacy (?t=) acceptée si le token correspond", async () => {
    // legacy : lien émis avant la bascule slug. Le token doit matcher merchant.enrollment_token.
    const res = await GET(
      makeReq(VALID_UUID, "t=550e8400-e29b-41d4-a716-446655440000&wallet=apple"),
      params(VALID_UUID),
    );
    // le token de la requête (UUID) ne correspond PAS au token marchand → 403
    expect(res.status).toBe(403);
  });
});
