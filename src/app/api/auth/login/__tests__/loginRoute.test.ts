import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de POST /api/auth/login. On prouve :
//  - validation email/mot de passe (400) ;
//  - DOUBLE rate-limit (par email + par IP) : l'un OU l'autre saturé → 429 +
//    audit LOGIN_FAILED(reason=RATE_LIMITED) ;
//  - identifiants invalides → 401 + audit LOGIN_FAILED(reason=INVALID_CREDENTIALS) ;
//  - succès → 200 + audit LOGIN_SUCCESS, role renvoyé selon merchants.role
//    (admin → "admin", défaut → "merchant").

type Row = Record<string, unknown>;

const state = {
  emailLimit: { success: true },
  ipLimit: { success: true },
  signInError: null as { message: string } | null,
  signInUser: { id: "user-1" } as { id: string } | null,
  merchantRow: null as Row | null,
};

const calls = {
  rateLimitKeys: [] as string[],
  audit: [] as Row[],
  signInArgs: [] as Row[],
};

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (key: string) => {
    calls.rateLimitKeys.push(key);
    if (key.startsWith("login-email:")) return state.emailLimit;
    return state.ipLimit;
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audit.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async (args: Row) => {
        calls.signInArgs.push(args);
        if (state.signInError) return { data: { user: null }, error: state.signInError };
        return { data: { user: state.signInUser }, error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.merchantRow, error: null }) }),
      }),
    }),
  }),
}));

import { POST } from "@/app/api/auth/login/route";

function loginReq(body: unknown): Request {
  return new Request("https://app.halocard.ch/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = { email: "Nadia@Example.CH", password: "s3cr3t-pass" };

beforeEach(() => {
  state.emailLimit = { success: true };
  state.ipLimit = { success: true };
  state.signInError = null;
  state.signInUser = { id: "user-1" };
  state.merchantRow = { id: "merchant-1", role: "merchant" };
  calls.rateLimitKeys = [];
  calls.audit = [];
  calls.signInArgs = [];
});

describe("POST /api/auth/login — validation", () => {
  it("body non-JSON → 400", async () => {
    const res = await POST(loginReq("{ pas json"));
    expect(res.status).toBe(400);
  });

  it("email manquant → 400, aucune tentative d'auth", async () => {
    const res = await POST(loginReq({ password: "x".repeat(10) }));
    expect(res.status).toBe(400);
    expect(calls.signInArgs).toHaveLength(0);
  });

  it("mot de passe vide → 400", async () => {
    const res = await POST(loginReq({ email: "a@b.ch", password: "" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login — double rate-limit", () => {
  it("interroge les DEUX limiteurs (par email normalisé + par IP)", async () => {
    await POST(loginReq(VALID));
    expect(calls.rateLimitKeys).toContain("login-email:nadia@example.ch");
    expect(calls.rateLimitKeys.some((k) => k.startsWith("login-ip:"))).toBe(true);
  });

  it("limiteur EMAIL saturé → 429 + audit LOGIN_FAILED(RATE_LIMITED), pas d'auth", async () => {
    state.emailLimit = { success: false };
    const res = await POST(loginReq(VALID));
    expect(res.status).toBe(429);
    expect(calls.signInArgs).toHaveLength(0);
    expect(calls.audit[0]).toMatchObject({ action: "LOGIN_FAILED" });
    expect((calls.audit[0].details as Row).reason).toBe("RATE_LIMITED");
  });

  it("limiteur IP saturé → 429", async () => {
    state.ipLimit = { success: false };
    const res = await POST(loginReq(VALID));
    expect(res.status).toBe(429);
    expect(calls.signInArgs).toHaveLength(0);
  });
});

describe("POST /api/auth/login — authentification", () => {
  it("identifiants invalides → 401 + audit LOGIN_FAILED(INVALID_CREDENTIALS)", async () => {
    state.signInError = { message: "Invalid login credentials" };
    const res = await POST(loginReq(VALID));
    expect(res.status).toBe(401);
    expect(calls.audit[0]).toMatchObject({ action: "LOGIN_FAILED" });
    expect((calls.audit[0].details as Row).reason).toBe("INVALID_CREDENTIALS");
  });

  it("succès marchand → 200, role 'merchant', audit LOGIN_SUCCESS + email normalisé", async () => {
    const res = await POST(loginReq(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.role).toBe("merchant");
    // l'auth a bien reçu l'email normalisé en minuscules
    expect(calls.signInArgs[0].email).toBe("nadia@example.ch");
    expect(calls.audit[0]).toMatchObject({ action: "LOGIN_SUCCESS", user_id: "user-1", merchant_id: "merchant-1" });
  });

  it("succès admin → role 'admin'", async () => {
    state.merchantRow = { id: "merchant-1", role: "admin" };
    const res = await POST(loginReq(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
  });

  it("aucune ligne merchants → role par défaut 'merchant'", async () => {
    state.merchantRow = null;
    const res = await POST(loginReq(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("merchant");
  });
});
