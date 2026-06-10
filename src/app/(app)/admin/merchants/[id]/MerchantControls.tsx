"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, KeyRound, Copy } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";

// Zone de contrôle du marchand : suspension/réactivation (confirmées, motivées,
// auditées) + déclenchement d'un reset de mot de passe (lien de récupération).

export default function MerchantControls({
  merchantId,
  shopName,
  suspended,
  suspendedReason,
}: {
  merchantId: string;
  shopName: string;
  suspended: boolean;
  suspendedReason: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"suspend" | "reactivate" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setDialog(null);
    setError(null);
  };

  async function suspension(action: "suspend" | "reactivate", reason?: string) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/merchants/${merchantId}/suspension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "suspend" ? { action, reason } : { action }),
    });
    setBusy(false);
    if (r.ok) {
      close();
      router.refresh();
    } else {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Action échouée");
    }
  }

  async function resetPassword() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/merchants/${merchantId}/reset-password`, { method: "POST" });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      close();
      setRecoveryLink(body.recoveryLink ?? null);
      setEmailSent(Boolean(body.emailSent));
    } else {
      setError(body.error ?? "Génération échouée");
    }
  }

  return (
    <div className="space-y-4">
      {suspended && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm">
          <p className="font-bold text-red-700">Marchand suspendu</p>
          {suspendedReason && <p className="mt-1 text-galet-ink">Motif : {suspendedReason}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {suspended ? (
          <button
            onClick={() => setDialog("reactivate")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Réactiver
          </button>
        ) : (
          <button
            onClick={() => setDialog("suspend")}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-500/10"
          >
            <Ban className="h-4 w-4" aria-hidden />
            Suspendre
          </button>
        )}
        <button
          onClick={() => setDialog("reset")}
          className="inline-flex items-center gap-2 rounded-xl border border-line-warm bg-surface px-4 py-2 text-sm font-medium text-onyx transition-colors hover:bg-calcaire"
        >
          <KeyRound className="h-4 w-4" aria-hidden />
          Reset mot de passe
        </button>
      </div>

      {recoveryLink && (
        <div className="rounded-2xl border border-halo/20 bg-halo/5 p-4 text-sm">
          <p className="font-bold text-onyx">
            Lien de récupération généré{" "}
            {emailSent ? "— envoyé par email au marchand." : "— email non configuré : transmettez-le vous-même."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="block max-w-full grow truncate rounded-lg bg-calcaire px-2 py-1.5 text-xs text-galet-ink">
              {recoveryLink}
            </code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-warm px-2 py-1.5 text-xs font-medium text-galet-ink hover:bg-calcaire"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs text-galet">Lien à usage unique, expire rapidement — action tracée dans l&apos;audit.</p>
        </div>
      )}

      <ConfirmDialog
        open={dialog === "suspend"}
        title={`Suspendre ${shopName} ?`}
        description="Le compte est marqué suspendu sur tout le panneau et l'action est auditée. Aucune carte n'est supprimée ; la réactivation est possible à tout moment."
        confirmLabel="Suspendre ce marchand"
        requireReason
        typeToConfirm={shopName}
        busy={busy}
        error={error}
        onConfirm={(reason) => suspension("suspend", reason)}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "reactivate"}
        title={`Réactiver ${shopName} ?`}
        description="Le marchand repasse en statut actif. L'action est auditée."
        confirmLabel="Réactiver"
        tone="primary"
        busy={busy}
        error={error}
        onConfirm={() => suspension("reactivate")}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog === "reset"}
        title="Générer un lien de réinitialisation ?"
        description="Un lien de récupération Supabase est créé pour ce marchand (envoyé par email si Resend est configuré, sinon affiché ici pour transmission manuelle). Action auditée."
        confirmLabel="Générer le lien"
        tone="primary"
        busy={busy}
        error={error}
        onConfirm={resetPassword}
        onCancel={close}
      />
    </div>
  );
}
