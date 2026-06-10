"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, CalendarClock, ArrowRight, PhoneCall } from "lucide-react";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  dueFollowups,
  type LeadStatus,
  type PipelineLead,
} from "@/lib/admin/leadsCompute";
import ConfirmDialog from "../components/ConfirmDialog";

// Pipeline commercial : colonnes par étape, actions inline (étape, relance,
// suppression confirmée), saisie manuelle pour la prospection terrain.

const COLUMN_TONES: Record<LeadStatus, string> = {
  nouveau: "border-blue-500/20 bg-blue-500/5",
  contacte: "border-amber-500/20 bg-amber-500/5",
  demo: "border-purple-500/20 bg-purple-500/5",
  gagne: "border-emerald-500/20 bg-emerald-500/5",
  perdu: "border-line-warm bg-calcaire",
};

export default function LeadsBoard({ leads }: { leads: PipelineLead[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PipelineLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ businessName: "", trade: "", contact: "", plan: "" });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const due = useMemo(() => dueFollowups(leads, new Date()), [leads]);

  async function patchLead(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const r = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusyId(null);
    if (r.ok) router.refresh();
    else {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Mise à jour échouée");
    }
  }

  async function deleteLead() {
    if (!deleting) return;
    setBusyId(deleting.id);
    const r = await fetch(`/api/admin/leads/${deleting.id}`, { method: "DELETE" });
    setBusyId(null);
    setDeleting(null);
    if (r.ok) router.refresh();
  }

  async function createLead() {
    setFormBusy(true);
    setFormError(null);
    const r = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: form.businessName,
        trade: form.trade || undefined,
        contact: form.contact,
        plan: form.plan || undefined,
      }),
    });
    setFormBusy(false);
    if (r.ok) {
      setForm({ businessName: "", trade: "", contact: "", plan: "" });
      setShowForm(false);
      router.refresh();
    } else {
      const body = await r.json().catch(() => ({}));
      setFormError(body.error ?? "Création échouée");
    }
  }

  return (
    <div className="space-y-6">
      {/* Relances dues */}
      {due.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-700">
            <PhoneCall className="h-4 w-4" aria-hidden />
            {due.length} relance{due.length > 1 ? "s" : ""} due{due.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-galet-ink">
            {due.slice(0, 5).map((l) => (
              <li key={l.id}>
                <span className="font-semibold text-onyx">{l.businessName}</span> — prévue le{" "}
                {new Date(l.nextFollowupAt!).toLocaleDateString("fr-CH")} · {l.contact}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-2xl bg-halo px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-halo-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouveau lead (terrain)
        </button>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-line-warm bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="Établissement *"
              className="rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            />
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Contact (email / téléphone) *"
              className="rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            />
            <input
              value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
              placeholder="Secteur (café, salon…)"
              className="rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            />
            <input
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              placeholder="Palier pressenti"
              className="rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={createLead}
              disabled={formBusy || form.businessName.trim().length < 2 || form.contact.trim().length < 3}
              className="rounded-xl bg-halo px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-halo-600 disabled:opacity-50"
            >
              {formBusy ? "…" : "Créer le lead"}
            </button>
            {formError && <span className="text-sm text-red-700">{formError}</span>}
          </div>
        </div>
      )}

      {/* Colonnes pipeline */}
      {leads.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-line-warm p-10 text-center text-galet-ink">
          <p className="font-semibold text-onyx">Pas encore de lead.</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            Les formulaires de halocard.ch/demarrer arrivent ici automatiquement — et le bouton
            « Nouveau lead » sert pour la prospection terrain à Genève.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {LEAD_STATUSES.map((status) => {
            const column = leads.filter((l) => l.status === status);
            return (
              <div key={status} className={`rounded-2xl border p-3 ${COLUMN_TONES[status]}`}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-sm font-bold text-onyx">{LEAD_STATUS_LABELS[status]}</span>
                  <span className="text-xs font-semibold text-galet-ink">{column.length}</span>
                </div>
                <div className="space-y-2.5">
                  {column.length === 0 && <p className="px-1 pb-2 text-xs text-galet">—</p>}
                  {column.map((l) => (
                    <div key={l.id} className="rounded-xl border border-line-warm bg-surface p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-onyx" title={l.businessName}>
                            {l.businessName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-galet-ink" title={l.contact}>
                            {[l.trade, l.contact].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleting(l)}
                          title="Supprimer le lead"
                          className="shrink-0 rounded-lg p-1 text-galet transition-colors hover:bg-calcaire hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-galet">
                        <span>{new Date(l.createdAt).toLocaleDateString("fr-CH")}</span>
                        {l.plan && <span className="rounded bg-calcaire px-1.5 py-0.5">palier {l.plan}</span>}
                        {l.noteCount > 0 && <span>{l.noteCount} note{l.noteCount > 1 ? "s" : ""}</span>}
                        {l.sourcePath === "admin:manuel" ? <span>terrain</span> : <span>web</span>}
                      </div>

                      {l.nextFollowupAt && status !== "gagne" && status !== "perdu" && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700">
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          relance {new Date(l.nextFollowupAt).toLocaleDateString("fr-CH")}
                        </p>
                      )}
                      {status === "perdu" && l.lostReason && (
                        <p className="mt-1.5 text-[11px] italic text-galet-ink">{l.lostReason}</p>
                      )}
                      {status === "gagne" && l.convertedMerchantId && (
                        <Link
                          href={`/admin/merchants/${l.convertedMerchantId}`}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-halo hover:underline"
                        >
                          Voir le marchand <ArrowRight className="h-3 w-3" aria-hidden />
                        </Link>
                      )}

                      <div className="mt-2.5 flex items-center gap-1.5">
                        <select
                          value={l.status}
                          disabled={busyId === l.id}
                          onChange={(e) => {
                            const next = e.target.value as LeadStatus;
                            if (next === "perdu") {
                              const reason = window.prompt("Motif de perte (optionnel) :") ?? "";
                              patchLead(l.id, { status: next, lostReason: reason || null });
                            } else {
                              patchLead(l.id, { status: next });
                            }
                          }}
                          className="grow rounded-lg border border-line-warm bg-calcaire px-2 py-1 text-xs text-onyx outline-none focus:border-halo"
                          aria-label={`Étape de ${l.businessName}`}
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {LEAD_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={l.nextFollowupAt?.slice(0, 10) ?? ""}
                          disabled={busyId === l.id}
                          onChange={(e) =>
                            patchLead(l.id, { nextFollowupAt: e.target.value ? e.target.value : null })
                          }
                          title="Date de relance"
                          className="w-[7.5rem] rounded-lg border border-line-warm bg-calcaire px-2 py-1 text-xs text-onyx outline-none focus:border-halo"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Supprimer le lead « ${deleting?.businessName ?? ""} » ?`}
        description="Suppression définitive (notes incluses), tracée dans l'audit."
        confirmLabel="Supprimer"
        busy={busyId === deleting?.id}
        onConfirm={deleteLead}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
