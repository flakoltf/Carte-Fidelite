"use client";

import { useState } from "react";
import { Eye, Download, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";

// Clients finaux du marchand — nLPD : par défaut, RIEN n'est affiché (seuls les
// agrégats de la page). L'accès nominatif est un choix explicite, paginé et
// audité ADMIN_CUSTOMER_DATA_ACCESSED ; l'export CSV est confirmé + audité.

interface CustomerRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  stamps: number | null;
  lastScanAt: string | null;
  passType: string | null;
}

export default function CustomersPanel({ merchantId, totalCustomers }: { merchantId: string; totalCustomers: number }) {
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExport, setConfirmExport] = useState(false);

  async function load(p: number) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/merchants/${merchantId}/customers?page=${p}`);
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setRows(body.rows ?? []);
      setPage(body.page ?? p);
      setPageCount(body.pageCount ?? 1);
    } else {
      setError(body.error ?? "Lecture échouée");
    }
  }

  if (rows === null) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line-warm p-6 text-center">
        <ShieldAlert className="mx-auto h-6 w-6 text-galet" aria-hidden />
        <p className="mt-2 font-semibold text-onyx">
          {totalCustomers} client{totalCustomers > 1 ? "s" : ""} — données personnelles masquées
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-galet-ink">
          Conformément à la nLPD, l&apos;accès nominatif est minimisé : il est déclenché
          explicitement et chaque consultation est inscrite au journal d&apos;audit.
        </p>
        <button
          onClick={() => load(1)}
          disabled={busy || totalCustomers === 0}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line-warm bg-surface px-4 py-2 text-sm font-medium text-onyx transition-colors hover:bg-calcaire disabled:opacity-50"
        >
          <Eye className="h-4 w-4" aria-hidden />
          {busy ? "Chargement…" : "Afficher les clients (accès audité)"}
        </button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-galet">
          Accès consigné dans l&apos;audit (ADMIN_CUSTOMER_DATA_ACCESSED) — page {page} / {pageCount}.
        </p>
        <button
          onClick={() => setConfirmExport(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-line-warm bg-surface px-3 py-1.5 text-xs font-medium text-onyx transition-colors hover:bg-calcaire"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exporter en CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line-warm p-5 text-center text-sm text-galet-ink">
          Aucun client enregistré pour ce marchand.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line-warm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Tampons</th>
                <th className="px-4 py-2.5">Wallet</th>
                <th className="px-4 py-2.5">Dernier scan</th>
                <th className="px-4 py-2.5">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line-warm last:border-0">
                  <td className="px-4 py-2.5 font-medium text-onyx">{c.fullName}</td>
                  <td className="px-4 py-2.5 text-galet-ink">{c.email ?? c.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-onyx">{c.stamps ?? "—"}</td>
                  <td className="px-4 py-2.5 text-galet-ink">{c.passType ?? "—"}</td>
                  <td className="px-4 py-2.5 text-galet-ink">
                    {c.lastScanAt ? new Date(c.lastScanAt).toLocaleDateString("fr-CH") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-galet-ink">{new Date(c.createdAt).toLocaleDateString("fr-CH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => load(page - 1)}
            disabled={busy || page <= 1}
            className="rounded-lg border border-line-warm p-1.5 text-galet-ink hover:bg-calcaire disabled:opacity-40"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={() => load(page + 1)}
            disabled={busy || page >= pageCount}
            className="rounded-lg border border-line-warm p-1.5 text-galet-ink hover:bg-calcaire disabled:opacity-40"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmExport}
        title="Exporter les données clients ?"
        description="Le CSV contient des données personnelles (noms, emails, téléphones). L'export est inscrit au journal d'audit (DATA_EXPORTED). Ne le partagez qu'avec le marchand concerné."
        confirmLabel="Exporter le CSV"
        tone="primary"
        onConfirm={() => {
          setConfirmExport(false);
          window.location.href = `/api/admin/merchants/${merchantId}/export`;
        }}
        onCancel={() => setConfirmExport(false)}
      />
    </div>
  );
}
