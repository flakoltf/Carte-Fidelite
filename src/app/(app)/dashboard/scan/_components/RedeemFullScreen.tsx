"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gift, Check, Loader2 } from "lucide-react";

type Phase = "ready" | "redeeming" | "done" | "error";

export interface RedeemFullScreenProps {
  /** Payload QR signé OU UUID de carte — transmis tel quel à /api/redeem. */
  cardId: string;
  /** Récompense en clair, ex. « ☕ Café offert ». */
  rewardLabel: string;
  /** Lien « Annuler » : retour au scan. */
  onCancel: () => void;
  /** Après encaissement réussi (défaut : retour à la home comptoir). */
  onRedeemed?: () => void;
}

// UXP-2 : célébration plus courte (8 confettis, ~0,5 s) et redirection à 600 ms
// pour enchaîner le client suivant sans attente. Le bruit du comptoir ? Le
// marchand active `halo_silent_mode` (localStorage = "1") : ni vibration ni
// confettis, juste un check vert — réglage local, aucune écriture serveur.
const CONFETTI = Array.from({ length: 8 }, (_, i) => i);
const CONFETTI_MS = 0.5;
const REDIRECT_MS = 600;

function isSilentMode(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("halo_silent_mode") === "1";
  } catch {
    // localStorage indisponible (mode privé strict) → célébration normale.
    return false;
  }
}

// Plein écran « Offrir la récompense » — 1 tap. Affiché dès qu'un scan renvoie
// rewardReady. Fond doré, récompense en énorme, un seul bouton plein-largeur.
export default function RedeemFullScreen({
  cardId,
  rewardLabel,
  onCancel,
  onRedeemed,
}: RedeemFullScreenProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const [silent, setSilent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const finish = useCallback(() => {
    if (onRedeemed) onRedeemed();
    else router.push("/dashboard");
  }, [onRedeemed, router]);

  const handleRedeem = useCallback(async () => {
    setPhase("redeeming");
    setError("");
    try {
      const res = await fetch("/api/scan/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Échec de l'encaissement.");
      const quiet = isSilentMode();
      setSilent(quiet);
      if (!quiet && typeof window !== "undefined" && window.navigator?.vibrate) window.navigator.vibrate(200);
      setPhase("done");
      timer.current = setTimeout(finish, REDIRECT_MS);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Échec de l'encaissement. Réessayez.");
    }
  }, [cardId, finish]);

  const busy = phase === "redeeming";
  const done = phase === "done";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Offrir la récompense"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-onyx"
      style={{ background: "var(--color-gold-grad)" }}
    >
      {/* Région d'annonce pour lecteurs d'écran (succès / erreur). */}
      <p aria-live="assertive" className="sr-only">
        {done ? "Récompense offerte." : phase === "error" ? error : ""}
      </p>

      {/* Confettis + halo au succès — sautés en mode silencieux. */}
      {done && !silent && (
        <>
          <motion.div
            aria-hidden="true"
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: CONFETTI_MS, ease: "easeOut" }}
            className="pointer-events-none absolute h-40 w-40 rounded-full bg-white/60"
          />
          {CONFETTI.map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              initial={{ y: 0, x: 0, opacity: 1 }}
              animate={{ y: 320, x: (i % 2 ? 1 : -1) * (40 + i * 12), opacity: 0, rotate: 360 }}
              transition={{ duration: CONFETTI_MS, ease: "easeOut" }}
              className="pointer-events-none absolute top-1/3 h-3 w-3 rounded-[2px] bg-white"
            />
          ))}
        </>
      )}

      <div className="relative z-10 flex flex-col items-center gap-8">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full bg-white/35 backdrop-blur"
          aria-hidden="true"
        >
          {done ? <Check className={`h-11 w-11 ${silent ? "text-emerald-600" : ""}`} /> : <Gift className="h-11 w-11" />}
        </span>

        <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          {done ? "Récompense offerte" : rewardLabel}
        </h1>

        {!done && (
          <p className="-mt-4 text-lg font-medium text-onyx/70">
            Offrez-la à votre client, c&apos;est validé en un geste.
          </p>
        )}
      </div>

      {!done && (
        <div className="relative z-10 mt-12 flex w-full max-w-md flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleRedeem}
            disabled={busy}
            className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-onyx text-xl font-extrabold tracking-tight text-white shadow-xl transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Gift className="h-6 w-6" aria-hidden="true" />
            )}
            {busy ? "Encaissement…" : "OFFRIR · valider la récompense"}
          </button>

          {phase === "error" && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 text-sm font-medium text-onyx/60 underline-offset-4 hover:underline disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
