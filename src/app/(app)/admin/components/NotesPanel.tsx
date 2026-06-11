"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Trash2, Plus } from "lucide-react";
import type { AdminNote } from "@/lib/admin/leads";
import ConfirmDialog from "./ConfirmDialog";

// Notes CRM internes (marchand ou lead). Épingler = « à relancer » : la fiche
// remonte dans les vues de pilotage. Suppression confirmée, tout est audité.

export default function NotesPanel({
  notes,
  merchantId,
  leadId,
}: {
  notes: AdminNote[];
  merchantId?: string;
  leadId?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminNote | null>(null);

  async function addNote() {
    if (draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId, leadId, body: draft.trim(), pinned }),
    });
    setBusy(false);
    if (r.ok) {
      setDraft("");
      setPinned(false);
      router.refresh();
    } else {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Création échouée");
    }
  }

  async function togglePin(note: AdminNote) {
    const r = await fetch(`/api/admin/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    if (r.ok) router.refresh();
  }

  async function deleteNote() {
    if (!deleting) return;
    setBusy(true);
    const r = await fetch(`/api/admin/notes/${deleting.id}`, { method: "DELETE" });
    setBusy(false);
    setDeleting(null);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Note interne (appel, contexte, prochaine étape)…"
          className="w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={addNote}
            disabled={busy || draft.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-halo px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-halo-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter la note
          </button>
          <label className="flex items-center gap-2 text-sm text-galet-ink">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 accent-[#0D6B5E]"
            />
            Épingler (à relancer)
          </label>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line-warm p-5 text-center text-sm text-galet-ink">
          Aucune note pour l&apos;instant — gardez ici la mémoire de vos appels et décisions.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border p-4 ${
                n.pinned ? "border-amber-500/30 bg-amber-500/5" : "border-line-warm bg-calcaire"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-onyx">{n.body}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => togglePin(n)}
                    title={n.pinned ? "Dépingler" : "Épingler (à relancer)"}
                    className="rounded-lg p-1.5 text-galet-ink transition-colors hover:bg-surface hover:text-amber-600"
                  >
                    {n.pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
                  </button>
                  <button
                    onClick={() => setDeleting(n)}
                    title="Supprimer la note"
                    className="rounded-lg p-1.5 text-galet-ink transition-colors hover:bg-surface hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-galet">
                {new Date(n.createdAt).toLocaleString("fr-CH")}
                {n.pinned && <span className="ml-2 font-semibold text-amber-600">📌 à relancer</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer cette note ?"
        description="La suppression est définitive et tracée dans l'audit."
        confirmLabel="Supprimer"
        busy={busy}
        onConfirm={deleteNote}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
