"use client";
import { useState } from "react";

export function SendForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
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
