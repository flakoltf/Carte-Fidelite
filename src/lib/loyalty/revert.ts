// Annulation d'un tampon au comptoir — logique pure (testée sans réseau).
// La décision atomique vit dans la RPC scan_revert (verrou de ligne) ; ce
// module ne porte que la fenêtre et les messages, jamais d'écriture.

export const REVERT_WINDOW_SECONDS = 300; // 5 minutes — assez pour corriger, trop court pour tricher.

export type RevertStatus = "reverted" | "expired" | "empty" | "notfound";

export function normalizeRevertStatus(v: unknown): RevertStatus | null {
  return v === "reverted" || v === "expired" || v === "empty" || v === "notfound" ? v : null;
}

// Message marchand (mots simples, jamais de jargon).
export function revertStatusMessage(status: RevertStatus): string {
  switch (status) {
    case "reverted":
      return "Tampon annulé. Le compte est corrigé.";
    case "expired":
      return "Trop tard pour annuler : plus de 5 minutes se sont écoulées depuis ce tampon.";
    case "empty":
      return "Rien à annuler sur cette carte.";
    case "notfound":
      return "Carte introuvable.";
  }
}

// Secondes restantes pour annuler (pour le compte à rebours du Scanner).
// lastScan invalide ou absent → 0 (pas de bouton).
export function revertSecondsLeft(
  lastScan: string | null | undefined,
  now: Date,
  windowSeconds: number = REVERT_WINDOW_SECONDS
): number {
  if (!lastScan) return 0;
  const t = new Date(lastScan).getTime();
  if (!Number.isFinite(t)) return 0;
  const left = Math.floor((t + windowSeconds * 1000 - now.getTime()) / 1000);
  return Math.max(0, left);
}
