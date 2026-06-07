'use client';

import type { CardBarcode } from '@/lib/cardDesign/types';
import { BARCODE_FORMATS, BARCODE_FORMAT_LABELS } from '@/lib/cardDesign/types';

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
      {/* Format selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-galet-ink ml-1">Format</label>
        <select
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as CardBarcode['type'] })}
          className={inputCls}
        >
          {BARCODE_FORMATS.map((fmt) => (
            <option key={fmt} value={fmt}>
              {BARCODE_FORMAT_LABELS[fmt]}
            </option>
          ))}
        </select>
        <p className="text-xs text-galet ml-1">
          QR &amp; Aztec : carrés, denses. PDF417 : rectangle (style carte d&apos;embarquement). Code 128 : barres 1D.
        </p>
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
          <label className="text-xs font-medium text-galet-ink ml-1">Valeur encodée</label>
          <input
            value={value.value ?? ''}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            placeholder="Texte ou URL encodée dans le code-barres"
            maxLength={512}
            className={inputCls + ' placeholder:text-galet'}
          />
        </div>
      )}

      {/* Alternative text */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-galet-ink ml-1">Texte alternatif (optionnel)</label>
        <input
          value={value.altText ?? ''}
          onChange={(e) => onChange({ ...value, altText: e.target.value })}
          placeholder="Affiché sous le code si le scan échoue"
          maxLength={100}
          className={inputCls + ' placeholder:text-galet'}
        />
      </div>
    </div>
  );
}
