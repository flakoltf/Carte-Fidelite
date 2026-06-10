"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";
import type { FeatureFlag } from "@/lib/admin/platform";
import ConfirmDialog from "../components/ConfirmDialog";

// Feature flags DB : bascule confirmée + auditée (FEATURE_FLAG_UPDATED).
// La consommation d'un flag par le code applicatif se fait au cas par cas —
// cette console est la source de vérité.

export default function FlagsManager({ flags }: { flags: FeatureFlag[] }) {
  const router = useRouter();
  const [toggling, setToggling] = useState<FeatureFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", description: "" });

  async function putFlag(key: string, enabled: boolean, description?: string) {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/flags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled, ...(description !== undefined ? { description } : {}) }),
    });
    setBusy(false);
    if (r.ok) {
      setToggling(null);
      setShowForm(false);
      setForm({ key: "", description: "" });
      router.refresh();
      return true;
    }
    const body = await r.json().catch(() => ({}));
    setError(body.error ?? "Enregistrement échoué");
    return false;
  }

  return (
    <div className="space-y-4">
      {flags.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line-warm p-5 text-center text-sm text-galet-ink">
          Aucun flag applicatif en base — créez le premier ci-dessous. Les gates par variable
          d&apos;environnement restent listés à droite.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {flags.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 rounded-2xl border border-line-warm bg-calcaire p-4">
              <div className="min-w-0">
                <code className="text-sm font-bold text-onyx">{f.key}</code>
                {f.description && <p className="mt-0.5 text-xs text-galet-ink">{f.description}</p>}
                <p className="mt-0.5 text-[11px] text-galet">
                  modifié le {new Date(f.updatedAt).toLocaleString("fr-CH")}
                </p>
              </div>
              <button
                onClick={() => setToggling(f)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
                  f.enabled ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20" : "bg-galet/15 text-galet-ink hover:bg-galet/25"
                }`}
              >
                {f.enabled ? <ToggleRight className="h-5 w-5" aria-hidden /> : <ToggleLeft className="h-5 w-5" aria-hidden />}
                {f.enabled ? "Activé" : "Désactivé"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="rounded-2xl border border-line-warm bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="clé (ex. nouvelle-page-tarifs)"
              className="rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (à quoi sert ce flag ?)"
              className="rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => putFlag(form.key.trim(), false, form.description.trim())}
              disabled={busy || !/^[a-z0-9_.-]{2,64}$/.test(form.key.trim())}
              className="rounded-xl bg-halo px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-halo-600 disabled:opacity-50"
            >
              Créer (désactivé par défaut)
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-galet-ink hover:text-onyx">
              Annuler
            </button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-line-warm bg-surface px-4 py-2 text-sm font-medium text-onyx transition-colors hover:bg-calcaire"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouveau flag
        </button>
      )}

      <ConfirmDialog
        open={toggling !== null}
        title={`${toggling?.enabled ? "Désactiver" : "Activer"} « ${toggling?.key} » ?`}
        description="Le changement est immédiat pour tout code qui lit ce flag, et audité (FEATURE_FLAG_UPDATED)."
        confirmLabel={toggling?.enabled ? "Désactiver" : "Activer"}
        tone="primary"
        busy={busy}
        error={error}
        onConfirm={() => toggling && putFlag(toggling.key, !toggling.enabled)}
        onCancel={() => {
          setToggling(null);
          setError(null);
        }}
      />
    </div>
  );
}
