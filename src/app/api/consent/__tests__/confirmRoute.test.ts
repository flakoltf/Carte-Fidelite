import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/consent/confirm?t=<jeton> — clic sur le lien de double opt-in.
// Jeton réel (module token non mocké) ; la transition d'état est mockée
// (testée dans lib/consent/__tests__/confirm.test.ts). Rate-limit fail-open.

type Row = Record<string, unknown>;

const confirmCalls: Row[] = [];
let confirmOutcome: string = "confirmed";
let confirmThrows = false;
vi.mock("@/lib/consent/confirm", () => ({
  confirmMarketingConsent: async (input: Row) => {
    if (confirmThrows) throw new Error("db down");
    confirmCalls.push(input);
    return { outcome: confirmOutcome };
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

import { GET } from "@/app/api/consent/confirm/route";
import { confirmToken } from "@/lib/consent/token";

const IDS = { customerId: "11111111-1111-4111-8111-111111111111", merchantId: "22222222-2222-4222-8222-222222222222" };

function req(t: string | null): Request {
  const u = new URL("https://halocard.ch/api/consent/confirm");
  if (t !== null) u.searchParams.set("t", t);
  return new Request(u.toString());
}

function landing(res: Response): { path: string; etat: string | null; m: string | null } {
  const loc = new URL(res.headers.get("location")!);
  return { path: loc.pathname, etat: loc.searchParams.get("etat"), m: loc.searchParams.get("m") };
}

beforeEach(() => {
  process.env.CONSENT_TOKEN_SECRET = "test-consent-secret";
  confirmCalls.length = 0;
  confirmOutcome = "confirmed";
  confirmThrows = false;
  rateLimited = false;
  rateLimitThrows = false;
});
afterEach(() => {
  delete process.env.CONSENT_TOKEN_SECRET;
});

describe("GET /api/consent/confirm", () => {
  it("jeton valide → consentement confirmé pour CE client/CE marchand, redirection 303 vers la page « confirmé »", async () => {
    const res = await GET(req(confirmToken(IDS)));
    expect(res.status).toBe(303);
    expect(landing(res)).toEqual({ path: "/consentement", etat: "confirme", m: IDS.merchantId });
    expect(confirmCalls[0]).toMatchObject({ ...IDS, ip: "203.0.113.7", userAgent: "vitest" });
  });

  it("double clic (déjà confirmé) → même page « confirmé », pas d'erreur (idempotent)", async () => {
    confirmOutcome = "already";
    const res = await GET(req(confirmToken(IDS)));
    expect(res.status).toBe(303);
    expect(landing(res).etat).toBe("confirme");
  });

  it("jeton expiré → page « lien expiré », aucune transition", async () => {
    const old = confirmToken(IDS, Date.now() - 8 * 24 * 3600 * 1000);
    const res = await GET(req(old));
    expect(landing(res).etat).toBe("expire");
    expect(confirmCalls).toHaveLength(0);
  });

  it("jeton falsifié / absent / de désinscription → page « lien invalide », aucune transition", async () => {
    const t = confirmToken(IDS);
    for (const bad of [null, "", t.slice(0, -3) + "abc", `${t.split(".")[0]}.aaaa`]) {
      const res = await GET(req(bad));
      expect(res.status).toBe(303);
      expect(landing(res).etat).toBe("invalide");
    }
    expect(confirmCalls).toHaveLength(0);
  });

  it("client introuvable sous ce marchand → « lien invalide » (aucune fuite d'information)", async () => {
    confirmOutcome = "not_found";
    const res = await GET(req(confirmToken(IDS)));
    expect(landing(res).etat).toBe("invalide");
  });

  it("consentement jamais demandé → « lien invalide »", async () => {
    confirmOutcome = "not_requested";
    expect(landing(await GET(req(confirmToken(IDS)))).etat).toBe("invalide");
  });

  it("rate-limit dépassé → 429, aucune transition", async () => {
    rateLimited = true;
    const res = await GET(req(confirmToken(IDS)));
    expect(res.status).toBe(429);
    expect(confirmCalls).toHaveLength(0);
  });

  it("Redis en panne → fail-open : la confirmation passe quand même", async () => {
    rateLimitThrows = true;
    const res = await GET(req(confirmToken(IDS)));
    expect(landing(res).etat).toBe("confirme");
  });

  it("panne BDD → page « lien indisponible » (etat=erreur), jamais un 500 brut ni un faux succès", async () => {
    confirmThrows = true;
    const res = await GET(req(confirmToken(IDS)));
    expect(res.status).toBe(303);
    expect(landing(res).etat).toBe("erreur");
  });
});
