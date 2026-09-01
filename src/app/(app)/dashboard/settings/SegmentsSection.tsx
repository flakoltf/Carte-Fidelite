"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, UserMinus } from "lucide-react";

// Réglage des seuils « client en train de partir » / « perdu » — langage
// simple, pas de jargon (pas de « segments », pas de « churn »). Les valeurs
// vivent dans merchants.segment_config via /api/merchant/segments.
export function SegmentsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeDays, setActiveDays] = useState("30");
  const [atRiskDays, setAtRiskDays] = useState("90");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/merchant/segments");
        if (res.ok) {
          const json = await res.json();
          setActiveDays(String(json.active_days));
          setAtRiskDays(String(json.at_risk_days));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/merchant/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_days: Number(activeDays), at_risk_days: Number(atRiskDays) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.error || "Erreur." });
      } else {
        setMsg({ ok: true, text: "Seuils enregistrés — vos listes de clients s'ajustent immédiatement." });
      }
    } catch {
      setMsg({ ok: false, text: "Erreur de connexion." });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-20 bg-surface border border-line-warm rounded-xl py-2 px-3 text-sm text-onyx text-center focus:border-halo outline-none transition-all";

  return (
    <div className="bg-surface border border-line-warm rounded-3xl p-8 space-y-5 shadow-sm">
      <div>
        <h2 className="font-bold text-onyx flex items-center gap-2">
          <UserMinus className="w-4 h-4 text-halo" aria-hidden /> Clients en train de partir
        </h2>
        <p className="text-sm text-galet-ink mt-1">
          Trois semaines sans visite n&apos;ont pas le même sens pour un café et pour un coiffeur.
          Réglez ces seuils selon le rythme de votre commerce.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-galet-ink">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Chargement…
        </div>
      ) : (
        <>
          <div className="space-y-3 text-sm text-onyx">
            <label htmlFor="seg-active" className="flex flex-wrap items-center gap-2">
              Un client est «&nbsp;en train de partir&nbsp;» après
              <input id="seg-active" type="number" min={7} max={364} inputMode="numeric"
                value={activeDays} onChange={(e) => setActiveDays(e.target.value)} className={inputCls} />
              jours sans visite.
            </label>
            <label htmlFor="seg-atrisk" className="flex flex-wrap items-center gap-2">
              Il est considéré perdu après
              <input id="seg-atrisk" type="number" min={8} max={365} inputMode="numeric"
                value={atRiskDays} onChange={(e) => setAtRiskDays(e.target.value)} className={inputCls} />
              jours.
            </label>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" onClick={save} disabled={saving}
              className="bg-halo text-white font-bold py-2.5 px-6 rounded-2xl hover:bg-halo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
              Enregistrer les seuils
            </button>
            {msg && (
              <p role="status" aria-live="polite" className={`text-sm ${msg.ok ? "text-halo" : "text-red-600"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
