'use client';

import type { CardBarcode } from '@/lib/cardDesign/types';

interface BarcodeFieldProps {
  value: CardBarcode;
  onChange: (value: CardBarcode) => void;
}

const SOURCE_LABELS: Record<CardBarcode['source'], string> = {
  card_token: 'Jeton de la carte (recommandé)',
  custom: 'Valeur personnalisée',
};

export default function BarcodeField({ value, onChange }: BarcodeFieldProps) {
  const inputCls =
    'w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-all';

  return (
    <div className="space-y-3">
      {/* Type — fixed to QR, shown read-only for clarity */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-galet-ink w-16 shrink-0">Type</span>
        <div className="flex items-center gap-2 bg-calcaire border border-line-warm rounded-xl px-3 py-1.5">
          {/* QR placeholder icon */}
          <span
            aria-hidden
            className="w-5 h-5 rounded-sm"
            style={{
              background:
                'repeating-conic-gradient(#0E0F11 0 25%, transparent 0 50%) center / 5px 5px',
            }}
          />
          <span className="text-sm font-mono text-onyx">QR</span>
        </div>
      </div>

      {/* Source selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-galet-ink ml-1">Contenu</label>
        <select
          value={value.source}
          onChange={(e) =>
            onChange({ ...value, source: e.target.value as CardBarcode['source'], value: '' })
          }
          className={inputCls}
        >
          {(Object.entries(SOURCE_LABELS) as [CardBarcode['source'], string][]).map(
            ([source, lbl]) => (
              <option key={source} value={source}>
                {lbl}
              </option>
            ),
          )}
        </select>

        {value.source === 'card_token' && (
          <p className="text-xs text-galet ml-1">
            Le QR encode le jeton unique de la carte — recommandé pour le scan en caisse.
          </p>
        )}
      </div>

      {/* Custom value input */}
      {value.source === 'custom' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-galet-ink ml-1">Valeur du QR</label>
          <input
            value={value.value ?? ''}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            placeholder="Texte ou URL encodée dans le QR"
            maxLength={512}
            className={inputCls + ' placeholder:text-galet'}
          />
        </div>
      )}
    </div>
  );
}
