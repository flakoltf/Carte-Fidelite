"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import RedeemFullScreen from "./RedeemFullScreen";

type Mode = "idle" | "scanning" | "processing" | "added" | "reward" | "error";

// Scan comptoir : caméra plein cadre, puis soit un tampon ajouté (retour rapide
// au scan), soit l'écran doré « Offrir la récompense » (RedeemFullScreen) si la
// carte est pleine. Pensé 1 main : un grand bouton, des états très lisibles.
export default function ComptoirScan({ rewardLabel }: { rewardLabel: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState("");
  const [scanned, setScanned] = useState<string | null>(null);

  const handleScan = useCallback(async (cardId: string) => {
    setMode("processing");
    setScanned(cardId);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ cardId }),
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
      const name = data.card?.customers?.full_name as string | undefined;
      setMessage(name ? `Tampon ajouté · ${name}` : "Tampon ajouté.");
      setMode("added");
      if (typeof window !== "undefined" && window.navigator?.vibrate) window.navigator.vibrate(120);
    } catch {
      setMode("error");
      setMessage("Erreur réseau. Réessayez.");
    }
  }, []);

  useEffect(() => {
    if (mode !== "scanning") return;
    const scanner = new Html5Qrcode("comptoir-reader");
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
          stop().finally(() => handleScan(decodedText));
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
  }, [mode, handleScan]);

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
      <header className="flex h-14 items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Retour au comptoir"
          className="flex h-11 w-11 items-center justify-center rounded-full text-galet hover:bg-line-warm/60 hover:text-onyx"
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
              <Loader2 className="h-12 w-12 animate-spin text-halo" />
              <span className="animate-pulse text-galet-ink">Vérification…</span>
            </div>
          )}

          {mode === "added" && (
            <div className="flex flex-col items-center gap-5 p-8 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-halo shadow-lg shadow-halo/20">
                <CheckCircle className="h-12 w-12 text-white" />
              </span>
              <p className="text-xl font-bold">{message}</p>
              <button
                type="button"
                onClick={() => {
                  setScanned(null);
                  setMode("scanning");
                }}
                className="h-14 w-full max-w-xs rounded-2xl bg-halo text-lg font-bold text-white active:scale-[0.98]"
              >
                Scan suivant
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
