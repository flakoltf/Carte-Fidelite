"use client";
import { useEffect, useState } from "react";
import { AUDIENCE_KEYS, audienceLabel, type AudienceKey } from "@/lib/segments/audience";
import type { SegmentSummary } from "@/lib/segments/summary";

export function SendForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [summary, setSummary] = useState<SegmentSummary | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSummary(j?.data ?? null))
      .catch(() => {});
  }, []);

  const sizeOf = (a: AudienceKey): number | null => {
    if (!summary) return null;
    if (a === "all") return summary.total;
    if (a === "recompense_prete") return summary.flags.recompense_prete;
    return summary.stages[a]?.count ?? 0;
  };

  const send = async () => {
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      setResult(`Envoyé à ${json.pushed} appareil(s) (${json.reachable} client(s) joignable(s)).`);
      setTitle(""); setBody("");
    } catch {
      setResult("Échec de l'envoi. Réessayez.");
    } finally { setSending(false); }
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 max-w-xl space-y-4">
      <div className="space-y-1">
        <label className="text-sm text-zinc-400">Audience</label>
        <select value={audience} onChange={(e) => setAudience(e.target.value as AudienceKey)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm">
          {AUDIENCE_KEYS.map((a) => {
            const n = sizeOf(a);
            return <option key={a} value={a}>{audienceLabel(a)}{n !== null ? ` (${n})` : ""}</option>;
          })}
        </select>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex. Offre du week-end)"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message…" rows={3}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
      <button onClick={send} disabled={sending || !title.trim() || !body.trim()}
        className="bg-emerald-500 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50">
        {sending ? "Envoi…" : "Envoyer à mes clients"}
      </button>
      {result && <p className="text-sm text-zinc-300">{result}</p>}
    </div>
  );
}
