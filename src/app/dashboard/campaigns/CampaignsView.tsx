"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUDIENCE_KEYS, audienceLabel, type AudienceKey } from "@/lib/segments/audience";
import type { SegmentSummary } from "@/lib/segments/summary";

export type CampaignListItem = {
  id: string; audience: AudienceKey; title: string; body: string;
  mode: "once" | "recurring"; run_on: string | null; active: boolean;
};

type Moment = "now" | "once" | "recurring";

function statusLabel(c: CampaignListItem): string {
  if (c.mode === "once") return c.run_on ? `Programmée le ${new Date(`${c.run_on}T00:00:00`).toLocaleDateString()}` : "Programmée";
  return c.active ? "Récurrente • active" : "Récurrente • en pause";
}

export function CampaignsView({ initial }: { initial: CampaignListItem[] }) {
  const router = useRouter();
  const [summary, setSummary] = useState<SegmentSummary | null>(null);
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moment, setMoment] = useState<Moment>("now");
  const [runOn, setRunOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/segments").then((r) => (r.ok ? r.json() : null)).then((j) => setSummary(j?.data ?? null)).catch(() => {});
  }, []);

  const sizeOf = (a: AudienceKey): number | null => {
    if (!summary) return null;
    if (a === "all") return summary.total;
    if (a === "recompense_prete") return summary.flags.recompense_prete;
    return summary.stages[a]?.count ?? 0;
  };

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (moment === "now") {
        const res = await fetch("/api/notifications/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, audience }),
        });
        if (!res.ok) throw new Error();
        const j = await res.json();
        setMsg(`Envoyé à ${j.pushed} appareil(s).`);
      } else {
        const res = await fetch("/api/campaigns", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience, title, body, mode: moment, runOn: moment === "once" ? runOn : null }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error); }
        setMsg("Campagne enregistrée.");
        router.refresh();
      }
      setTitle(""); setBody(""); setRunOn("");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Échec. Réessayez.");
    } finally { setBusy(false); }
  };

  const toggle = async (c: CampaignListItem) => {
    await fetch(`/api/campaigns/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  };

  const remove = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const input = "w-full bg-surface border border-line-warm rounded-xl px-4 py-3 text-sm text-onyx focus:border-halo outline-none";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-onyx">Campagnes</h1>
        <p className="text-galet-ink">Envoyez maintenant, programmez un jour, ou activez une relance récurrente.</p>
      </div>

      <div className="bg-surface border border-line-warm rounded-3xl p-6 max-w-xl space-y-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-sm text-galet-ink">Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as AudienceKey)} className={input}>
            {AUDIENCE_KEYS.map((a) => {
              const n = sizeOf(a);
              return <option key={a} value={a}>{audienceLabel(a)}{n !== null ? ` (${n})` : ""}</option>;
            })}
          </select>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className={input} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message…" rows={3} className={input} />
        <div className="space-y-1">
          <label className="text-sm text-galet-ink">Quand ?</label>
          <select value={moment} onChange={(e) => setMoment(e.target.value as Moment)} className={input}>
            <option value="now">Maintenant</option>
            <option value="once">Programmée (un jour)</option>
            <option value="recurring">Récurrente (relance auto)</option>
          </select>
        </div>
        {moment === "once" && (
          <input type="date" value={runOn} onChange={(e) => setRunOn(e.target.value)} className={input} />
        )}
        <button onClick={submit}
          disabled={busy || !title.trim() || !body.trim() || (moment === "once" && !runOn)}
          className="bg-halo text-white hover:bg-halo-600 rounded-xl px-5 py-2.5 font-bold disabled:opacity-50">
          {busy ? "…" : moment === "now" ? "Envoyer" : "Enregistrer la campagne"}
        </button>
        {msg && <p className="text-sm text-galet-ink">{msg}</p>}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4 text-onyx">Mes campagnes programmées &amp; récurrentes</h2>
        <div className="space-y-3">
          {initial.length > 0 ? initial.map((c) => (
            <div key={c.id} className="bg-surface border border-line-warm rounded-2xl p-4 flex items-start justify-between gap-4 shadow-sm">
              <div>
                <div className="font-bold text-onyx">{c.title}</div>
                <div className="text-sm text-galet-ink">{c.body}</div>
                <div className="text-xs text-galet mt-1">{audienceLabel(c.audience)} · {statusLabel(c)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.mode === "recurring" && (
                  <button onClick={() => toggle(c)} className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-line-warm hover:bg-calcaire text-galet-ink">
                    {c.active ? "Mettre en pause" : "Activer"}
                  </button>
                )}
                <button onClick={() => remove(c.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10">
                  Supprimer
                </button>
              </div>
            </div>
          )) : <p className="text-galet text-sm">Aucune campagne programmée ou récurrente pour l&apos;instant.</p>}
        </div>
      </div>
    </div>
  );
}
