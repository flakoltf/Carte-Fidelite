"use client";

// Petits stores localStorage partagés par le guidage Express (ExpressOnboarding)
// et son aiguillage (OnboardingGate). Même pattern que StartupChecklist :
// useSyncExternalStore → rendu serveur = valeur « non posée » (pas de flash),
// premier rendu client = vraie valeur, resynchronisé entre onglets.

/** Clé posée par les deux liens de sortie du guide (« masquer » / « skip »). */
export const ONBOARDING_DISMISSED_KEY = "halo_onboarding_dismissed";

/**
 * Clé « QR téléchargé / prêt à afficher » — écrite telle quelle par
 * EnrollmentQR, QrPosterButton et lue par StartupChecklist. Contrat partagé :
 * c'est la chaîne brute, pas l'import, qui fait foi.
 */
export const POSTER_DONE_KEY = "halo_poster_done";

export interface StorageFlagStore {
  subscribe: (onChange: () => void) => () => void;
  read: () => boolean;
  set: () => void;
}

/** Construit un store booléen (`value === "1"`) sur une clé localStorage. */
export function makeStorageStore(key: string): StorageFlagStore {
  const listeners = new Set<() => void>();
  return {
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    read(): boolean {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    // Notifie aussi le même onglet (l'event « storage » ne s'y déclenche pas).
    set() {
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        /* localStorage indisponible : on reste en mémoire pour cette session */
      }
      listeners.forEach((cb) => cb());
    },
  };
}

export const onboardingDismissedStore = makeStorageStore(ONBOARDING_DISMISSED_KEY);
export const posterDoneStore = makeStorageStore(POSTER_DONE_KEY);
