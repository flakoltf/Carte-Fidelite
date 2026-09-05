// Configuration publique de l'app. AUCUN secret ici : seules les valeurs
// destinées au client (URL Supabase + clé anon) sont lues, exactement comme
// côté web (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).
// Expo n'expose au bundle que les variables préfixées EXPO_PUBLIC_.

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Base des appels métier (routes /api de l'app Next). Sans slash final. */
  apiBaseUrl: string;
}

export const DEFAULT_API_BASE_URL = "https://app.halocard.ch";

export type EnvSource = Record<string, string | undefined>;

/**
 * Une clé service-role donne un accès total à la base en contournant RLS :
 * elle n'a rien à faire dans un bundle mobile. On la refuse explicitement,
 * qu'elle soit au format JWT historique ou au format `sb_secret_…`.
 */
export function looksLikeServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = globalThis.atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)?.role === "service_role";
  } catch {
    return false;
  }
}

/** Retire le slash final pour que les concaténations de chemins restent propres. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function readConfig(env: EnvSource): AppConfig {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const missing = [
    supabaseUrl ? null : "EXPO_PUBLIC_SUPABASE_URL",
    supabaseAnonKey ? null : "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((v): v is string => v !== null);

  if (missing.length > 0) {
    throw new Error(
      `Configuration manquante : ${missing.join(", ")}. ` +
        "Copiez mobile/.env.example vers mobile/.env.local et renseignez les valeurs.",
    );
  }

  if (looksLikeServiceRoleKey(supabaseAnonKey!)) {
    throw new Error(
      "EXPO_PUBLIC_SUPABASE_ANON_KEY contient une clé service-role. " +
        "Utilisez la clé anon (publique) : une clé service-role dans un bundle mobile est exposée à tous.",
    );
  }

  return {
    supabaseUrl: normalizeBaseUrl(supabaseUrl!),
    supabaseAnonKey: supabaseAnonKey!,
    apiBaseUrl: normalizeBaseUrl(env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL),
  };
}

let cached: AppConfig | null = null;

/** Lecture paresseuse : rien n'explose à l'import, tout explose au premier usage. */
export function getConfig(): AppConfig {
  if (!cached) cached = readConfig(process.env as EnvSource);
  return cached;
}

/** Réservé aux tests. */
export function resetConfigCache(): void {
  cached = null;
}
