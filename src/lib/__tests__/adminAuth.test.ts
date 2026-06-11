import { beforeEach, describe, expect, it, vi } from "vitest";

// Test d'AUTORISATION runtime du gate admin : un anonyme reçoit 401, un
// marchand 403, un admin passe. Complète les tests statiques de
// surfaceGuards.test.ts (qui garantissent que chaque route appelle ce gate).

const state: { user: { id: string } | null; role: string | null } = { user: null, role: null };

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
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

  it("null (accès accordé) si admin", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    expect(await requireAdminApi()).toBeNull();
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
