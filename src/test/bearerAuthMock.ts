// Outillage de TEST (vitest uniquement) pour l'authentification par jeton
// « Authorization: Bearer <jwt> » des routes API (app mobile commerçante).
//
// Deux comptes marchands simulés (A et B) : chaque test prouve que le jeton
// d'un marchand n'atteint JAMAIS les données de l'autre (invariant n°3).
// Le serveur Auth est simulé par `supabaseJsMock` : il « vérifie » un jeton en
// le retrouvant dans `bearerState.users` (jeton inconnu = invalide/expiré).

export type FakeUser = { id: string; factors?: { status: string }[] };

export const MERCHANT_A = { userId: "user-a", merchantId: "merchant-a" };
export const MERCHANT_B = { userId: "user-b", merchantId: "merchant-b" };

export const bearerState = {
  /** jeton → utilisateur reconnu par le serveur Auth (absent = invalide). */
  users: {} as Record<string, FakeUser>,
  /** user_id → ligne merchants lue via le client porteur (RLS). */
  merchantsByUser: {} as Record<string, { id: string; role: string }>,
  /** Session cookie (dashboard web) — null par défaut dans ces tests. */
  cookieUser: null as FakeUser | null,
  /** Panne du serveur Auth : getUser(jeton) rejette. */
  authDown: false,
  calls: { getUser: [] as string[] },
};

export function resetBearerState(): void {
  bearerState.users = {
    [tokenFor(MERCHANT_A.userId)]: { id: MERCHANT_A.userId, factors: [] },
    [tokenFor(MERCHANT_B.userId)]: { id: MERCHANT_B.userId, factors: [] },
  };
  bearerState.merchantsByUser = {
    [MERCHANT_A.userId]: { id: MERCHANT_A.merchantId, role: "merchant" },
    [MERCHANT_B.userId]: { id: MERCHANT_B.merchantId, role: "merchant" },
  };
  bearerState.cookieUser = null;
  bearerState.authDown = false;
  bearerState.calls.getUser = [];
}

// Jeton factice : signature non vérifiée ici (rôle du serveur Auth, simulé).
export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

/** Jeton déterministe d'un utilisateur (aal1 par défaut). */
export function tokenFor(userId: string, aal: "aal1" | "aal2" = "aal1"): string {
  return fakeJwt({ sub: userId, aal, role: "authenticated" });
}

/** Requête JSON avec (ou sans) en-tête Authorization: Bearer. */
export function bearerRequest(
  url: string,
  init: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string> } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  return new Request(url, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Module factice pour vi.mock("@supabase/supabase-js"). */
export const supabaseJsMock = {
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) => {
        bearerState.calls.getUser.push(jwt);
        if (bearerState.authDown) throw new Error("fetch failed");
        const user = bearerState.users[jwt];
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } };
      },
    },
    // Lecture de la ligne merchants AVEC le jeton (RLS = l'utilisateur) : on
    // simule la policy « merchant owns row » en filtrant sur user_id.
    from: () => ({
      select: () => ({
        eq: (_col: string, userId: string) => ({
          maybeSingle: async () => ({ data: bearerState.merchantsByUser[userId] ?? null, error: null }),
        }),
      }),
    }),
  }),
};

/** Module factice pour vi.mock("@/utils/supabase/server") — session cookie. */
export const cookieServerMock = {
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: bearerState.cookieUser } }) },
    from: () => ({
      select: () => ({
        eq: (_col: string, userId: string) => ({
          maybeSingle: async () => ({ data: bearerState.merchantsByUser[userId] ?? null, error: null }),
        }),
      }),
    }),
  }),
};
