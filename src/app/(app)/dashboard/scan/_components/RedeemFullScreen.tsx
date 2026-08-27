"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Gift, Check, Loader2 } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";
import type { PointsTier } from "@/lib/loyalty/types";
import { useFocusTrap } from "../../_components/useFocusTrap";

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
  /**
   * Carte à points (Task 12) : paliers atteints et pas encore validés sur ce
   * cycle (`redeemableTiers` de la réponse /api/scan). Présent → un bouton par
   * palier, POST { cardId, tierThreshold }. Absent → comportement inchangé
   * (tampons/amount_points : un seul bouton OFFRIR, POST { cardId }).
   */
  tiers?: PointsTier[];
  /** Seuil du palier maximum (points) : marque le bouton « remet la carte à zéro ». */
  maxThreshold?: number;
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
  tiers,
  maxThreshold,
}: RedeemFullScreenProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const [silent, setSilent] = useState(false);
  // Carte à points : liste locale des paliers encore validables (rétrécit à
  // chaque validation intermédiaire) + titre de l'écran « done » (générique,
  // sauf palier max qui remet le cycle à zéro).
  const hasTiers = Array.isArray(tiers);
  const [remainingTiers, setRemainingTiers] = useState<PointsTier[]>(() => tiers ?? []);
  const [redeemedNote, setRedeemedNote] = useState<string | null>(null);
  const [doneHeadline, setDoneHeadline] = useState("Récompense offerte");
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
      setDoneHeadline("Récompense offerte");
      setPhase("done");
      timer.current = setTimeout(finish, REDIRECT_MS);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Échec de l'encaissement. Réessayez.");
    }
  }, [cardId, finish]);

  // Carte à points : valide UN palier précis (spec 2026-08-26). Le palier max
  // remet le cycle à zéro côté serveur (`cycleReset`) → même célébration/
  // redirection que l'encaissement classique. Un palier intermédiaire retire
  // simplement ce bouton de la liste locale : le staff reste sur l'écran pour
  // enchaîner un autre palier ou taper « Terminer ».
  const handleRedeemTier = useCallback(
    async (threshold: number) => {
      setPhase("redeeming");
      setError("");
      try {
        const res = await fetch("/api/scan/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId, tierThreshold: threshold }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) throw new Error(data?.error || "Échec de l'encaissement.");
        const quiet = isSilentMode();
        setSilent(quiet);
        if (data.cycleReset) {
          if (!quiet && typeof window !== "undefined" && window.navigator?.vibrate) window.navigator.vibrate(200);
          setDoneHeadline("Carte remise à zéro");
          setPhase("done");
          timer.current = setTimeout(finish, REDIRECT_MS);
          return;
        }
        const rewardText = (data?.tier?.reward as string | undefined) ?? "Récompense";
        setRemainingTiers((prev) => prev.filter((t) => t.threshold !== threshold));
        setRedeemedNote(rewardText);
        setPhase("ready");
      } catch (e) {
        setPhase("error");
        setError(e instanceof Error ? e.message : "Échec de l'encaissement. Réessayez.");
      }
    },
    [cardId, finish],
  );

  const busy = phase === "redeeming";
  const done = phase === "done";

  // Modale : focus piégé + restitué, Échap = annuler (ignoré pendant
  // l'encaissement, comme le bouton « Annuler » qui est alors désactivé).
  const trapRef = useFocusTrap<HTMLDivElement>(true, () => {
    if (phase !== "redeeming") onCancel();
  });

  return (
    <motion.div
      ref={trapRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={hasTiers ? "Choisissez la récompense" : "Offrir la récompense"}
      // Entrée plein écran : modal (non ancrée à un déclencheur) → origin centre,
      // léger scale + fondu en courbe forte. Jamais scale(0).
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-onyx"
      style={{ background: "var(--color-gold-grad)" }}
    >
      {/* Région d'annonce pour lecteurs d'écran (succès / erreur). La validation
          d'un palier intermédiaire (mode tiers) a SA PROPRE région live
          (role="status" plus bas) : on ne la duplique pas ici, sous peine de
          double annonce au même événement. */}
      <p aria-live="assertive" className="sr-only">
        {done ? `${doneHeadline}.` : phase === "error" ? error : ""}
      </p>

      {/* Confettis + halo au succès — sautés en mode silencieux. */}
      {done && !silent && (
        <>
          <motion.div
            aria-hidden="true"
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: CONFETTI_MS, ease: EASE_OUT }}
            className="pointer-events-none absolute h-40 w-40 rounded-full bg-white/60"
          />
          {CONFETTI.map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              initial={{ y: 0, x: 0, opacity: 1 }}
              animate={{ y: 320, x: (i % 2 ? 1 : -1) * (40 + i * 12), opacity: 0, rotate: 360 }}
              transition={{ duration: CONFETTI_MS, ease: EASE_OUT }}
              className="pointer-events-none absolute top-1/3 h-3 w-3 rounded-[2px] bg-white"
            />
          ))}
        </>
      )}

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.span
          className="flex h-20 w-20 items-center justify-center rounded-full bg-white/35 backdrop-blur"
          aria-hidden="true"
          // Pop ressort au succès uniquement (overshoot 0.5→1.06→1). Pas
          // d'animation au montage (initial=false) : c'est l'écran qui entre.
          initial={false}
          animate={done && !reduce ? { scale: [0.5, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          {done ? <Check className={`h-11 w-11 ${silent ? "text-emerald-600" : ""}`} /> : <Gift className="h-11 w-11" />}
        </motion.span>

        <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          {done ? doneHeadline : hasTiers ? "Choisissez la récompense" : rewardLabel}
        </h1>

        {!done && (
          <p className="-mt-4 text-lg font-medium text-onyx/70">
            {hasTiers
              ? "Choisissez le palier à valider pour votre client."
              : "Offrez-la à votre client, c’est validé en un geste."}
          </p>
        )}
      </div>

      {!done && hasTiers && (
        <div className="relative z-10 mt-12 flex w-full max-w-md flex-col items-center gap-4">
          {redeemedNote && (
            <p role="status" aria-live="polite" className="text-sm font-semibold text-onyx/80">
              Validé : {redeemedNote}. Vous pouvez valider un autre palier ou terminer.
            </p>
          )}

          {remainingTiers.length > 0 ? (
            <div className="flex w-full flex-col gap-3">
              {remainingTiers.map((t) => (
                <button
                  key={t.threshold}
                  type="button"
                  onClick={() => handleRedeemTier(t.threshold)}
                  disabled={busy}
                  className="flex w-full flex-col items-center gap-1 rounded-3xl bg-onyx px-6 py-5 text-white shadow-xl transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="text-lg font-extrabold tracking-tight">{t.reward}</span>
                  <span className="text-sm opacity-80">
                    {t.threshold} points{maxThreshold !== undefined && t.threshold === maxThreshold ? " · remet la carte à zéro" : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-onyx/70">Tous les paliers disponibles ont été validés.</p>
          )}

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
            {redeemedNote ? "Terminer" : "Annuler"}
          </button>
        </div>
      )}

      {!done && !hasTiers && (
        <div className="relative z-10 mt-12 flex w-full max-w-md flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleRedeem}
            disabled={busy}
            className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-onyx text-xl font-extrabold tracking-tight text-white shadow-xl transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="halo-spin h-6 w-6" aria-hidden="true" />
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
    </motion.div>
  );
}
