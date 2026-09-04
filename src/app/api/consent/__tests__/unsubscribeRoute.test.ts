import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/consent/unsubscribe?t=<jeton> — désinscription en un clic depuis le
// pied de page de tout email marketing. Jeton réel SANS expiration.

type Row = Record<string, unknown>;

const revokeCalls: Row[] = [];
let outcome: string = "revoked";
let throws = false;
vi.mock("@/lib/consent/unsubscribe", () => ({
  revokeMarketingConsent: async (input: Row) => {
    if (throws) throw new Error("db down");
    revokeCalls.push(input);
    return { outcome };
  },
}));

let rateLimited = false;
let rateLimitThrows = false;
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => {
    if (rateLimitThrows) throw new Error("redis down");
    return { success: !rateLimited, remaining: 1 };
  },
}));

vi.mock("@/lib/auditLog", () => ({
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

import { GET } from "@/app/api/consent/unsubscribe/route";
import { confirmToken, unsubscribeToken } from "@/lib/consent/token";

const IDS = { customerId: "11111111-1111-4111-8111-111111111111", merchantId: "22222222-2222-4222-8222-222222222222" };

function req(t: string | null): Request {
  const u = new URL("https://halocard.ch/api/consent/unsubscribe");
  if (t !== null) u.searchParams.set("t", t);
  return new Request(u.toString());
}
function landing(res: Response): { path: string; etat: string | null; m: string | null } {
  const loc = new URL(res.headers.get("location")!);
  return { path: loc.pathname, etat: loc.searchParams.get("etat"), m: loc.searchParams.get("m") };
}

beforeEach(() => {
  process.env.CONSENT_TOKEN_SECRET = "test-consent-secret";
  revokeCalls.length = 0;
  outcome = "revoked";
  throws = false;
  rateLimited = false;
  rateLimitThrows = false;
});
afterEach(() => {
  delete process.env.CONSENT_TOKEN_SECRET;
});

describe("GET /api/consent/unsubscribe", () => {
  it("jeton valide → révocation pour CE client/CE marchand, 303 vers « désinscrit »", async () => {
    const res = await GET(req(unsubscribeToken(IDS)));
    expect(res.status).toBe(303);
    expect(landing(res)).toEqual({ path: "/consentement", etat: "desinscrit", m: IDS.merchantId });
    expect(revokeCalls[0]).toMatchObject({ ...IDS, ip: "203.0.113.7", userAgent: "vitest" });
  });

  it("double clic (déjà révoqué) → même page, pas d'erreur (idempotent)", async () => {
    outcome = "already";
    expect(landing(await GET(req(unsubscribeToken(IDS)))).etat).toBe("desinscrit");
  });

  it("un jeton de CONFIRMATION ne désinscrit pas → « lien invalide »", async () => {
    const res = await GET(req(confirmToken(IDS)));
    expect(landing(res).etat).toBe("invalide");
    expect(revokeCalls).toHaveLength(0);
  });

  it("jeton falsifié / absent → « lien invalide », aucune transition", async () => {
    const t = unsubscribeToken(IDS);
    for (const bad of [null, "", `${t.split(".")[0]}.aaaa`]) {
      expect(landing(await GET(req(bad))).etat).toBe("invalide");
    }
    expect(revokeCalls).toHaveLength(0);
  });

  it("client introuvable sous ce marchand → « lien invalide »", async () => {
    outcome = "not_found";
    expect(landing(await GET(req(unsubscribeToken(IDS)))).etat).toBe("invalide");
  });

  it("rate-limit dépassé → 429 ; Redis en panne → fail-open", async () => {
    rateLimited = true;
    expect((await GET(req(unsubscribeToken(IDS)))).status).toBe(429);
    rateLimited = false;
    rateLimitThrows = true;
    expect(landing(await GET(req(unsubscribeToken(IDS)))).etat).toBe("desinscrit");
  });

  it("panne BDD → « erreur », jamais un faux « désinscrit »", async () => {
    throws = true;
    expect(landing(await GET(req(unsubscribeToken(IDS)))).etat).toBe("erreur");
  });
});
