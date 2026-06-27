"use client";

import { useState } from "react";
import { Delete } from "lucide-react";
import {
  applyKey,
  displayChf,
  entryToChf,
  KEYPAD_ROWS,
  type AmountKey,
} from "@/lib/comptoir/amountPad";

export interface AmountPadProps {
  /** Crédité après « VALIDER ». Reçoit le montant en CHF (ex. 12.5). */
  onConfirm: (amountChf: number) => Promise<void>;
  /** Retour en arrière (annuler la saisie). */
  onCancel?: () => void;
}

const KEY_LABEL: Partial<Record<AmountKey, string>> = {
  ",": "virgule",
  back: "effacer",
};

// Pavé numérique CHF plein écran. Affiché entre le scan-succès et le crédit pour
// les programmes « points au montant » (program.type === "amount_points").
// Grand montant en haut, grille 3×4, bouton VALIDER en bas. Une main, gros tap.
export default function AmountPad({ onConfirm, onCancel }: AmountPadProps) {
  const [entry, setEntry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amount = entryToChf(entry);
  const display = displayChf(amount);

  const press = (key: AmountKey) => {
    if (submitting) return;
    setEntry((e) => applyKey(e, key));
  };

  const confirm = async () => {
    if (submitting || amount <= 0) return;
    setSubmitting(true);
    try {
      await onConfirm(amount);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-calcaire px-5 pb-[env(safe-area-inset-bottom)] text-onyx">
      {/* Montant en grand. */}
      <div className="flex h-1/4 flex-col items-center justify-center">
        <span className="text-xs font-medium uppercase tracking-wide text-galet">
          Montant de l’achat
        </span>
        <output
          aria-live="polite"
          aria-label={`Montant : ${display}`}
          className="font-display text-6xl font-extrabold tracking-tight tabular-nums"
        >
          {display}
        </output>
      </div>

      {/* Grille numérique 3×4. */}
      <div className="grid flex-1 grid-cols-3 gap-3 py-3">
        {KEYPAD_ROWS.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={KEY_LABEL[key]}
            className="flex items-center justify-center rounded-2xl bg-surface text-3xl font-bold shadow-sm ring-1 ring-line-warm transition-transform duration-100 ease-[var(--ease-out)] active:scale-95 active:bg-line-warm/40"
          >
            {key === "back" ? <Delete className="h-7 w-7" aria-hidden="true" /> : key}
          </button>
        ))}
      </div>

      {/* Valider + annuler. */}
      <div className="flex flex-col gap-3 pt-2 pb-4">
        <button
          type="button"
          onClick={confirm}
          disabled={submitting || amount <= 0}
          className="flex h-20 w-full items-center justify-center rounded-3xl bg-halo text-xl font-extrabold tracking-tight text-white shadow-lg shadow-halo/25 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? "Validation…" : `VALIDER ${display}`}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-11 text-sm font-medium text-galet underline-offset-4 hover:underline disabled:opacity-50"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
