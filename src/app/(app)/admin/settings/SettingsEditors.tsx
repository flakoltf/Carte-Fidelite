"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, DatabaseBackup } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";

// Éditeurs des réglages plateforme (liste fermée côté API, tout est audité
// PLATFORM_SETTING_UPDATED) : échéance certificats Apple, statut publishing
// Google, attestation de backup vérifié.

async function putSetting(key: string, value: Record<string, unknown>): Promise<string | null> {
  const r = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (r.ok) return null;
  const body = await r.json().catch(() => ({}));
  return body.error ?? "Enregistrement échoué";
}

export function CertExpiryEditor({ current }: { current: string | null }) {
  const router = useRouter();
  const [date, setDate] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-xs font-semibold text-galet-ink">Expiration des certificats Apple</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
        />
      </label>
      <button
        onClick={async () => {
          setBusy(true);
          setError(await putSetting("apple_cert_expires_at", { date }));
          setBusy(false);
          router.refresh();
        }}
        disabled={busy || !date}
        className="inline-flex items-center gap-2 rounded-xl bg-halo px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-halo-600 disabled:opacity-50"
      >
        <Save className="h-4 w-4" aria-hidden />
        Enregistrer
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

export function GooglePublishingEditor({ current, note }: { current: string; note: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [draft, setDraft] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-galet-ink">Publishing access Google Wallet</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
          >
            <option value="en_attente">En attente</option>
            <option value="approuve">Approuvé</option>
            <option value="refuse">Refusé</option>
          </select>
        </label>
        <label className="block grow basis-64">
          <span className="text-xs font-semibold text-galet-ink">Note (dernier échange, ticket…)</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
          />
        </label>
        <button
          onClick={async () => {
            setBusy(true);
            setError(await putSetting("google_publishing_status", { status, note: draft }));
            setBusy(false);
            router.refresh();
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-halo px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-halo-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden />
          Enregistrer
        </button>
      </div>
      {error && <span className="text-sm text-red-700">{error}</span>}
      <p className="text-xs text-galet">
        Quand Google accorde le publishing : statut « Approuvé » ici, puis poser
        NEXT_PUBLIC_GOOGLE_WALLET_READY=true et GOOGLE_PUSH_ENABLED=true sur Vercel (variables d&apos;env,
        hors de cette console).
      </p>
    </div>
  );
}

export function BackupAttestation({ lastVerifiedAt }: { lastVerifiedAt: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-sm text-galet-ink">
        Dernier dump vérifié :{" "}
        <span className="font-semibold text-onyx">
          {lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleString("fr-CH") : "jamais"}
        </span>
      </p>
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-line-warm bg-surface px-4 py-2 text-sm font-medium text-onyx transition-colors hover:bg-calcaire"
      >
        <DatabaseBackup className="h-4 w-4" aria-hidden />
        Attester un backup vérifié maintenant
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}

      <ConfirmDialog
        open={confirming}
        title="Attester un backup vérifié ?"
        description="N'attestez qu'après un dump réel ET un test de restauration réussi. La date est affichée en Santé technique et l'action est auditée."
        confirmLabel="J'ai vérifié, attester"
        tone="primary"
        busy={busy}
        error={error}
        onConfirm={async () => {
          setBusy(true);
          const err = await putSetting("db_backup", {
            last_verified_at: new Date().toISOString(),
            note: "Attesté depuis /admin/settings",
          });
          setBusy(false);
          setError(err);
          if (!err) {
            setConfirming(false);
            router.refresh();
          }
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
