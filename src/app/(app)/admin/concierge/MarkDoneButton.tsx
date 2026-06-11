"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

// Solde une entrée de la file « cartes à personnaliser » (design livré).
export default function MarkDoneButton({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function markDone() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/concierge/${merchantId}/done`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={markDone}
      disabled={busy}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        error
          ? "border-red-500/30 bg-red-500/10 text-red-700"
          : "border-line-warm bg-surface text-galet-ink hover:bg-calcaire"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
      {error ? "Échec — réessayer" : "Design livré"}
    </button>
  );
}
