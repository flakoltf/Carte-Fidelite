"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Camera, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import type { LoyaltyType } from "@/lib/loyalty/types";
import { EASE_OUT } from "@/lib/motion";
import RedeemFullScreen from "./RedeemFullScreen";
import AmountPad from "./AmountPad";

type Mode = "idle" | "scanning" | "amount" | "processing" | "added" | "reward" | "error";

// UXP-3 « scan continu » : après un crédit simple (mode "added"), on relance la
// caméra tout seul après ce délai — zéro tap entre deux clients. Le toast de
// confirmation reste affiché pendant ce laps. (reward/error gardent leur tap.)
const SCAN_CONTINU_MS = 1500;

// Scan comptoir : caméra plein cadre, puis selon le programme du marchand :
// - amount_points : on demande le montant CHF (<AmountPad>) AVANT de créditer ;
// - sinon : crédit direct (tampon/visite).
// Ensuite : écran doré « Offrir la récompense » (RedeemFullScreen) si la carte
// est au seuil, sinon confirmation rapide. Pensé 1 main, états très lisibles.
export default function ComptoirScan({
  programType,
  rewardLabel,
}: {
  programType: LoyaltyType;
  rewardLabel: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState("");
  const [scanned, setScanned] = useState<string | null>(null);

  // amountChf : présent UNIQUEMENT pour amount_points (envoyé dans le body) ;
  // absent → comportement actuel (tampon/visite) strictement inchangé.
  const handleScan = useCallback(async (cardId: string, amountChf?: number) => {
    setMode("processing");
    setScanned(cardId);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(amountChf === undefined ? { cardId } : { cardId, amountChf }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setMode("error");
        setMessage(data?.error || "Scan refusé.");
        return;
      }
      if (data.rewardReady) {
        setMode("reward");
        return;
      }
      if (amountChf === undefined) {
        const name = data.card?.customers?.full_name as string | undefined;
        setMessage(name ? `Tampon ajouté · ${name}` : "Tampon ajouté.");
      } else {
        // amount_points : la réponse porte pointsEarned/currentValue (pas de carte).
        const pts = typeof data.pointsEarned === "number" ? data.pointsEarned : 0;
        setMessage(`+${pts} point${pts > 1 ? "s" : ""} crédité${pts > 1 ? "s" : ""}`);
      }
      setMode("added");
      if (typeof window !== "undefined" && window.navigator?.vibrate) window.navigator.vibrate(120);
    } catch {
      setMode("error");
      setMessage("Erreur réseau. Réessayez.");
    }
  }, []);

  // Carte décodée : amount_points → on passe par <AmountPad> avant de créditer ;
  // les autres types créditent directement (flux inchangé).
  const onDecoded = useCallback(
    (cardId: string) => {
      if (programType === "amount_points") {
        setScanned(cardId);
        setMode("amount");
      } else {
        void handleScan(cardId);
      }
    },
    [programType, handleScan],
  );

  // ── SEAM E2E (inerte en prod) ────────────────────────────────────────────
  // `NEXT_PUBLIC_E2E` est un flag NEXT_PUBLIC_ inliné au build : il n'est JAMAIS
  // posé sur le Vercel de prod (cf. la leçon Sentry DSN) → en prod ce bloc est
  // du CODE MORT et `window.__e2eDecode` reste `undefined`. En E2E il permet à
  // Playwright de déclencher le décodage QR sans caméra (headless). Le crédit
  // réel passe toujours par /api/scan (mocké en test). cf. e2e/README.md.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== "1") return;
    const w = window as unknown as { __e2eDecode?: (cardId: string) => void };
    w.__e2eDecode = onDecoded;
    return () => {
      delete w.__e2eDecode;
    };
  }, [onDecoded]);

  useEffect(() => {
    if (mode !== "scanning") return;
    // Décodage QR uniquement (les cartes de fidélité portent un QR) : restreindre
    // les formats accélère/fiabilise la détection, et le BarcodeDetector natif est
    // utilisé quand le navigateur le supporte. La fenêtre carrée reste adaptée au QR.
    const scanner = new Html5Qrcode("comptoir-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
    let handled = false;
    const stop = async () => {
      try {
        await scanner.stop();
      } catch {
        /* déjà arrêté */
      }
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
    };
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          if (handled) return;
          handled = true;
          stop().finally(() => onDecoded(decodedText));
        },
        () => {
          /* frame sans QR : ignoré */
        },
      )
      .catch(() => {
        setMode("error");
        setMessage("Caméra inaccessible. Autorisez l'accès puis réessayez.");
      });
    return () => {
      handled = true;
      void stop();
    };
  }, [mode, onDecoded]);

  // Scan continu : un crédit simple relance la caméra seule après SCAN_CONTINU_MS.
  // Le marchand n'a rien à toucher ; il peut couper court via « Scanner maintenant ».
  useEffect(() => {
    if (mode !== "added") return;
    const id = setTimeout(() => {
      setScanned(null);
      setMode("scanning");
    }, SCAN_CONTINU_MS);
    return () => clearTimeout(id);
  }, [mode]);

  // amount_points : saisie du montant CHF avant le crédit.
  if (mode === "amount" && scanned) {
    return (
      <AmountPad
        onConfirm={async (amountChf) => {
          await handleScan(scanned, amountChf);
        }}
        onCancel={() => {
          setScanned(null);
          setMode("scanning");
        }}
      />
    );
  }

  // Écran doré 1-tap : plein écran par-dessus tout le reste.
  if (mode === "reward" && scanned) {
    return (
      <RedeemFullScreen
        cardId={scanned}
        rewardLabel={rewardLabel}
        onCancel={() => {
          setScanned(null);
          setMode("scanning");
        }}
        onRedeemed={() => router.push("/dashboard")}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-calcaire text-onyx">
      {/* Toast de confirmation « scan continu » : bandeau compact en haut.
          Entrée ET sortie (AnimatePresence) en courbe forte ~200 ms : il
          respire au lieu d'être coupé net quand la caméra se relance. */}
      <AnimatePresence>
        {mode === "added" && (
          <motion.div
            key="scan-toast"
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { y: -72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -72, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
          >
            <span className="flex items-center gap-2 rounded-full bg-halo px-5 py-2.5 text-base font-bold text-white shadow-lg shadow-halo/30">
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              {message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex h-14 items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Retour au comptoir"
          className="flex h-11 w-11 items-center justify-center rounded-full text-galet-ink hover:bg-line-warm/60 hover:text-onyx"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="font-display text-lg font-semibold">Scanner une carte</span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10">
        <div className="relative flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-[32px] border border-line-warm bg-surface shadow-sm">
          {mode === "idle" && (
            <button
              type="button"
              onClick={() => setMode("scanning")}
              className="flex flex-col items-center gap-4 transition-transform active:scale-95"
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-halo/10 ring-1 ring-halo/20">
                <Camera className="h-12 w-12 text-halo" />
              </span>
              <span className="text-lg font-semibold">Démarrer le scan</span>
            </button>
          )}

          {mode === "scanning" && <div id="comptoir-reader" className="h-full w-full" />}

          {mode === "processing" && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="halo-spin h-12 w-12 text-halo" />
              <span className="animate-pulse text-galet-ink">Vérification…</span>
            </div>
          )}

          {mode === "added" && (
            <div className="flex flex-col items-center gap-5 p-8 text-center">
              {/* Pop ressort : rien n'apparaît depuis le néant (jamais scale(0)). */}
              <motion.span
                initial={reduce ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0.18 } : { type: "spring", duration: 0.4, bounce: 0.3 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-halo shadow-lg shadow-halo/20"
              >
                <CheckCircle className="h-12 w-12 text-white" />
              </motion.span>
              <p className="text-xl font-bold">C&apos;est validé</p>
              {/* Pas de tap obligatoire : la caméra revient seule. Ce bouton ne
                  fait qu'écourter l'attente pour les comptoirs pressés. */}
              <button
                type="button"
                onClick={() => {
                  setScanned(null);
                  setMode("scanning");
                }}
                className="min-h-11 text-sm font-medium text-galet-ink underline-offset-4 hover:underline"
              >
                Scanner maintenant
              </button>
            </div>
          )}

          {mode === "error" && (
            <div className="flex flex-col items-center gap-5 p-8 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </span>
              <p className="font-medium text-galet-ink">{message}</p>
              <button
                type="button"
                onClick={() => setMode("scanning")}
                className="h-14 w-full max-w-xs rounded-2xl border border-line-warm bg-surface text-lg font-bold active:scale-[0.98]"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
