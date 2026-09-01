"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { redeemButtonLabel, redeemConfirmMessage, type RedeemAction } from "@/lib/customers/loyaltyCell";

// Bouton d'encaissement de la ligne client. L'ACTION est résolue en amont selon
// la mécanique du programme (loyaltyCellView) : remise à zéro (tampons),
// déduction du seuil (amount_points) ou validation d'un palier précis (points).
// visit_based / tiered n'ont pas d'encaissement → action null → rien.
export function RedeemCell({ cardId, action, customerName }: {
  cardId: string | null;
  action: RedeemAction | null;
  customerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!cardId || !action) return null;

  const redeem = async () => {
    if (!window.confirm(redeemConfirmMessage(action, customerName))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          ...(action.kind === "tier_validate" ? { tierThreshold: action.tierThreshold } : {}),
        }),
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
      <Gift className="w-3.5 h-3.5" /> {busy ? "…" : redeemButtonLabel(action)}
    </button>
  );
}
