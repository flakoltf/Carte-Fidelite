import { ApiError, buildUrl, createApiClient, errorMessageFor } from "../api";

const BASE = "https://app.halocard.ch";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as Response;
}

function client(
  overrides: Partial<Parameters<typeof createApiClient>[0]> & {
    fetchImpl: jest.Mock;
  },
) {
  return createApiClient({
    baseUrl: BASE,
    getAccessToken: async () => "jeton-de-session",
    ...overrides,
  });
}

describe("buildUrl", () => {
  it("joint la base et le chemin sans doubler les slashs", () => {
    expect(buildUrl("https://app.halocard.ch/", "/api/scan")).toBe(
      "https://app.halocard.ch/api/scan",
    );
  });

  it("sérialise les paramètres et ignore null et undefined", () => {
    expect(buildUrl(BASE, "/api/clients", { q: "café", page: 2, actif: true, tri: null })).toBe(
      `${BASE}/api/clients?q=caf%C3%A9&page=2&actif=true`,
    );
  });

  it("n'ajoute pas de « ? » quand tous les paramètres sont vides", () => {
    expect(buildUrl(BASE, "/api/clients", { q: undefined })).toBe(`${BASE}/api/clients`);
  });
});

describe("createApiClient", () => {
  it("attache le jeton de session à chaque appel", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await client({ fetchImpl }).get("/api/cartes");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE}/api/cartes`);
    expect(init.headers.Authorization).toBe("Bearer jeton-de-session");
    expect(init.method).toBe("GET");
  });

  it("n'invente pas d'en-tête quand personne n'est connecté", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}));
    await client({ fetchImpl, getAccessToken: async () => null }).get("/api/cartes");

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("envoie un corps JSON typé sur POST", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ id: "c1" }));
    const body = await client({ fetchImpl }).post<{ id: string }>("/api/scan", { carte: "c1" });

    const init = fetchImpl.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ carte: "c1" });
    expect(body).toEqual({ id: "c1" });
  });

  it("ne pose pas de Content-Type sans corps", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}));
    await client({ fetchImpl }).del("/api/cartes/c1");

    expect(fetchImpl.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });

  it("remonte le message d'erreur de l'API tel quel", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ error: "Carte introuvable." }, 404));

    await expect(client({ fetchImpl }).get("/api/cartes/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Carte introuvable.",
    });
  });

  it("prévient l'app quand la session n'est plus valable", async () => {
    const onUnauthorized = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 401));

    await expect(client({ fetchImpl, onUnauthorized }).get("/api/cartes")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("ne déclenche pas la déconnexion sur une erreur serveur", async () => {
    const onUnauthorized = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 500));

    await expect(client({ fetchImpl, onUnauthorized }).get("/api/cartes")).rejects.toMatchObject({
      status: 500,
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("traduit une panne réseau en erreur lisible", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

    await expect(client({ fetchImpl }).get("/api/cartes")).rejects.toMatchObject({
      status: 0,
      message: "Connexion impossible. Vérifiez votre réseau.",
    });
  });

  it("accepte une réponse vide (204)", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(undefined, 204));
    await expect(client({ fetchImpl }).del("/api/cartes/c1")).resolves.toBeNull();
  });
});

describe("errorMessageFor", () => {
  it("fournit un repli en français par statut", () => {
    expect(errorMessageFor(401, null)).toMatch(/Session expirée/);
    expect(errorMessageFor(429, null)).toMatch(/Trop de requêtes/);
    expect(errorMessageFor(503, null)).toMatch(/indisponible/);
  });

  it("préfère le message de l'API quand il y en a un", () => {
    expect(errorMessageFor(400, { message: "Champ manquant." })).toBe("Champ manquant.");
  });
});
