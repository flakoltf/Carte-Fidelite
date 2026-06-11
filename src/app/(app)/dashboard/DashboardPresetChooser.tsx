"use client";

// Premier passage sur le tableau de bord : le marchand choisit ce qu'il voit.
// Deux presets, pas un configurateur — « des choix, pas des menus ».
// Le choix est persisté en base (dashboard_config existant) ; il reste
// modifiable à tout moment via « Personnaliser ».

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, LayoutGrid, Loader2 } from "lucide-react";
import { presetDashboardConfig, type DashboardPresetKey } from "@/lib/guidance/checklist";

export default function DashboardPresetChooser({ businessType }: { businessType: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState<DashboardPresetKey | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");

  async function choose(kind: DashboardPresetKey) {
    setSaving(kind);
    setError("");
    try {
      const res = await fetch("/api/dashboard-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(presetDashboardConfig(kind, businessType)),
      });
      if (!res.ok) throw new Error();
      setHidden(true);
      router.refresh();
    } catch {
      setError("Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(null);
    }
  }

  if (hidden) return null;

  return (
    <section className="rounded-3xl border border-line-warm bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="mb-1 font-bold text-onyx">Que voulez-vous voir ici ?</h2>
      <p className="mb-4 text-xs text-galet-ink">
        Vous pourrez changer d&apos;avis à tout moment avec le bouton « Personnaliser ».
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => choose("essentiel")}
          disabled={saving !== null}
          className="rounded-2xl border-2 border-halo bg-halo/[0.05] p-4 text-left transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-onyx">
            {saving === "essentiel" ? <Loader2 className="h-4 w-4 animate-spin text-halo" /> : <Gauge className="h-4 w-4 text-halo" aria-hidden />}
            L&apos;essentiel
            <span className="rounded-full bg-halo/10 px-2 py-0.5 text-[11px] font-medium text-halo">Recommandé</span>
          </span>
          <span className="block text-xs leading-relaxed text-galet-ink">
            Vos chiffres clés et la courbe des visites. Simple, lisible en 5 secondes.
          </span>
        </button>
        <button
          type="button"
          onClick={() => choose("complet")}
          disabled={saving !== null}
          className="rounded-2xl border border-line-warm bg-calcaire p-4 text-left transition-all hover:border-galet hover:shadow-md active:scale-[0.99] disabled:opacity-60"
        >
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-onyx">
            {saving === "complet" ? <Loader2 className="h-4 w-4 animate-spin text-halo" /> : <LayoutGrid className="h-4 w-4 text-galet-ink" aria-hidden />}
            Tout voir
          </span>
          <span className="block text-xs leading-relaxed text-galet-ink">
            Toutes les analyses : affluence, meilleurs clients, récompenses, adoption Wallet…
          </span>
        </button>
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
