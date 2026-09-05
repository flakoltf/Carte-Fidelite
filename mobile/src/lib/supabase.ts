import { AppState, type AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getConfig } from "./config";
import { createChunkedStorage } from "./secureStorage";

// Client Supabase de l'app marchande. Session persistée dans le trousseau via
// expo-secure-store (jamais AsyncStorage : le jeton de rafraîchissement est un
// secret à long terme).
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { supabaseUrl, supabaseAnonKey } = getConfig();

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: createChunkedStorage(SecureStore),
      autoRefreshToken: true,
      persistSession: true,
      // Pas de callback OAuth par URL sur mobile : on reste sur mot de passe + TOTP.
      detectSessionInUrl: false,
    },
  });
  return client;
}

/**
 * Supabase ne rafraîchit le jeton que si on lui dit quand l'app est au premier
 * plan : sans cela, une app laissée en arrière-plan revient avec un jeton mort.
 */
export function startSessionAutoRefresh(supabase: SupabaseClient = getSupabase()) {
  const handle = (state: AppStateStatus) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  };
  handle(AppState.currentState);
  const subscription = AppState.addEventListener("change", handle);
  return () => subscription.remove();
}

/** Réservé aux tests. */
export function resetSupabaseClient(): void {
  client = null;
}
