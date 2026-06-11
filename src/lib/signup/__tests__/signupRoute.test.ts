import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de POST /api/signup (surface publique) : flag fail-closed,
// rate-limit, validation, et surtout ANTI-ÉNUMÉRATION — la réponse est
// strictement identique que l'adresse soit déjà utilisée ou non.

const state = {
  flagEnabled: true,
  rateLimitOk: true,
  createUserError: null as { status?: number; message?: string } | null,
  linkError: null as { message?: string } | null,
  hashedToken: "hashed-tok-1" as string | null,
};

const calls = {
  createUser: [] as Record<string, unknown>[],
  generateLink: [] as Record<string, unknown>[],
  emails: [] as { to: string; subject: string; html: string }[],
  audits: [] as Record<string, unknown>[],
  rateLimitKeys: [] as string[],
};

vi.mock("@/lib/signup/flag", () => ({
  isSelfServiceEnabled: async () => state.flagEnabled,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (key: string) => {
    calls.rateLimitKeys.push(key);
    return { success: state.rateLimitOk, remaining: state.rateLimitOk ? 4 : 0 };
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: async (input: Record<string, unknown>) => {
          calls.createUser.push(input);
          if (state.createUserError) return { data: { user: null }, error: state.createUserError };
          return { data: { user: { id: "user-new-1" } }, error: null };
        },
        generateLink: async (input: Record<string, unknown>) => {
          calls.generateLink.push(input);
          if (state.linkError) return { data: null, error: state.linkError };
          return { data: { properties: { hashed_token: state.hashedToken } }, error: null };
        },
      },
    },
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: async (input: { to: string; subject: string; html: string }) => {
    calls.emails.push(input);
    return { sent: true, id: "email-1" };
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (entry: Record<string, unknown>) => {
    calls.audits.push(entry);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

import { POST } from "@/app/api/signup/route";

function makeReq(body: unknown): Request {
  return new Request("https://app.halocard.ch/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = { email: "nadia@boulangerie.ch", password: "Rhone-2026-fidele" };

beforeEach(() => {
  state.flagEnabled = true;
  state.rateLimitOk = true;
  state.createUserError = null;
  state.linkError = null;
  state.hashedToken = "hashed-tok-1";
  calls.createUser = [];
  calls.generateLink = [];
  calls.emails = [];
  calls.audits = [];
  calls.rateLimitKeys = [];
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe("POST /api/signup — gate & validation", () => {
  it("flag éteint → 404 indistinct, AUCUN effet de bord", async () => {
    state.flagEnabled = false;
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(404);
    expect(calls.createUser).toHaveLength(0);
    expect(calls.emails).toHaveLength(0);
  });

  it("email invalide → 400 sans création de compte", async () => {
    const res = await POST(makeReq({ email: "pas-un-email", password: VALID.password }));
    expect(res.status).toBe(400);
    expect(calls.createUser).toHaveLength(0);
  });

  it("mot de passe faible → 400", async () => {
    const res = await POST(makeReq({ email: VALID.email, password: "court1" }));
    expect(res.status).toBe(400);
  });

  it("rate-limit dépassé → 429, aucun compte créé", async () => {
    state.rateLimitOk = false;
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(429);
    expect(calls.createUser).toHaveLength(0);
    // Deux limiteurs : IP de confiance + email normalisé.
    expect(calls.rateLimitKeys).toContain("signup-ip:203.0.113.7");
    expect(calls.rateLimitKeys).toContain(`signup-email:${VALID.email}`);
  });

  it("captcha configuré + jeton absent → 400 (jamais contourné)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(400);
    expect(calls.createUser).toHaveLength(0);
  });
});

describe("POST /api/signup — parcours nominal", () => {
  it("crée un compte NON confirmé et envoie l'email de vérification", async () => {
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);

    expect(calls.createUser).toEqual([
      { email: VALID.email, password: VALID.password, email_confirm: false },
    ]);
    expect(calls.generateLink).toEqual([{ type: "magiclink", email: VALID.email }]);

    expect(calls.emails).toHaveLength(1);
    expect(calls.emails[0].to).toBe(VALID.email);
    expect(calls.emails[0].html).toContain("token_hash=hashed-tok-1");
    expect(calls.emails[0].html).toContain("/signup/confirm");

    const audit = calls.audits.find((a) => a.action === "SIGNUP_STARTED");
    expect(audit).toBeTruthy();
  });

  it("le rôle ne vient JAMAIS du client (aucune donnée tenant créée ici)", async () => {
    await POST(makeReq({ ...VALID, role: "admin", plan: "premium" }));
    expect(calls.createUser[0]).not.toHaveProperty("role");
    // Le provisioning (rôle 'merchant' fixé en SQL) n'a pas lieu à l'inscription.
    expect(JSON.stringify(calls.createUser)).not.toContain("admin");
  });
});

describe("POST /api/signup — anti-énumération", () => {
  it("adresse déjà utilisée → réponse STRICTEMENT identique au cas nominal", async () => {
    const fresh = await POST(makeReq(VALID));
    const freshBody = await fresh.json();

    state.createUserError = { status: 422, message: "User already registered" };
    const existing = await POST(makeReq(VALID));
    const existingBody = await existing.json();

    expect(existing.status).toBe(fresh.status);
    expect(existingBody).toEqual(freshBody);
  });

  it("adresse déjà utilisée → le titulaire reçoit l'email « déjà un compte » avec connexion en un clic", async () => {
    state.createUserError = { status: 422, message: "User already registered" };
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
    expect(calls.emails).toHaveLength(1);
    expect(calls.emails[0].subject).toContain("déjà un compte");
    expect(calls.emails[0].html).toContain("token_hash=hashed-tok-1");
  });

  it("adresse déjà utilisée + lien impossible → toujours 200 générique, email d'information", async () => {
    state.createUserError = { status: 422, message: "User already registered" };
    state.linkError = { message: "boom" };
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
    expect(calls.emails).toHaveLength(1);
    expect(calls.emails[0].subject).toContain("déjà un compte");
  });

  it("compte neuf mais email injoignable → 500 honnête (indépendant de l'existence)", async () => {
    state.linkError = { message: "smtp down" };
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(500);
  });
});
