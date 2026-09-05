// Port d'authentification : l'écran ne connaît que ce contrat, jamais Supabase.
// Un test injecte une implémentation en mémoire — aucun appel réseau.
import type { AuthStatus } from "../authFlow";

export interface MerchantProfile {
  id: string;
  shopName: string | null;
  role: "merchant" | "admin" | null;
  email: string | null;
}

export interface AuthGateway {
  /** Statut réel de la session stockée (au démarrage et après chaque événement). */
  resolveStatus(): Promise<AuthStatus>;
  /** Mot de passe accepté → « signed-in » ou « mfa-required ». Jette en cas d'échec. */
  signInWithPassword(email: string, password: string): Promise<AuthStatus>;
  /** Second facteur TOTP. Jette si le code est refusé. */
  verifyTotp(code: string): Promise<void>;
  signOut(): Promise<void>;
  /** Fiche du commerce liée au compte connecté (nom d'enseigne, rôle). */
  loadMerchant(): Promise<MerchantProfile | null>;
  /** S'abonne aux changements de session ; renvoie la fonction de désabonnement. */
  subscribe(onChange: () => void): () => void;
}
