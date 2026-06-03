"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { canRedeem } from "@/lib/loyalty/stamp";

export function RedeemCell({ cardId, stampsCount, goal, customerName }: {
  cardId: string | null;
  stampsCount: number | null;
  goal: number;
  customerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!cardId || stampsCount === null || !canRedeem(stampsCount, goal)) return null;

  const redeem = async () => {
    if (!window.confirm(`Remettre la récompense de ${customerName} ? La carte repart à zéro.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      router.refresh();
    } catch {
      window.alert("Échec de l'encaissement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={redeem} disabled={busy || done}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50">
      <Gift className="w-3.5 h-3.5" /> {busy ? "…" : "Récompense remise"}
    </button>
  );
}
