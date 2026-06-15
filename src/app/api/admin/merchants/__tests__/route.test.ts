import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de POST /api/admin/merchants (création concierge par l'admin).
//
// Couvre les correctifs du parcours concierge (smoke F1) :
//  - BUG #1 : le handler ne touche JAMAIS la session de l'appelant. Il n'utilise
//    QUE supabaseAdmin (service-role, persistSession:false) → aucun cookie.
//    Preuve structurelle : le test fait tourner POST SANS mocker next/headers /
//    le client SSR cookie — s'il dépendait de la session navigateur, il
//    casserait. Le seul appel Auth autorisé est admin.createUser.
//  - BUG #2 : la ligne merchants est créée avec les marqueurs d'onboarding
//    concierge (setup_mode, managed_by_concierge, onboarding_completed_at,
//    onboarding_step, signup_source) → le marchand n'est jamais traité comme un
//    compte self inachevé.
//  - BUG #4 : email_confirm:true (le compte concierge est confirmé d'emblée,
//    aucun « validez votre email » ne le concerne).

const state = {
  adminDenied: null as unknown, // null = admin autorisé
  createUserError: null as { status?: number; message?: string } | null,
  insertError: null as { message?: string } | null,
};

const calls = {
  createUser: [] as Record<string, unknown>[],
  insertRows: [] as Record<string, unknown>[],
  deleteUser: [] as string[],
  audits: [] as Record<string, unknown>[],
  emails: [] as { to: string; subject: string }[],
};

vi.mock("@/lib/adminAuth", () => ({
  requireAdminApi: async () => state.adminDenied,
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
        deleteUser: async (id: string) => {
          calls.deleteUser.push(id);
          return { data: null, error: null };
        },
      },
    },
    from: (_table: string) => ({
      insert: (row: Record<string, unknown>) => {
        calls.insertRows.push(row);
        return {
          select: (_cols: string) => ({
            single: async () =>
              state.insertError
                ? { data: null, error: state.insertError }
                : { data: { id: "merchant-1" }, error: null },
          }),
        };
      },
    }),
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (entry: Record<string, unknown>) => {
    calls.audits.push(entry);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: async (input: { to: string; subject: string }) => {
    calls.emails.push(input);
    return { sent: true, id: "email-1" };
  },
}));

import { POST } from "@/app/api/admin/merchants/route";

function makeReq(body: unknown): Request {
  return new Request("https://app.halocard.ch/api/admin/merchants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = { shopName: "Café du Rhône", email: "Nadia@Boulangerie.CH", primaryColor: "#10b981" };

beforeEach(() => {
  state.adminDenied = null;
  state.createUserError = null;
  state.insertError = null;
  calls.createUser = [];
  calls.insertRows = [];
  calls.deleteUser = [];
  calls.audits = [];
  calls.emails = [];
});

describe("POST /api/admin/merchants — garde admin", () => {
  it("non-admin → refus renvoyé tel quel, aucun effet de bord", async () => {
    const { NextResponse } = await import("next/server");
    state.adminDenied = NextResponse.json({ error: "Accès réservé" }, { status: 403 });
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(403);
    expect(calls.createUser).toHaveLength(0);
    expect(calls.insertRows).toHaveLength(0);
  });

  it("nom de boutique invalide → 400 sans création", async () => {
    const res = await POST(makeReq({ ...VALID, shopName: "x" }));
    expect(res.status).toBe(400);
    expect(calls.createUser).toHaveLength(0);
  });

  it("email invalide → 400 sans création", async () => {
    const res = await POST(makeReq({ ...VALID, email: "pas-un-email" }));
    expect(res.status).toBe(400);
    expect(calls.createUser).toHaveLength(0);
  });
});

describe("POST /api/admin/merchants — parcours nominal concierge", () => {
  it("BUG #1 : tourne sans session navigateur (aucun client cookie) — n'utilise que admin.createUser", async () => {
    // Aucun mock de next/headers ni du client SSR : si le handler lisait/écrivait
    // la session de l'appelant, ce test échouerait. Il aboutit → zéro cookie touché.
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
    expect(calls.createUser).toHaveLength(1);
  });

  it("BUG #4 : crée un compte Auth CONFIRMÉ (email_confirm:true)", async () => {
    await POST(makeReq(VALID));
    expect(calls.createUser[0]).toMatchObject({
      email: "nadia@boulangerie.ch", // normalisé en minuscules
      email_confirm: true,
    });
  });

  it("BUG #2 : pose les marqueurs d'onboarding concierge à l'insertion", async () => {
    await POST(makeReq(VALID));
    expect(calls.insertRows).toHaveLength(1);
    const row = calls.insertRows[0];
    expect(row).toMatchObject({
      user_id: "user-new-1",
      shop_name: "Café du Rhône",
      email: "nadia@boulangerie.ch",
      role: "merchant",
      setup_mode: "concierge",
      managed_by_concierge: true,
      onboarding_step: "done",
      signup_source: "concierge",
      primary_color: "#10b981",
    });
    expect(typeof row.onboarding_completed_at).toBe("string");
    expect(Number.isNaN(Date.parse(row.onboarding_completed_at as string))).toBe(false);
  });

  it("audit MERCHANT_CREATED enrichi de setup_mode='concierge'", async () => {
    await POST(makeReq(VALID));
    const audit = calls.audits.find((a) => a.action === "MERCHANT_CREATED");
    expect(audit).toBeTruthy();
    expect(audit?.details).toMatchObject({ setup_mode: "concierge" });
  });

  it("renvoie un mot de passe temporaire à transmettre", async () => {
    const res = await POST(makeReq(VALID));
    const body = await res.json();
    expect(body.merchantId).toBe("merchant-1");
    expect(typeof body.tempPassword).toBe("string");
    expect((body.tempPassword as string).length).toBeGreaterThan(8);
  });
});

describe("POST /api/admin/merchants — robustesse", () => {
  it("email déjà pris → 400 explicite, pas de ligne merchants", async () => {
    state.createUserError = { status: 422, message: "User already registered" };
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(400);
    expect(calls.insertRows).toHaveLength(0);
  });

  it("échec d'insertion → anti-orphelin : l'utilisateur Auth est supprimé", async () => {
    state.insertError = { message: "boom" };
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(500);
    expect(calls.deleteUser).toEqual(["user-new-1"]);
  });
});
