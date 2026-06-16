import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME du smoke email : garde admin (403), 503 si Resend non configuré,
// envoi à l'email de l'admin connecté (jamais arbitraire), audit EMAIL_SMOKE_SENT,
// et 502 si l'API Resend échoue.

const state = {
  denied: null as unknown,
  rateOk: true,
  configured: true,
  adminEmail: "admin@halocard.ch" as string | null,
  sendResult: { sent: true, id: "evt_123" } as Record<string, unknown>,
};
const calls = {
  audits: [] as Record<string, unknown>[],
  rateKeys: [] as string[],
  sent: [] as Record<string, unknown>[],
  getUserIds: [] as string[],
};

vi.mock("@/lib/adminAuth", () => ({
  requireAdminApi: async () => state.denied,
  getSessionRole: async () => ({ userId: "admin-1", role: "admin" }),
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (key: string) => {
    calls.rateKeys.push(key);
    return { success: state.rateOk, remaining: state.rateOk ? 2 : 0 };
  },
}));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Record<string, unknown>) => { calls.audits.push(e); },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => state.configured,
  sendEmail: async (input: Record<string, unknown>) => {
    calls.sent.push(input);
    return state.sendResult;
  },
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: async (id: string) => {
          calls.getUserIds.push(id);
          return { data: { user: state.adminEmail ? { id, email: state.adminEmail } : null }, error: null };
        },
      },
    },
  },
}));

import { POST as SMOKE } from "@/app/api/admin/email-smoke/route";

function req() { return new Request("https://app.halocard.ch/api/admin/email-smoke", { method: "POST" }); }

beforeEach(() => {
  state.denied = null;
  state.rateOk = true;
  state.configured = true;
  state.adminEmail = "admin@halocard.ch";
  state.sendResult = { sent: true, id: "evt_123" };
  calls.audits = []; calls.rateKeys = []; calls.sent = []; calls.getUserIds = [];
});

describe("garde admin (403)", () => {
  it("non-admin → 403, aucun envoi", async () => {
    state.denied = Response.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    const res = await SMOKE(req());
    expect(res.status).toBe(403);
    expect(calls.sent).toHaveLength(0);
    expect(calls.audits).toHaveLength(0);
  });
});

describe("Resend non configuré", () => {
  it("isEmailConfigured() = false → 503 explicite, aucun envoi ni rate-limit", async () => {
    state.configured = false;
    const res = await SMOKE(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Resend non configuré");
    expect(calls.sent).toHaveLength(0);
    expect(calls.rateKeys).toHaveLength(0);
  });
});

describe("envoi nominal", () => {
  it("envoie à l'email de l'admin, audite EMAIL_SMOKE_SENT, renvoie eventId", async () => {
    const res = await SMOKE(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.eventId).toBe("evt_123");

    // Destinataire = l'email de l'admin connecté (résolu via getUserById).
    expect(calls.getUserIds).toContain("admin-1");
    expect(calls.sent).toHaveLength(1);
    expect(calls.sent[0].to).toBe("admin@halocard.ch");
    expect(calls.sent[0].subject).toBe("HaloCard — Smoke test");

    expect(calls.audits[0].action).toBe("EMAIL_SMOKE_SENT");
    expect(calls.rateKeys).toContain("email-smoke:admin-1");
  });

  it("rate-limit dépassé → 429, aucun envoi", async () => {
    state.rateOk = false;
    const res = await SMOKE(req());
    expect(res.status).toBe(429);
    expect(calls.sent).toHaveLength(0);
    expect(calls.audits).toHaveLength(0);
  });

  it("email admin introuvable → 422, aucun envoi", async () => {
    state.adminEmail = null;
    const res = await SMOKE(req());
    expect(res.status).toBe(422);
    expect(calls.sent).toHaveLength(0);
  });
});

describe("échec Resend", () => {
  it("sendEmail renvoie sent:false → 502, pas d'audit", async () => {
    state.sendResult = { sent: false, reason: "error", detail: "HTTP 401" };
    const res = await SMOKE(req());
    expect(res.status).toBe(502);
    expect(calls.audits).toHaveLength(0);
  });
});
