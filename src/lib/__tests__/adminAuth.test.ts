import { beforeEach, describe, expect, it, vi } from "vitest";

// Test d'AUTORISATION runtime du gate admin : un anonyme reçoit 401, un
// marchand 403, un admin passe. Complète les tests statiques de
// surfaceGuards.test.ts (qui garantissent que chaque route appelle ce gate).

type Aal = { currentLevel: string | null; nextLevel: string | null } | "throw";
const state: { user: { id: string } | null; role: string | null; aal: Aal } = {
  user: null,
  role: null,
  // Défaut : pas de MFA enrôlée (aal1/aal1) → aucun step-up requis.
  aal: { currentLevel: "aal1", nextLevel: "aal1" },
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => {
          if (state.aal === "throw") throw new Error("auth down");
          return { data: state.aal };
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.role === null ? null : { role: state.role } }),
        }),
      }),
    }),
  }),
}));

const redirectCalls: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { requireAdminApi, requireAdminPage, getSessionRole } from "../adminAuth";

beforeEach(() => {
  state.user = null;
  state.role = null;
  state.aal = { currentLevel: "aal1", nextLevel: "aal1" };
  redirectCalls.length = 0;
});

describe("requireAdminApi (gate API fail-closed)", () => {
  it("401 si non authentifié", async () => {
    const res = await requireAdminApi();
    expect(res?.status).toBe(401);
  });

  it("403 si authentifié mais rôle merchant", async () => {
    state.user = { id: "u1" };
    state.role = "merchant";
    const res = await requireAdminApi();
    expect(res?.status).toBe(403);
  });

  it("403 si authentifié sans ligne merchants (rôle inconnu)", async () => {
    state.user = { id: "u1" };
    state.role = null;
    const res = await requireAdminApi();
    expect(res?.status).toBe(403);
  });

  it("null (accès accordé) si admin sans MFA enrôlée (aal1/aal1)", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    expect(await requireAdminApi()).toBeNull();
  });

  it("null si admin pleinement authentifié MFA (aal2/aal2)", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    state.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    expect(await requireAdminApi()).toBeNull();
  });

  it("403 mfa_required si admin avec MFA active mais step-up non fait (aal1/aal2)", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const res = await requireAdminApi();
    expect(res?.status).toBe(403);
    expect((await res?.json())?.code).toBe("mfa_required");
  });

  it("403 fail-closed si le niveau MFA est invérifiable (panne Auth)", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    state.aal = "throw";
    const res = await requireAdminApi();
    expect(res?.status).toBe(403);
  });
});

describe("requireAdminPage (gate pages)", () => {
  it("redirige vers /login si non authentifié", async () => {
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirige vers /dashboard si marchand", async () => {
    state.user = { id: "u1" };
    state.role = "merchant";
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("retourne l'userId si admin", async () => {
    state.user = { id: "u-admin" };
    state.role = "admin";
    await expect(requireAdminPage()).resolves.toEqual({ userId: "u-admin" });
  });
});

describe("getSessionRole", () => {
  it("retourne le rôle lu via RLS", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    await expect(getSessionRole()).resolves.toEqual({ userId: "u1", role: "admin" });
  });
});
