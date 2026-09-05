// Client API central de l'app marchande.
//
// TOUT appel vers app.halocard.ch passe par ici : c'est le seul endroit qui
// sait attacher « Authorization: Bearer <jeton de session> », normaliser les
// erreurs en français et signaler une session expirée. Les écrans des missions
// suivantes n'appellent jamais `fetch` directement.

import { getConfig } from "./config";
import { markSessionExpired } from "./sessionNotice";
import { getSupabase } from "./supabase";

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  /** Paramètres de requête ; les valeurs nulles ou indéfinies sont ignorées. */
  query?: Record<string, QueryValue>;
  /** Corps JSON. */
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }

  /**
   * La session n'est plus valable : l'appelant doit renvoyer vers la connexion.
   * SEULEMENT 401 — un 403 est un refus métier (carte d'un autre commerce,
   * compte suspendu, essai expiré) et ne doit jamais déconnecter.
   */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Renvoie le jeton d'accès courant, ou null si personne n'est connecté. */
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  /** Appelé sur 401 — branché sur la déconnexion dans l'app. */
  onUnauthorized?: () => void | Promise<void>;
}

export interface ApiClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  del<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Extrait un message lisible du corps d'erreur, sinon un repli par statut. */
export function errorMessageFor(status: number, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const candidate = (payload as { error?: unknown; message?: unknown }).error ??
      (payload as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }
  if (status === 401) return "Session expirée. Reconnectez-vous.";
  if (status === 403) return "Accès refusé.";
  if (status === 404) return "Ressource introuvable.";
  if (status === 429) return "Trop de requêtes. Patientez un instant.";
  if (status >= 500) return "Le service est momentanément indisponible. Réessayez.";
  return "La requête a échoué.";
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetchImpl ?? fetch;

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const token = await options.getAccessToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...opts.headers,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await doFetch(buildUrl(options.baseUrl, path, opts.query), {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: opts.signal,
      });
    } catch (cause) {
      // Panne réseau : statut 0, message parlant pour le comptoir.
      throw new ApiError("Connexion impossible. Vérifiez votre réseau.", 0, cause);
    }

    const raw = await response.text();
    let payload: unknown = null;
    if (raw.length > 0) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    }

    if (!response.ok) {
      const error = new ApiError(errorMessageFor(response.status, payload), response.status, payload);
      if (error.isUnauthorized) await options.onUnauthorized?.();
      throw error;
    }

    return payload as T;
  }

  return {
    request,
    get: (path, opts) => request("GET", path, opts),
    post: (path, body, opts) => request("POST", path, { ...opts, body }),
    patch: (path, body, opts) => request("PATCH", path, { ...opts, body }),
    del: (path, opts) => request("DELETE", path, opts),
  };
}

let defaultClient: ApiClient | null = null;

/**
 * Session expirée en cours d'usage (401) : on pose la notice pour l'écran de
 * connexion, puis on ferme la session Supabase — l'AuthProvider observe ce
 * changement et les onglets renvoient d'eux-mêmes vers la connexion. Ordre
 * important : la notice AVANT la déconnexion, pour que l'écran la trouve.
 */
export async function expireSession(): Promise<void> {
  markSessionExpired();
  try {
    await getSupabase().auth.signOut();
  } catch {
    // Déjà déconnecté ou réseau coupé : la session locale est de toute façon
    // inutilisable, l'écran de connexion reprend la main.
  }
}

/** Client de l'app, adossé à la session Supabase courante. */
export function api(): ApiClient {
  if (!defaultClient) {
    defaultClient = createApiClient({
      baseUrl: getConfig().apiBaseUrl,
      getAccessToken: async () => {
        const { data } = await getSupabase().auth.getSession();
        return data.session?.access_token ?? null;
      },
      onUnauthorized: expireSession,
    });
  }
  return defaultClient;
}

/** Réservé aux tests. */
export function resetApiClient(): void {
  defaultClient = null;
}
