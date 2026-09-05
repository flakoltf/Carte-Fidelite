import {
  DEFAULT_API_BASE_URL,
  looksLikeServiceRoleKey,
  normalizeBaseUrl,
  readConfig,
} from "../config";

const base = {
  EXPO_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "cle-anon",
};

describe("readConfig", () => {
  it("lit l'URL et la clé anon, et complète l'API par défaut", () => {
    expect(readConfig(base)).toEqual({
      supabaseUrl: "https://exemple.supabase.co",
      supabaseAnonKey: "cle-anon",
      apiBaseUrl: DEFAULT_API_BASE_URL,
    });
  });

  it("retire le slash final des deux bases", () => {
    const config = readConfig({
      EXPO_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co/",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "cle-anon",
      EXPO_PUBLIC_API_BASE_URL: "https://app.halocard.ch//",
    });
    expect(config.supabaseUrl).toBe("https://exemple.supabase.co");
    expect(config.apiBaseUrl).toBe("https://app.halocard.ch");
  });

  it("nomme les variables manquantes dans le message", () => {
    expect(() => readConfig({})).toThrow(/EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    expect(() => readConfig({ EXPO_PUBLIC_SUPABASE_URL: "https://x.co" })).toThrow(
      /EXPO_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("traite une valeur vide ou blanche comme manquante", () => {
    expect(() =>
      readConfig({ ...base, EXPO_PUBLIC_SUPABASE_ANON_KEY: "   " }),
    ).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("refuse une clé service-role au format JWT", () => {
    const payload = globalThis.btoa(JSON.stringify({ role: "service_role" }));
    expect(() =>
      readConfig({ ...base, EXPO_PUBLIC_SUPABASE_ANON_KEY: `entete.${payload}.signature` }),
    ).toThrow(/service-role/);
  });

  it("refuse une clé secrète au format sb_secret_", () => {
    expect(() =>
      readConfig({ ...base, EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc123" }),
    ).toThrow(/service-role/);
  });

  it("accepte une clé anon au format JWT", () => {
    const payload = globalThis.btoa(JSON.stringify({ role: "anon" }));
    const key = `entete.${payload}.signature`;
    expect(looksLikeServiceRoleKey(key)).toBe(false);
    expect(readConfig({ ...base, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }).supabaseAnonKey).toBe(key);
  });

  it("ne se laisse pas piéger par une clé non décodable", () => {
    expect(looksLikeServiceRoleKey("pas.un.jwt")).toBe(false);
  });
});

describe("normalizeBaseUrl", () => {
  it("laisse une URL déjà propre intacte", () => {
    expect(normalizeBaseUrl("https://app.halocard.ch")).toBe("https://app.halocard.ch");
  });
});
