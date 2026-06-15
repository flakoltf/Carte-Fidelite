import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks I/O hoistés ; resolveEffectiveMerchantId reste réel (déjà testé).
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  ownMaybeSingle: vi.fn(),
  targetMaybeSingle: vi.fn(),
  readImpersonationCookie: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.ownMaybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.targetMaybeSingle }) }) }),
  },
}));
vi.mock("@/lib/admin/impersonation", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin/impersonation")>()),
  readImpersonationCookie: h.readImpersonationCookie,
}));

import { currentMerchantContext } from "../currentMerchant";

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockReset());
});

describe("currentMerchantContext", () => {
  it("anonyme : tout null, jamais d'impersonation", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const ctx = await currentMerchantContext();
    expect(ctx).toMatchObject({ merchantId: null, ownMerchantId: null, role: null, isImpersonating: false });
  });

  it("user sans ligne merchants : .maybeSingle ne throw pas → contexte vide propre", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.ownMaybeSingle.mockResolvedValue({ data: null });
    const ctx = await currentMerchantContext();
    expect(ctx.merchantId).toBeNull();
    expect(ctx.role).toBeNull();
  });

  it("marchand normal : merchantId = ownMerchantId, pas d'impersonation, chemin rapide", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    h.ownMaybeSingle.mockResolvedValue({ data: { id: "m1", role: "merchant" } });
    const ctx = await currentMerchantContext();
    expect(ctx).toMatchObject({ merchantId: "m1", ownMerchantId: "m1", role: "merchant", isImpersonating: false });
    expect(h.readImpersonationCookie).not.toHaveBeenCalled();
  });

  it("admin sans cookie : son propre marchand, pas d'impersonation", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "a1" } } });
    h.ownMaybeSingle.mockResolvedValue({ data: { id: "adm", role: "admin" } });
    h.readImpersonationCookie.mockResolvedValue(null);
    const ctx = await currentMerchantContext();
    expect(ctx).toMatchObject({ merchantId: "adm", ownMerchantId: "adm", isImpersonating: false });
  });

  it("admin impersonifiant une cible existante : merchantId = cible, isImpersonating true, ownMerchantId conservé", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "a1" } } });
    h.ownMaybeSingle.mockResolvedValue({ data: { id: "adm", role: "admin" } });
    h.readImpersonationCookie.mockResolvedValue("target");
    h.targetMaybeSingle.mockResolvedValue({ data: { id: "target" } });
    const ctx = await currentMerchantContext();
    expect(ctx).toMatchObject({ merchantId: "target", ownMerchantId: "adm", isImpersonating: true });
  });

  it("admin avec cible inexistante : repli sur son propre marchand, pas d'impersonation", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "a1" } } });
    h.ownMaybeSingle.mockResolvedValue({ data: { id: "adm", role: "admin" } });
    h.readImpersonationCookie.mockResolvedValue("ghost");
    h.targetMaybeSingle.mockResolvedValue({ data: null });
    const ctx = await currentMerchantContext();
    expect(ctx).toMatchObject({ merchantId: "adm", isImpersonating: false });
  });
});
