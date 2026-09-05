import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks I/O hoistés ; resolveEffectiveMerchantId reste réel (déjà testé).
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  ownMaybeSingle: vi.fn(),
  targetMaybeSingle: vi.fn(),
  readImpersonationCookie: vi.fn(),
  // Chemin JETON (app mobile) : client supabase-js construit avec l'en-tête
  // Authorization — on enregistre sa construction et on pilote getUser/from.
  bearerClientOptions: vi.fn(),
  bearerGetUser: vi.fn(),
  bearerOwnMaybeSingle: vi.fn(),
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
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: unknown) => {
    h.bearerClientOptions(options);
    return {
      auth: { getUser: h.bearerGetUser },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.bearerOwnMaybeSingle }) }) }),
    };
  },
}));
vi.mock("@/lib/admin/impersonation", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin/impersonation")>()),
  readImpersonationCookie: h.readImpersonationCookie,
}));

import { currentAuthSession, currentMerchantContext, currentMerchantId } from "../currentMerchant";

// Jeton d'accès factice (signature non vérifiée ici : c'est le rôle du serveur
// Auth, mocké via bearerGetUser). Seul le claim `aal` est lu localement.
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
}
function reqWithBearer(token: string | null): Request {
  return new Request("https://app.halocard.ch/api/scan", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

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

describe("currentMerchantContext — jeton Bearer (app mobile)", () => {
  const TOKEN = fakeJwt({ sub: "u-mobile", aal: "aal1" });

  beforeEach(() => {
    // Pas de cookie de session par défaut dans ce bloc.
    h.getUser.mockResolvedValue({ data: { user: null } });
  });

  it("jeton valide + route opt-in → marchand résolu via le client porteur du jeton", async () => {
    h.bearerGetUser.mockResolvedValue({ data: { user: { id: "u-mobile", factors: [] } }, error: null });
    h.bearerOwnMaybeSingle.mockResolvedValue({ data: { id: "m-mobile", role: "merchant" } });

    const ctx = await currentMerchantContext({ request: reqWithBearer(TOKEN) });

    expect(ctx).toMatchObject({ merchantId: "m-mobile", ownMerchantId: "m-mobile", userId: "u-mobile", role: "merchant", isImpersonating: false });
    // Le jeton est vérifié par le serveur Auth (jamais décodé « à la confiance »).
    expect(h.bearerGetUser).toHaveBeenCalledWith(TOKEN);
    // Le client porteur transmet le jeton à PostgREST (RLS = l'utilisateur, pas l'anon).
    expect(h.bearerClientOptions).toHaveBeenCalledWith(
      expect.objectContaining({ global: { headers: { Authorization: `Bearer ${TOKEN}` } } }),
    );
    // La ligne merchants est lue via CE client, pas via le client cookie.
    expect(h.ownMaybeSingle).not.toHaveBeenCalled();
  });

  it("currentMerchantId({ request }) suit le même chemin", async () => {
    h.bearerGetUser.mockResolvedValue({ data: { user: { id: "u-mobile", factors: [] } }, error: null });
    h.bearerOwnMaybeSingle.mockResolvedValue({ data: { id: "m-mobile", role: "merchant" } });
    expect(await currentMerchantId({ request: reqWithBearer(TOKEN) })).toBe("m-mobile");
  });

  it("sans option request, l'en-tête Bearer est IGNORÉ (opt-in route par route)", async () => {
    h.bearerGetUser.mockResolvedValue({ data: { user: { id: "u-mobile", factors: [] } }, error: null });
    const ctx = await currentMerchantContext();
    expect(ctx.merchantId).toBeNull();
    expect(h.bearerGetUser).not.toHaveBeenCalled();
  });

  it("request sans en-tête Authorization et sans cookie → anonyme, aucun appel réseau jeton", async () => {
    const ctx = await currentMerchantContext({ request: reqWithBearer(null) });
    expect(ctx.merchantId).toBeNull();
    expect(h.bearerGetUser).not.toHaveBeenCalled();
  });

  it("jeton refusé par le serveur Auth (invalide/expiré) → anonyme", async () => {
    h.bearerGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } });
    const ctx = await currentMerchantContext({ request: reqWithBearer(TOKEN) });
    expect(ctx).toMatchObject({ merchantId: null, userId: null });
    expect(h.bearerOwnMaybeSingle).not.toHaveBeenCalled();
  });

  it("en-tête malformé (pas un JWT) → anonyme sans appel réseau", async () => {
    const ctx = await currentMerchantContext({ request: reqWithBearer("pas-un-jwt") });
    expect(ctx.merchantId).toBeNull();
    expect(h.bearerGetUser).not.toHaveBeenCalled();
  });

  it("fail-closed : serveur Auth injoignable (throw) → anonyme", async () => {
    h.bearerGetUser.mockRejectedValue(new Error("fetch failed"));
    const ctx = await currentMerchantContext({ request: reqWithBearer(TOKEN) });
    expect(ctx.merchantId).toBeNull();
  });

  it("2FA active : jeton aal1 refusé (step-up exigé), jeton aal2 accepté", async () => {
    const withMfa = { id: "u-mfa", factors: [{ status: "verified" }] };
    h.bearerGetUser.mockResolvedValue({ data: { user: withMfa }, error: null });
    h.bearerOwnMaybeSingle.mockResolvedValue({ data: { id: "m-mfa", role: "merchant" } });

    const aal1 = await currentMerchantContext({ request: reqWithBearer(fakeJwt({ sub: "u-mfa", aal: "aal1" })) });
    expect(aal1.merchantId).toBeNull();
    expect(aal1.userId).toBeNull();

    const aal2 = await currentMerchantContext({ request: reqWithBearer(fakeJwt({ sub: "u-mfa", aal: "aal2" })) });
    expect(aal2.merchantId).toBe("m-mfa");
  });

  it("le jeton identifie sans élargir : un admin par jeton n'impersonifie JAMAIS", async () => {
    h.bearerGetUser.mockResolvedValue({ data: { user: { id: "a1", factors: [] } }, error: null });
    h.bearerOwnMaybeSingle.mockResolvedValue({ data: { id: "adm", role: "admin" } });
    h.readImpersonationCookie.mockResolvedValue("target");
    h.targetMaybeSingle.mockResolvedValue({ data: { id: "target" } });

    const ctx = await currentMerchantContext({ request: reqWithBearer(TOKEN) });
    expect(ctx).toMatchObject({ merchantId: "adm", ownMerchantId: "adm", role: "admin", isImpersonating: false });
    expect(h.readImpersonationCookie).not.toHaveBeenCalled();
  });

  it("régression verrouillée : cookie présent → le cookie gagne, le jeton n'est même pas vérifié", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-web" } } });
    h.ownMaybeSingle.mockResolvedValue({ data: { id: "m-web", role: "merchant" } });
    h.bearerGetUser.mockResolvedValue({ data: { user: { id: "u-mobile", factors: [] } }, error: null });

    const ctx = await currentMerchantContext({ request: reqWithBearer(TOKEN) });
    expect(ctx.merchantId).toBe("m-web");
    expect(h.bearerGetUser).not.toHaveBeenCalled();
  });
});

describe("currentAuthSession — brique commune cookie OU jeton", () => {
  it("cookie → { via: 'cookie' } avec l'utilisateur de la session", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u-web" } } });
    const s = await currentAuthSession();
    expect(s?.via).toBe("cookie");
    expect(s?.user.id).toBe("u-web");
  });

  it("jeton → { via: 'bearer' }, client porteur exposé pour les lectures RLS", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    h.bearerGetUser.mockResolvedValue({ data: { user: { id: "u-mobile", factors: [] } }, error: null });
    const token = fakeJwt({ sub: "u-mobile", aal: "aal1" });
    const s = await currentAuthSession({ request: reqWithBearer(token) });
    expect(s?.via).toBe("bearer");
    expect(s?.user.id).toBe("u-mobile");
    expect(typeof s?.supabase.from).toBe("function");
  });

  it("ni cookie ni jeton → null (401 côté route, comme aujourd'hui)", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect(await currentAuthSession()).toBeNull();
    expect(await currentAuthSession({ request: reqWithBearer(null) })).toBeNull();
  });
});
