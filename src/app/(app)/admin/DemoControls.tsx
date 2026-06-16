"use client";

import { useRef, useState } from "react";
import { Sparkles, RotateCcw, ExternalLink, Copy, Check, Loader2, KeyRound, Mail } from "lucide-react";
import ConfirmDialog from "./components/ConfirmDialog";

// Encart de prospection : préparer un compte démo « Boulangerie Démo » nickel,
// puis le réinitialiser en un clic devant le prochain commerçant. Les deux
// actions sont auditées et réservées au compte démo (jamais un vrai marchand).

interface SeedResponse {
  mode: "created" | "reset";
  slug: string;
  enrollPath: string;
  email?: string;
  tempPassword?: string;
}

export default function DemoControls() {
  const [seedBusy, setSeedBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<SeedResponse | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sécurité & diagnostic : rotation mdp démo (A2) + smoke email Resend (A7).
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [rotatedPass, setRotatedPass] = useState<string | null>(null);
  const [rotateCopied, setRotateCopied] = useState(false);
  const rotateClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [smokeBusy, setSmokeBusy] = useState(false);
  const [smokeMsg, setSmokeMsg] = useState<string | null>(null);

  const enrollUrl = seeded ? `${typeof window !== "undefined" ? window.location.origin : ""}${seeded.enrollPath}` : "";

  async function rotate() {
    setRotateBusy(true);
    setError(null);
    setSmokeMsg(null);
    try {
      const r = await fetch("/api/admin/demo/rotate-password", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? "Rotation échouée.");
        return;
      }
      setRotateOpen(false);
      setRotatedPass(body.tempPassword as string);
      // Ne pas laisser le mot de passe à l'écran : auto-effacement après 30 s.
      if (rotateClearTimer.current) clearTimeout(rotateClearTimer.current);
      rotateClearTimer.current = setTimeout(() => setRotatedPass(null), 30000);
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setRotateBusy(false);
    }
  }

  async function sendSmoke() {
    setSmokeBusy(true);
    setError(null);
    setSmokeMsg(null);
    try {
      const r = await fetch("/api/admin/email-smoke", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? "Envoi échoué.");
        return;
      }
      setSmokeMsg("Email test envoyé à votre adresse — vérifiez votre boîte de réception.");
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setSmokeBusy(false);
    }
  }

  async function seed() {
    setSeedBusy(true);
    setError(null);
    setResetMsg(null);
    try {
      const r = await fetch("/api/admin/demo/seed", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? "Préparation échouée.");
        return;
      }
      setSeeded(body as SeedResponse);
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setSeedBusy(false);
    }
  }

  async function reset() {
    setResetBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/demo/reset", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? "Réinitialisation échouée.");
        return;
      }
      setResetOpen(false);
      setResetMsg(
        body.cardsPurged > 0
          ? `Démo remise à zéro — ${body.cardsPurged} carte${body.cardsPurged > 1 ? "s" : ""} effacée${body.cardsPurged > 1 ? "s" : ""}.`
          : "Démo déjà vide — prête pour une nouvelle démonstration."
      );
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-halo/30 bg-halo/[0.04] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-onyx">
            <Sparkles className="h-4 w-4 text-halo" aria-hidden /> Démo de prospection
          </h2>
          <p className="mt-1 max-w-xl text-sm text-galet-ink">
            Préparez un compte « Boulangerie Démo » pleinement configuré, puis remettez-le à zéro
            devant chaque commerçant pour repartir d&apos;une démonstration propre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={seed}
            disabled={seedBusy}
            className="inline-flex items-center gap-2 rounded-2xl bg-halo px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-halo-600 disabled:opacity-50"
          >
            {seedBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            Préparer une démo
          </button>
          <button
            onClick={() => { setError(null); setResetOpen(true); }}
            className="inline-flex items-center gap-2 rounded-2xl border border-line-warm bg-surface px-4 py-2.5 text-sm font-medium text-onyx transition-colors hover:bg-calcaire"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Réinitialiser la démo
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {resetMsg && (
        <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
          {resetMsg}
        </p>
      )}

      {seeded && (
        <div className="mt-4 rounded-2xl border border-line-warm bg-surface p-4">
          <p className="text-sm font-bold text-onyx">
            {seeded.mode === "created" ? "Compte démo créé ✓" : "Compte démo réinitialisé et reconfiguré ✓"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={enrollUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-halo px-3 py-2 text-xs font-semibold text-white hover:bg-halo-600"
            >
              Ouvrir la carte démo <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <code className="max-w-full grow truncate rounded-lg bg-calcaire px-2 py-1.5 text-xs text-galet-ink">{enrollUrl}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(enrollUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-warm px-2 py-1.5 text-xs font-medium text-galet-ink hover:bg-calcaire"
            >
              {copied ? <Check className="h-3 w-3 text-halo" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          {seeded.tempPassword && (
            <p className="mt-2 text-xs text-galet">
              Connexion marchand démo : <strong>{seeded.email}</strong> · mot de passe{" "}
              <code className="rounded bg-calcaire px-1">{seeded.tempPassword}</code> (affiché une seule fois).
            </p>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-line-warm/60 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-onyx">
          <KeyRound className="h-4 w-4 text-halo" aria-hidden /> Sécurité &amp; diagnostic
        </h3>
        <p className="mt-1 max-w-xl text-sm text-galet-ink">
          Roter le mot de passe du compte démo avant la prospection, et vérifier que l&apos;envoi
          d&apos;emails fonctionne en production.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setError(null); setRotateOpen(true); }}
            className="inline-flex items-center gap-2 rounded-2xl border border-line-warm bg-surface px-4 py-2.5 text-sm font-medium text-onyx transition-colors hover:bg-calcaire"
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            Roter le mot de passe
          </button>
          <button
            onClick={sendSmoke}
            disabled={smokeBusy}
            className="inline-flex items-center gap-2 rounded-2xl border border-line-warm bg-surface px-4 py-2.5 text-sm font-medium text-onyx transition-colors hover:bg-calcaire disabled:opacity-50"
          >
            {smokeBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
            Envoyer un email test
          </button>
        </div>

        {smokeMsg && (
          <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
            {smokeMsg}
          </p>
        )}

        {rotatedPass && (
          <div className="mt-3 rounded-2xl border border-line-warm bg-surface p-4">
            <p className="text-sm font-bold text-onyx">Nouveau mot de passe du compte démo ✓</p>
            <p className="mt-1 text-xs text-galet">
              Affiché une seule fois, effacé automatiquement de l&apos;écran dans 30&nbsp;secondes. Copiez-le maintenant.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full grow truncate rounded-lg bg-calcaire px-2 py-1.5 text-xs text-galet-ink">{rotatedPass}</code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(rotatedPass);
                  setRotateCopied(true);
                  setTimeout(() => setRotateCopied(false), 1500);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-warm px-2 py-1.5 text-xs font-medium text-galet-ink hover:bg-calcaire"
              >
                {rotateCopied ? <Check className="h-3 w-3 text-halo" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                {rotateCopied ? "Copié" : "Copier"}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={rotateOpen}
        title="Roter le mot de passe démo ?"
        description="Un nouveau mot de passe sera généré pour le SEUL compte démo réservé (Boulangerie Démo) et affiché une seule fois. L'ancien mot de passe cessera immédiatement de fonctionner."
        confirmLabel="Roter le mot de passe"
        tone="primary"
        busy={rotateBusy}
        error={error}
        onConfirm={rotate}
        onCancel={() => setRotateOpen(false)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Réinitialiser le compte démo ?"
        description="Tous les clients, cartes et scans du SEUL compte démo seront effacés (le marchand et sa configuration restent intacts). Idéal juste avant une démonstration."
        confirmLabel="Réinitialiser la démo"
        tone="primary"
        busy={resetBusy}
        error={error}
        onConfirm={reset}
        onCancel={() => setResetOpen(false)}
      />
    </section>
  );
}
