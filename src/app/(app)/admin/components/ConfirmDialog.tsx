"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

// Confirmation explicite des actions à impact (colonne vertébrale du panneau :
// jamais d'action irréversible en un clic silencieux). Optionnel : champ motif
// obligatoire, ou re-saisie du nom exact pour les actions les plus graves.

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  requireReason = false,
  reasonLabel,
  typeToConfirm,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** Si vrai, un motif (≥ 5 caractères) est exigé et transmis à onConfirm. */
  requireReason?: boolean;
  reasonLabel?: string;
  /** Si fourni, l'utilisateur doit re-saisir ce texte exact pour confirmer. */
  typeToConfirm?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  const reasonOk = !requireReason || reason.trim().length >= 5;
  const typedOk = !typeToConfirm || typed === typeToConfirm;
  const canConfirm = reasonOk && typedOk && !busy;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-onyx/40 p-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="w-full max-w-md rounded-3xl border border-line-warm bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2 ${
                  tone === "danger" ? "bg-red-500/10 text-red-600" : "bg-halo/10 text-halo"
                }`}
              >
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-onyx">{title}</h3>
                <div className="mt-1 text-sm leading-relaxed text-galet-ink">{description}</div>
              </div>
            </div>

            {requireReason && (
              <label className="mt-4 block">
                <span className="text-xs font-semibold text-galet-ink">
                  {reasonLabel ?? "Motif (obligatoire, tracé dans l'audit)"}
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
                  placeholder="Ex. : impayé depuis 60 jours, demande du marchand…"
                />
              </label>
            )}

            {typeToConfirm && (
              <label className="mt-4 block">
                <span className="text-xs font-semibold text-galet-ink">
                  Tapez « {typeToConfirm} » pour confirmer
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line-warm bg-calcaire px-3 py-2 text-sm text-onyx outline-none focus:border-halo"
                  autoComplete="off"
                />
              </label>
            )}

            {error && (
              <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={busy}
                className="rounded-xl border border-line-warm px-4 py-2 text-sm font-medium text-galet-ink transition-colors hover:bg-calcaire disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
                disabled={!canConfirm}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                  tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-halo hover:bg-halo-600"
                }`}
              >
                {busy ? "…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
