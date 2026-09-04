'use client';

// Section Programme à points : points gagnés par passage, paliers de
// récompense cumulatifs, expiration optionnelle. Composant contrôlé (l'état
// vit dans StudioClient) — la validation de fond reste serveur
// (buildLoyaltyUpdate / validateLoyaltyProgram), ici seulement des gardes de
// saisie miroir des bornes serveur.

import { Plus, Trash2 } from 'lucide-react';

// Types et défauts : module pur partagé (lib/loyalty/studioProgramState) —
// ré-exportés ici pour les imports historiques.
import {
  DEFAULT_POINTS_RULES,
  type PointsExpirationState,
  type PointsRulesState,
  type PointsTierState,
  type StatusTierState,
} from '@/lib/loyalty/studioProgramState';

export { DEFAULT_POINTS_RULES };
export type { PointsExpirationState, PointsRulesState, PointsTierState, StatusTierState };

const POINTS_PER_SCAN_MIN = 1;
const POINTS_PER_SCAN_MAX = 1000;
const TIERS_MAX = 6;
const STATUS_MAX = 5;
const STATUS_LABEL_MAX = 40;
const STATUS_BENEFIT_MAX = 120;
const ROLLING_MONTHS_MIN = 1;
const ROLLING_MONTHS_MAX = 60;

export default function PointsSection({
  value,
  onChange,
}: {
  value: PointsRulesState;
  onChange: (value: PointsRulesState) => void;
}) {
  const inputCls =
    'bg-calcaire border border-line-warm rounded-xl px-3 py-2 text-sm text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet-ink';

  const setTier = (i: number, patch: Partial<PointsTierState>) =>
    onChange({ ...value, tiers: value.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const removeTier = (i: number) => onChange({ ...value, tiers: value.tiers.filter((_, j) => j !== i) });

  const addTier = () => {
    const last = value.tiers[value.tiers.length - 1];
    onChange({ ...value, tiers: [...value.tiers, { threshold: (last?.threshold ?? 0) + 50, reward: '' }] });
  };

  const statusTiers = value.statusTiers ?? [];
  const setStatus = (i: number, patch: Partial<StatusTierState>) =>
    onChange({ ...value, statusTiers: statusTiers.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeStatus = (i: number) => onChange({ ...value, statusTiers: statusTiers.filter((_, j) => j !== i) });
  const addStatus = () => {
    const last = statusTiers[statusTiers.length - 1];
    onChange({
      ...value,
      statusTiers: [...statusTiers, { threshold: last ? last.threshold + 100 : 0, label: '', benefit: '' }],
    });
  };

  return (
    <div className="space-y-6">
      {/* Points par passage */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-1.5">Points gagnés par passage</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={POINTS_PER_SCAN_MIN}
            max={POINTS_PER_SCAN_MAX}
            value={value.pointsPerScan}
            aria-label="Points gagnés par passage"
            onChange={(e) =>
              onChange({
                ...value,
                pointsPerScan: Math.max(
                  POINTS_PER_SCAN_MIN,
                  Math.min(POINTS_PER_SCAN_MAX, Number(e.target.value) || POINTS_PER_SCAN_MIN)
                ),
              })
            }
            className={`${inputCls} w-24`}
          />
          <span className="text-xs text-galet-ink">
            Crédités à chaque scan de la carte du client (1 à {POINTS_PER_SCAN_MAX}).
          </span>
        </div>
      </div>

      {/* Paliers */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-1.5">Paliers de récompense</p>
        <p className="text-[11px] text-galet-ink mb-2">
          Le dernier palier atteint remet le compteur à zéro — classez-les du plus accessible au plus généreux.
        </p>
        <div className="space-y-2">
          {value.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 bg-surface border border-line-warm rounded-xl px-2 py-2">
              <input
                type="number"
                min={1}
                value={t.threshold}
                aria-label={`Seuil du palier ${i + 1}`}
                onChange={(e) => setTier(i, { threshold: Math.max(1, Number(e.target.value) || 1) })}
                className={`${inputCls} w-20 shrink-0`}
              />
              <input
                type="text"
                maxLength={80}
                value={t.reward}
                placeholder="Ex. 10% de réduction"
                aria-label={`Offre du palier ${i + 1}`}
                onChange={(e) => setTier(i, { reward: e.target.value })}
                className={`${inputCls} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={() => removeTier(i)}
                disabled={value.tiers.length <= 1}
                aria-label={`Supprimer le palier ${i + 1}`}
                className="shrink-0 p-1.5 text-galet-ink hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {value.tiers.length < TIERS_MAX && (
          <button
            type="button"
            onClick={addTier}
            className="mt-2 flex items-center gap-2 w-full border border-dashed border-halo/40 rounded-xl px-3 py-2.5 text-sm text-galet-ink hover:text-halo hover:border-halo hover:bg-halo/5 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Ajouter un palier
          </button>
        )}
      </div>

      {/* Expiration */}
      <div>
        <label className="text-xs font-medium text-galet-ink mb-1.5 block">Expiration des points</label>
        <p className="text-[11px] text-galet-ink mb-2">
          À l&apos;échéance, le solde du cycle repart à zéro. Les statuts clients, eux, ne se perdent jamais.
        </p>
        <select
          value={value.expiration.type}
          onChange={(e) => {
            const t = e.target.value;
            onChange({
              ...value,
              expiration:
                t === 'rolling'
                  ? { type: 'rolling', months: 12 }
                  : t === 'fixed_date'
                    ? { type: 'fixed_date', month: 12, day: 31 }
                    : { type: 'none' },
            });
          }}
          className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-all"
        >
          <option value="none">Aucune expiration</option>
          <option value="fixed_date">Remise à zéro chaque année à date fixe</option>
          <option value="rolling">Glissante : N mois après le premier passage</option>
        </select>

        {value.expiration.type === 'rolling' && (
          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              min={ROLLING_MONTHS_MIN}
              max={ROLLING_MONTHS_MAX}
              value={value.expiration.months}
              aria-label="Durée avant expiration en mois"
              onChange={(e) =>
                onChange({
                  ...value,
                  expiration: {
                    type: 'rolling',
                    months: Math.max(
                      ROLLING_MONTHS_MIN,
                      Math.min(ROLLING_MONTHS_MAX, Number(e.target.value) || ROLLING_MONTHS_MIN)
                    ),
                  },
                })
              }
              className={`${inputCls} w-20`}
            />
            <span className="text-xs text-galet-ink">mois après le premier passage du cycle.</span>
          </div>
        )}

        {value.expiration.type === 'fixed_date' && (
          <div className="mt-2 flex items-center gap-2 text-sm text-galet-ink">
            <span>Chaque</span>
            <input
              type="number"
              min={1}
              max={31}
              value={value.expiration.day}
              aria-label="Jour d'expiration"
              onChange={(e) =>
                onChange({
                  ...value,
                  expiration: {
                    type: 'fixed_date',
                    month: (value.expiration as { month: number }).month,
                    day: Math.max(1, Math.min(31, Number(e.target.value) || 31)),
                  },
                })
              }
              className={`${inputCls} w-16`}
            />
            <span>/</span>
            <input
              type="number"
              min={1}
              max={12}
              value={value.expiration.month}
              aria-label="Mois d'expiration"
              onChange={(e) =>
                onChange({
                  ...value,
                  expiration: {
                    type: 'fixed_date',
                    month: Math.max(1, Math.min(12, Number(e.target.value) || 12)),
                    day: (value.expiration as { day: number }).day,
                  },
                })
              }
              className={`${inputCls} w-16`}
            />
          </div>
        )}
      </div>

      {/* Statuts clients (cumul à vie) */}
      <div>
        <p className="text-xs font-medium text-galet-ink mb-1.5">Statuts clients (optionnel)</p>
        <p className="text-[11px] text-galet-ink mb-2">
          Basés sur le TOTAL de points gagnés depuis le début — jamais remis à zéro, un statut acquis ne se perd pas.
          L&apos;avantage est un texte affiché sur la carte (jeton {'{statut}'} pour le libellé), sans effet sur le calcul des points.
        </p>
        <div className="space-y-2">
          {statusTiers.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-surface border border-line-warm rounded-xl px-2 py-2">
              <input
                type="number"
                min={0}
                value={s.threshold}
                aria-label={`Seuil du statut ${i + 1}`}
                onChange={(e) => setStatus(i, { threshold: Math.max(0, Number(e.target.value) || 0) })}
                className={`${inputCls} w-20 shrink-0`}
              />
              <input
                type="text"
                maxLength={STATUS_LABEL_MAX}
                value={s.label}
                placeholder="Ex. Argent"
                aria-label={`Libellé du statut ${i + 1}`}
                onChange={(e) => setStatus(i, { label: e.target.value })}
                className={`${inputCls} w-32 shrink-0`}
              />
              <input
                type="text"
                maxLength={STATUS_BENEFIT_MAX}
                value={s.benefit}
                placeholder="Avantage — ex. 5% de réduction permanente"
                aria-label={`Avantage du statut ${i + 1}`}
                onChange={(e) => setStatus(i, { benefit: e.target.value })}
                className={`${inputCls} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={() => removeStatus(i)}
                aria-label={`Supprimer le statut ${i + 1}`}
                className="shrink-0 p-1.5 text-galet-ink hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {statusTiers.length < STATUS_MAX && (
          <button
            type="button"
            onClick={addStatus}
            className="mt-2 flex items-center gap-2 w-full border border-dashed border-halo/40 rounded-xl px-3 py-2.5 text-sm text-galet-ink hover:text-halo hover:border-halo hover:bg-halo/5 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Ajouter un statut
          </button>
        )}
      </div>
    </div>
  );
}
