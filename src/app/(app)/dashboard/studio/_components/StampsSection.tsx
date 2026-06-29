'use client';

// Section Tampons : objectif, icône (bibliothèque par univers ou emoji libre),
// forme des alvéoles, et visuels personnalisés tamponné / non-tamponné.

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { STAMP_ICON_GROUPS, isValidStampIcon } from '@/lib/cardDesign/stampLibrary';
import { STAMP_GOAL_MIN, STAMP_GOAL_MAX } from '@/lib/cardDesign/studioValidation';
import type { StampsConfig, StampShape } from '@/lib/cardDesign/types';
import ImageUploadField from './ImageUploadField';
import StampGrid from './StampGrid';

const SHAPE_LABELS: Record<StampShape, string> = {
  circle: 'Rond',
  rounded: 'Arrondi',
  square: 'Carré',
};

export default function StampsSection({
  stamps,
  onChange,
  background,
  filledUrl,
  emptyUrl,
  onFilledUploaded,
  onEmptyUploaded,
}: {
  stamps: StampsConfig;
  onChange: (stamps: StampsConfig) => void;
  background: string;
  filledUrl?: string;
  emptyUrl?: string;
  onFilledUploaded: (path: string, previewUrl: string) => void;
  onEmptyUploaded: (path: string, previewUrl: string) => void;
}) {
  const [freeIcon, setFreeIcon] = useState('');

  const setGoal = (goal: number) =>
    onChange({ ...stamps, goal: Math.max(STAMP_GOAL_MIN, Math.min(STAMP_GOAL_MAX, goal)) });

  return (
    <div className="space-y-6">
      {/* Objectif */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-1.5">Tampons requis pour la récompense</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGoal(stamps.goal - 1)}
            disabled={stamps.goal <= STAMP_GOAL_MIN}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-warm text-galet-ink hover:border-halo hover:text-halo disabled:opacity-40 transition-colors"
            aria-label="Réduire l’objectif"
          >
            <Minus className="w-4 h-4" aria-hidden />
          </button>
          <span className="w-12 text-center font-display text-2xl text-onyx tabular-nums">{stamps.goal}</span>
          <button
            type="button"
            onClick={() => setGoal(stamps.goal + 1)}
            disabled={stamps.goal >= STAMP_GOAL_MAX}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-warm text-galet-ink hover:border-halo hover:text-halo disabled:opacity-40 transition-colors"
            aria-label="Augmenter l’objectif"
          >
            <Plus className="w-4 h-4" aria-hidden />
          </button>
          <span className="text-xs text-galet-ink">
            La publication aligne automatiquement votre objectif de fidélité ({STAMP_GOAL_MIN}–{STAMP_GOAL_MAX}).
          </span>
        </div>
      </div>

      {/* Icône */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-2">Icône du tampon</p>
        <div className="space-y-2.5">
          {STAMP_ICON_GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[11px] text-galet-ink">{group.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {group.icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => onChange({ ...stamps, icon })}
                    aria-label={`Icône ${icon}`}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-all ${
                      stamps.icon === icon && !stamps.filledAssetPath
                        ? 'border-halo bg-halo/10 ring-1 ring-halo/40'
                        : 'border-line-warm hover:border-halo/60'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[11px] text-galet-ink">Emoji libre</span>
            <input
              value={freeIcon}
              onChange={(e) => {
                setFreeIcon(e.target.value);
                if (isValidStampIcon(e.target.value)) onChange({ ...stamps, icon: e.target.value.trim() });
              }}
              placeholder="🎯"
              maxLength={16}
              className="w-20 bg-calcaire border border-line-warm rounded-xl px-3 py-2 text-center text-lg focus:border-halo outline-none"
              aria-label="Emoji libre"
            />
            <span className="text-[11px] text-galet-ink">Collez n’importe quel emoji.</span>
          </div>
        </div>
      </div>

      {/* Forme */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-2">Forme des alvéoles</p>
        <div className="flex gap-2">
          {(Object.keys(SHAPE_LABELS) as StampShape[]).map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => onChange({ ...stamps, shape })}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                stamps.shape === shape ? 'border-halo bg-halo/5 text-onyx' : 'border-line-warm text-galet-ink hover:border-halo/60'
              }`}
            >
              <span
                className="inline-block h-4 w-4 border-2 border-current"
                style={{ borderRadius: shape === 'circle' ? 999 : shape === 'rounded' ? 4 : 1 }}
                aria-hidden
              />
              {SHAPE_LABELS[shape]}
            </button>
          ))}
        </div>
      </div>

      {/* Aperçu grille */}
      <div className="rounded-2xl p-4" style={{ background }}>
        <StampGrid
          stamps={stamps}
          count={Math.min(4, stamps.goal)}
          onBackground="#ffffff"
          filledUrl={filledUrl}
          emptyUrl={emptyUrl}
        />
      </div>

      {/* Visuels personnalisés */}
      <details className="group rounded-2xl border border-line-warm bg-calcaire/60 p-4">
        <summary className="cursor-pointer text-sm font-medium text-galet-ink group-open:text-onyx">
          Visuels personnalisés (optionnel) — remplacez l’emoji par vos propres images
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-galet-ink">État « tamponné »</p>
            <ImageUploadField
              kind="stamp_filled"
              currentUrl={filledUrl}
              onUploaded={(result, previewUrl) => result.path && onFilledUploaded(result.path, previewUrl)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-galet-ink">État « non tamponné »</p>
            <ImageUploadField
              kind="stamp_empty"
              currentUrl={emptyUrl}
              onUploaded={(result, previewUrl) => result.path && onEmptyUploaded(result.path, previewUrl)}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
