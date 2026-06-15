import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Tests RUNTIME de POST /api/admin/merchants (création concierge par l'admin).
// Couvre :
//  #2 — la ligne marchand naît COHÉRENTE (marqueurs d'onboarding concierge),
//       pas dans un état mi-rempli qui casse le parcours en aval.
//  #1 — le handler n'introduit AUCUN appel mutateur de session : la création
//       ne peut pas déconnecter/reconnecter l'admin appelant.

const state = {
  denied: null as unknown,
  createUserError: null as { status?: number; message?: string } | null,
  insertError: null as { message?: string } | null,
};

const calls = {
  createUser: [] as Record<string, unknown>[],
  deleteUser: [] as string[],
  inserts: [] as { table: string; payload: Record<string, unknown> }[],
  audits: [] as Record<string, unknown>[],
  emails: [] as Record<string, unknown>[],
};

vi.mock("@/lib/adminAuth", () => ({
  requireAdminApi: async () => state.denied,
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
          return { data: {}, error: null };
        },
      },
    },
    from: (table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        calls.inserts.push({ table, payload });
        return {
          select: () => ({
            single: async () =>
              state.insertError
                ? { data: null, error: state.insertError }
                : { data: { id: "merchant-new-1" }, error: null },
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
  sendEmail: async (input: Record<string, unknown>) => {
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

const VALID = { shopName: "Boulangerie des Pâquis", email: "nadia@boulangerie.ch", primaryColor: "#0D6B5E" };

beforeEach(() => {
  state.denied = null;
  state.createUserError = null;
  state.insertError = null;
  calls.createUser = [];
  calls.deleteUser = [];
  calls.inserts = [];
  calls.audits = [];
  calls.emails = [];
});

describe("POST /api/admin/merchants — #2 cohérence concierge", () => {
  it("crée la ligne marchand avec TOUS les marqueurs d'onboarding concierge", async () => {
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);

    const insert = calls.inserts.find((i) => i.table === "merchants");
    expect(insert, "un INSERT merchants doit avoir lieu").toBeTruthy();
    const p = insert!.payload;

    // Marqueurs métier déjà présents
    expect(p.role).toBe("merchant");
    expect(p.email).toBe(VALID.email);
    // Marqueurs de cohérence concierge (le cœur du correctif #2)
    expect(p.setup_mode).toBe("concierge");
    expect(p.managed_by_concierge).toBe(true);
    expect(p.signup_source).toBe("concierge");
    // onboarding daté → le marchand n'est jamais routé vers le wizard / l'écran
    // « confirmez votre adresse » (résout #4, symptôme aval de #2).
    expect(typeof p.onboarding_completed_at).toBe("string");
    expect(Number.isNaN(Date.parse(p.onboarding_completed_at as string))).toBe(false);
  });
});

describe("POST /api/admin/merchants — #1 isolation de la session admin", () => {
  it("confirme l'email à la création (aucun écran « validez votre email » en aval)", async () => {
    await POST(makeReq(VALID));
    expect(calls.createUser).toHaveLength(1);
    expect(calls.createUser[0].email_confirm).toBe(true);
  });

  it("n'introduit AUCUN appel mutateur de session dans le chemin de création", () => {
    // Garde statique : le handler ne doit JAMAIS basculer la session du
    // navigateur appelant (sinon l'admin se retrouve connecté en tant que le
    // nouveau marchand). Il n'utilise que supabaseAdmin (service-role, sans
    // cookies) ; toute réintroduction de signUp/setSession/signInWithPassword/
    // verifyOtp ou du client SSR à cookies casserait l'isolation.
    const src = readFileSync(
      join(__dirname, "..", "route.ts"),
      "utf8",
    );
    for (const forbidden of [
      "signUp",
      "setSession",
      "signInWithPassword",
      "verifyOtp",
      "refreshSession",
      "exchangeCodeForSession",
      "@/utils/supabase/server",
    ]) {
      expect(src, `route.ts ne doit pas référencer ${forbidden}`).not.toContain(forbidden);
    }
  });
});
