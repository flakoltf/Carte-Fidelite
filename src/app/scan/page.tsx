"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, RefreshCw, CheckCircle, AlertCircle, Loader2, Gift } from "lucide-react";

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [goal, setGoal] = useState(10);
  const [rewardReady, setRewardReady] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (status === "scanning") {
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0
        }, false);
        scanner.render(onScanSuccess, onScanFailure);
        function onScanSuccess(decodedText: string) { scanner.clear(); handleProcessScan(decodedText); }
        function onScanFailure() { /* ignore */ }
        return () => { scanner.clear(); };
    }
  }, [status]);

  const handleProcessScan = async (cardId: string) => {
    setStatus("processing");
    setRedeemed(false);
    try {
      const res = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId })
      });
      const data = await res.json();
      if (data.success) {
        setScanResult(cardId);
        setCardDetails(data.card);
        setGoal(data.stampGoal ?? 10);
        setRewardReady(!!data.rewardReady);
        setStatus("success");
        setMessage(data.added
          ? `Point ajouté à ${data.card.customers.full_name} !`
          : `${data.card.customers.full_name} a une récompense prête.`);
        if (typeof window !== "undefined" && window.navigator.vibrate) window.navigator.vibrate(200);
      } else {
        setStatus("error");
        setMessage(data.error || "Erreur lors du scan");
      }
    } catch {
      setStatus("error");
      setMessage("Erreur réseau ou serveur");
    }
  };

  const handleRedeem = async () => {
    if (!scanResult) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: scanResult })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setRedeemed(true);
      setRewardReady(false);
      setCardDetails(data.card);
      setMessage("Récompense remise ✅ La carte repart à zéro.");
    } catch {
      setMessage("Échec de l'encaissement. Réessayez.");
    } finally {
      setRedeeming(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null); setCardDetails(null); setStatus("scanning");
    setMessage(""); setRewardReady(false); setRedeemed(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Letaief Scanner
            </h1>
            <p className="text-zinc-500 mt-2">Validez les tampons de vos clients en un clin d&apos;œil.</p>
        </div>

        <div className="relative aspect-square w-full bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center">

          {status === "idle" && (
            <button onClick={() => setStatus("scanning")}
                className="group flex flex-col items-center gap-4 transition-transform hover:scale-105">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                    <Camera className="w-10 h-10 text-emerald-400" />
                </div>
                <span className="font-semibold text-lg">Démarrer le Scan</span>
            </button>
          )}

          {status === "scanning" && (<div id="reader" className="w-full h-full"></div>)}

          {status === "processing" && (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                <span className="text-zinc-400 animate-pulse">Vérification de la carte...</span>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center p-8 animate-in zoom-in duration-300 w-full">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg ${rewardReady && !redeemed ? "bg-amber-500 shadow-amber-500/20" : "bg-emerald-500 shadow-emerald-500/20"}`}>
                    {rewardReady && !redeemed ? <Gift className="w-12 h-12 text-white" /> : <CheckCircle className="w-12 h-12 text-white" />}
                </div>
                <h2 className="text-2xl font-bold mb-2">{rewardReady && !redeemed ? "Récompense prête 🎁" : "Validé !"}</h2>
                <p className={`font-medium mb-4 text-center ${rewardReady && !redeemed ? "text-amber-400" : "text-emerald-400"}`}>{message}</p>

                {cardDetails && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Solde</span>
                            <span className="text-white font-mono text-lg">{cardDetails.stamps_count} / {goal}</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-1000"
                                style={{ width: `${Math.min(100, (cardDetails.stamps_count / goal) * 100)}%` }}></div>
                        </div>
                    </div>
                )}

                {rewardReady && !redeemed && (
                    <button onClick={handleRedeem} disabled={redeeming}
                        className="flex items-center gap-2 bg-amber-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 mb-3 w-full justify-center">
                        <Gift className="w-4 h-4" />
                        {redeeming ? "…" : "Remettre la récompense"}
                    </button>
                )}

                <button onClick={resetScanner}
                    className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors w-full justify-center">
                    <RefreshCw className="w-4 h-4" />
                    Scan Suivant
                </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center p-8 animate-in shake duration-500">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-red-500">Oups !</h2>
                <p className="text-zinc-400 mb-8 text-center">{message}</p>
                <button onClick={resetScanner}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-all">
                    Réessayer
                </button>
            </div>
          )}

        </div>

        <div className="mt-8 flex justify-center gap-4">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Serveur Opérationnel
            </div>
        </div>
      </div>

      <style jsx global>{`
        #reader__scan_region { background: transparent !important; }
        #reader__dashboard { display: none !important; }
        #reader video { border-radius: 20px !important; object-fit: cover !important; }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-in.shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
    </div>
  );
}
