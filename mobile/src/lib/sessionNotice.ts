import { useEffect, useState } from "react";

// Notice « session expirée » : posée par le client API sur un 401 en cours
// d'usage, lue UNE fois par l'écran de connexion. Minuscule store sans
// dépendance — un message, pas un état global.

export const SESSION_EXPIRED_MESSAGE = "Votre session a expiré. Reconnectez-vous.";

let pending: string | null = null;
const listeners = new Set<() => void>();

export function markSessionExpired(): void {
  pending = SESSION_EXPIRED_MESSAGE;
  listeners.forEach((listener) => listener());
}

/** Lit et efface la notice : un seul écran l'affiche, une seule fois. */
export function takeSessionNotice(): string | null {
  const notice = pending;
  pending = null;
  return notice;
}

/** Notice à afficher sur l'écran de connexion (au montage, ou si elle arrive après). */
export function useSessionNotice(): string | null {
  const [notice, setNotice] = useState<string | null>(() => takeSessionNotice());
  useEffect(() => {
    const listener = () => setNotice(takeSessionNotice());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return notice;
}

/** Réservé aux tests. */
export function _resetSessionNotice(): void {
  pending = null;
  listeners.clear();
}
