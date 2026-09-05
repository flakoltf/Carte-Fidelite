'use client';

// Section « Programme de fidélité » : le commerçant choisit sa mécanique parmi
// les 5 que le moteur sait faire tourner, puis règle TOUTES ses options — sans
// passer par l'admin. Composant contrôlé : l'état vit dans StudioClient, la
// validation de fond reste celle du moteur (validateLoyaltyProgram via
// validateProgramRules), ici seulement des gardes de saisie.

import { Plus, Trash2 } from 'lucide-react';
import type { LoyaltyType } from '@/lib/loyalty/types';
import { PROGRAM_TYPES, type CycleExpirationState, type ProgramRulesState, type TierState } from '@/lib/loyalty/studioProgramState';
import PointsSection from './PointsSection';

export const PROGRAM_LABELS: Record<LoyaltyType, string> = {
  stamp_card: 'Carte à tampons',
  visit_based: 'Paliers de visites',
  tiered: 'Niveaux par visites',
  amount_points: 'Points par franc dépensé',
  points: 'Carte à points',
};

const PROGRAM_HELP: Record<LoyaltyType, string> = {
  stamp_card: 'Un tampon par passage. La récompense arrive quand la carte est pleine, puis elle repart à zéro.',
  visit_based: 'Une récompense à chaque palier de visites atteint. Le compteur ne repart jamais à zéro.',
  tiered: 'Vos clients gagnent un niveau (Bronze, Argent, Or…) au fil de leurs visites. Rien à encaisser.',
  amount_points: 'À chaque encaissement, des points au prorata du montant. Récompense dès le seuil atteint.',
  points: 'Un nombre fixe de points par passage, plusieurs paliers de récompense, expiration possible.',
};

const MILESTONES_MAX = 10;
const TIERS_MAX = 6;
const TIER_NAME_MAX = 40;
const REWARD_LABEL_MAX = 80;

const inputCls =
  'bg-calcaire border border-line-warm rounded-xl px-3 py-2 text-sm text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet-ink';
const addBtnCls =
  'mt-2 flex items-center gap-2 w-full border border-dashed border-halo/40 rounded-xl px-3 py-2.5 text-sm text-galet-ink hover:text-halo hover:border-halo hover:bg-halo/5 transition-all';
const removeBtnCls =
  'shrink-0 p-1.5 text-galet-ink hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

type Props = {
  rules: ProgramRulesState;
  onChange: (rules: ProgramRulesState) => void;
  onSelectType: (type: LoyaltyType) => void;
  /** Objectif de tampons (design.stamps.goal) — borne la récompense intermédiaire. */
  stampGoal: number;
  /** Mode express : seule la carte à tampons est réglable (les autres → studio complet). */
  express?: boolean;
};

export default function ProgramSection({ rules, onChange, onSelectType, stampGoal, express = false }: Props) {
  return (
    <div className="space-y-6">
      {/* Mécanique */}
      <div role="radiogroup" aria-label="Mécanique du programme" className="grid gap-2 sm:grid-cols-2">
        {PROGRAM_TYPES.map((type) => {
          const active = rules.type === type;
          // Le mode express ne persiste que reward_label/couleur + brouillon
          // (validateAndContinue) : il n'appelle jamais /publish, seul chemin qui
          // écrit merchants.loyalty_type/loyalty_config. On y verrouille donc
          // toute mécanique autre que les tampons — réglable dans le studio complet.
          if (express && type !== 'stamp_card') {
            return (
              <span
                key={type}
                title={`${PROGRAM_LABELS[type]} : à régler dans le studio complet`}
                className={`rounded-xl border px-4 py-3 text-sm font-medium cursor-not-allowed select-none ${
                  active ? 'border-halo bg-halo/5 text-onyx' : 'border-dashed border-line-warm text-galet-ink'
                }`}
              >
                {PROGRAM_LABELS[type]} · studio complet
              </span>
            );
          }
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={PROGRAM_LABELS[type]}
              onClick={() => onSelectType(type)}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                active ? 'border-halo bg-halo/5' : 'border-line-warm hover:border-halo/60'
              }`}
            >
              <span className={`block text-sm font-medium ${active ? 'text-onyx' : 'text-galet-ink'}`}>{PROGRAM_LABELS[type]}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-galet-ink">{PROGRAM_HELP[type]}</span>
            </button>
          );
        })}
      </div>

      {express && rules.type !== 'stamp_card' ? (
        // Chargé avec une mécanique non réglable en express : aucune saisie
        // possible, pour ne jamais laisser croire qu'elle serait persistée.
        <p className="text-sm text-galet-ink">
          Cette carte utilise déjà un programme à points ou à paliers ({PROGRAM_LABELS[rules.type]}). Réglez ses
          règles dans le studio complet — ouvrez-le depuis le tableau de bord une fois l&apos;essentiel validé ici.
        </p>
      ) : (
        <ProgramRulesEditor rules={rules} onChange={onChange} stampGoal={stampGoal} />
      )}
    </div>
  );
}

function ProgramRulesEditor({ rules, onChange, stampGoal }: { rules: ProgramRulesState; onChange: (r: ProgramRulesState) => void; stampGoal: number }) {
  switch (rules.type) {
    case 'stamp_card':
      return <StampRulesEditor rules={rules} onChange={onChange} stampGoal={stampGoal} />;
    case 'visit_based':
      return <MilestonesEditor rules={rules} onChange={onChange} />;
    case 'tiered':
      return <TiersEditor rules={rules} onChange={onChange} />;
    case 'amount_points':
      return <AmountPointsEditor rules={rules} onChange={onChange} />;
    case 'points':
      return (
        <div className="space-y-4">
          <p className="text-sm text-galet-ink">
            Le champ principal de la carte affiche le solde de points (jeton{' '}
            <code className="rounded bg-calcaire px-1.5 py-0.5 text-onyx">{'{points}'}</code>).
          </p>
          <PointsSection value={rules} onChange={(v) => onChange({ type: 'points', ...v })} />
        </div>
      );
  }
}

// ─── Échéance glissante (stamp_card / amount_points) ─────────────────────────
// Même copy que l'expiration des cartes à points, adaptée à l'ancre réelle :
// ici le cycle repart à zéro après N mois SANS PASSAGE (dernier passage,
// pas premier scan du cycle). La borne 1–60 est celle du moteur (validate).

const ROLLING_MONTHS_MIN = 1;
const ROLLING_MONTHS_MAX = 60;

function CycleExpirationEditor({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: CycleExpirationState;
  onChange: (v: CycleExpirationState) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-galet-ink mb-1.5 block">
        {label}
      </label>
      <p className="text-[11px] text-galet-ink mb-2">{help}</p>
      <select
        id={id}
        value={value.type}
        onChange={(e) => onChange(e.target.value === 'rolling' ? { type: 'rolling', months: 12 } : { type: 'none' })}
        className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-all"
      >
        <option value="none">Aucune expiration</option>
        <option value="rolling">Glissante : remise à zéro après N mois sans passage</option>
      </select>
      {value.type === 'rolling' && (
        <div className="mt-2 flex items-center gap-3">
          <input
            type="number"
            min={ROLLING_MONTHS_MIN}
            max={ROLLING_MONTHS_MAX}
            value={value.months}
            aria-label="Durée avant expiration en mois"
            onChange={(e) =>
              onChange({
                type: 'rolling',
                months: Math.max(ROLLING_MONTHS_MIN, Math.min(ROLLING_MONTHS_MAX, Number(e.target.value) || ROLLING_MONTHS_MIN)),
              })
            }
            className={`${inputCls} w-20`}
          />
          <span className="text-xs text-galet-ink">mois après le dernier passage.</span>
        </div>
      )}
    </div>
  );
}

// ─── Carte à tampons : options au-delà de l'objectif ─────────────────────────

function StampRulesEditor({
  rules,
  onChange,
  stampGoal,
}: {
  rules: Extract<ProgramRulesState, { type: 'stamp_card' }>;
  onChange: (r: ProgramRulesState) => void;
  stampGoal: number;
}) {
  // Palier intermédiaire strictement entre 1 et l'objectif (borne moteur).
  const options: number[] = [];
  for (let n = 2; n < stampGoal; n++) options.push(n);
  return (
    <div className="space-y-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={rules.welcomeStamp}
          onChange={(e) => onChange({ ...rules, welcomeStamp: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[var(--color-halo)]"
        />
        <span>
          <span className="block text-sm font-medium text-onyx">Tampon de bienvenue</span>
          <span className="block text-[11px] text-galet-ink">
            Le client reçoit son premier tampon dès qu&apos;il ajoute la carte dans son téléphone.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="stamp-intermediate" className="block text-sm font-medium text-onyx">
          Récompense intermédiaire
        </label>
        <p className="mb-1.5 text-[11px] text-galet-ink">
          Une petite attention en cours de route, à un tampon précis. La grande récompense reste à la carte pleine.
        </p>
        <select
          id="stamp-intermediate"
          value={rules.intermediateMilestone ?? ''}
          onChange={(e) => onChange({ ...rules, intermediateMilestone: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-all"
        >
          <option value="">Aucune</option>
          {options.map((n) => (
            <option key={n} value={n}>
              Au {n}e tampon
            </option>
          ))}
        </select>
      </div>

      <CycleExpirationEditor
        id="stamp-expiration"
        label="Expiration des tampons"
        help="À l'échéance, les tampons du cycle repartent à zéro. Sans échéance, ils restent acquis jusqu'à la carte pleine."
        value={rules.expiration}
        onChange={(expiration) => onChange({ ...rules, expiration })}
      />
    </div>
  );
}

// ─── Paliers de visites ──────────────────────────────────────────────────────

function MilestonesEditor({
  rules,
  onChange,
}: {
  rules: Extract<ProgramRulesState, { type: 'visit_based' }>;
  onChange: (r: ProgramRulesState) => void;
}) {
  const set = (i: number, v: number) => onChange({ ...rules, milestones: rules.milestones.map((m, j) => (j === i ? v : m)) });
  const remove = (i: number) => onChange({ ...rules, milestones: rules.milestones.filter((_, j) => j !== i) });
  const add = () => {
    const last = rules.milestones[rules.milestones.length - 1] ?? 0;
    onChange({ ...rules, milestones: [...rules.milestones, last + 10] });
  };
  return (
    <div>
      <p className="text-xs font-medium text-galet-ink mb-1.5">Paliers de visites</p>
      <p className="text-[11px] text-galet-ink mb-2">
        Une récompense est offerte à chaque palier atteint (ex. 5e, 20e, 50e visite). Classez-les par ordre croissant,
        jusqu&apos;à {MILESTONES_MAX} paliers.
      </p>
      <div className="space-y-2">
        {rules.milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-2 bg-surface border border-line-warm rounded-xl px-2 py-2">
            <span className="w-24 shrink-0 text-xs text-galet-ink">Palier {i + 1}</span>
            <input
              type="number"
              min={1}
              value={m}
              aria-label={`Palier ${i + 1}`}
              onChange={(e) => set(i, Math.max(1, Number(e.target.value) || 1))}
              className={`${inputCls} w-24 shrink-0`}
            />
            <span className="flex-1 text-xs text-galet-ink">
              {m}
              {m === 1 ? 're' : 'e'} visite
            </span>
            <button type="button" onClick={() => remove(i)} disabled={rules.milestones.length <= 1} aria-label={`Supprimer le palier ${i + 1}`} className={removeBtnCls}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {rules.milestones.length < MILESTONES_MAX && (
        <button type="button" onClick={add} className={addBtnCls}>
          <Plus className="w-4 h-4" aria-hidden />
          Ajouter un palier
        </button>
      )}
      <p className="mt-3 text-[11px] text-galet-ink">Sans échéance : les visites restent acquises.</p>
    </div>
  );
}

// ─── Niveaux par visites — même pattern que les paliers des cartes à points ──

function TiersEditor({
  rules,
  onChange,
}: {
  rules: Extract<ProgramRulesState, { type: 'tiered' }>;
  onChange: (r: ProgramRulesState) => void;
}) {
  const set = (i: number, patch: Partial<TierState>) =>
    onChange({ ...rules, tiers: rules.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const remove = (i: number) => onChange({ ...rules, tiers: rules.tiers.filter((_, j) => j !== i) });
  const add = () => {
    const last = rules.tiers[rules.tiers.length - 1];
    onChange({ ...rules, tiers: [...rules.tiers, { name: '', at: (last?.at ?? 0) + 10 }] });
  };
  return (
    <div>
      <p className="text-xs font-medium text-galet-ink mb-1.5">Niveaux</p>
      <p className="text-[11px] text-galet-ink mb-2">
        Un niveau est atteint dès le nombre de visites indiqué, et reste acquis. Son nom s&apos;affiche sur la carte
        (jeton {'{palier}'}). Seuils croissants, jusqu&apos;à {TIERS_MAX} niveaux.
      </p>
      <div className="space-y-2">
        {rules.tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2 bg-surface border border-line-warm rounded-xl px-2 py-2">
            <input
              type="text"
              maxLength={TIER_NAME_MAX}
              value={t.name}
              placeholder="Ex. Argent"
              aria-label={`Nom du niveau ${i + 1}`}
              onChange={(e) => set(i, { name: e.target.value })}
              className={`${inputCls} flex-1 min-w-0`}
            />
            <span className="shrink-0 text-xs text-galet-ink">dès</span>
            <input
              type="number"
              min={1}
              value={t.at}
              aria-label={`Seuil du niveau ${i + 1}`}
              onChange={(e) => set(i, { at: Math.max(1, Number(e.target.value) || 1) })}
              className={`${inputCls} w-20 shrink-0`}
            />
            <span className="shrink-0 text-xs text-galet-ink">visites</span>
            <button type="button" onClick={() => remove(i)} disabled={rules.tiers.length <= 1} aria-label={`Supprimer le niveau ${i + 1}`} className={removeBtnCls}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {rules.tiers.length < TIERS_MAX && (
        <button type="button" onClick={add} className={addBtnCls}>
          <Plus className="w-4 h-4" aria-hidden />
          Ajouter un niveau
        </button>
      )}
      <p className="mt-3 text-[11px] text-galet-ink">Sans échéance : un niveau acquis ne se perd pas.</p>
    </div>
  );
}

// ─── Points par franc dépensé ────────────────────────────────────────────────

function AmountPointsEditor({
  rules,
  onChange,
}: {
  rules: Extract<ProgramRulesState, { type: 'amount_points' }>;
  onChange: (r: ProgramRulesState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="ap-ppc" className="block text-sm font-medium text-onyx">
          Points par franc dépensé
        </label>
        <p className="mb-1.5 text-[11px] text-galet-ink">Ex. 1 = un point par franc ; 0,5 = un point tous les deux francs.</p>
        <input
          id="ap-ppc"
          type="number"
          min={0.1}
          step={0.1}
          value={rules.pointsPerChf}
          onChange={(e) => onChange({ ...rules, pointsPerChf: Math.max(0.1, Number(e.target.value) || 0.1) })}
          className={`${inputCls} w-28`}
        />
      </div>
      <div>
        <label htmlFor="ap-threshold" className="block text-sm font-medium text-onyx">
          Seuil de récompense (points)
        </label>
        <p className="mb-1.5 text-[11px] text-galet-ink">Dès ce solde, la récompense peut être offerte au comptoir.</p>
        <input
          id="ap-threshold"
          type="number"
          min={1}
          value={rules.rewardThreshold}
          onChange={(e) => onChange({ ...rules, rewardThreshold: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
          className={`${inputCls} w-28`}
        />
      </div>
      <div>
        <label htmlFor="ap-label" className="block text-sm font-medium text-onyx">
          Récompense
        </label>
        <p className="mb-1.5 text-[11px] text-galet-ink">Ce que le client gagne — affiché sur sa carte.</p>
        <input
          id="ap-label"
          type="text"
          maxLength={REWARD_LABEL_MAX}
          value={rules.rewardLabel}
          placeholder="Ex. CHF 20 offerts"
          onChange={(e) => onChange({ ...rules, rewardLabel: e.target.value })}
          className={`${inputCls} w-full`}
        />
      </div>
      <div>
        <label htmlFor="ap-max" className="block text-sm font-medium text-onyx">
          Plafond de points par encaissement (optionnel)
        </label>
        <p className="mb-1.5 text-[11px] text-galet-ink">
          Protège d&apos;une erreur de saisie au comptoir. Vide = 1000 points maximum par encaissement.
        </p>
        <input
          id="ap-max"
          type="number"
          min={1}
          value={rules.maxPointsPerScan ?? ''}
          placeholder="1000"
          onChange={(e) =>
            onChange({ ...rules, maxPointsPerScan: e.target.value === '' ? null : Math.max(1, Math.round(Number(e.target.value)) || 1) })
          }
          className={`${inputCls} w-28`}
        />
      </div>
      <CycleExpirationEditor
        id="ap-expiration"
        label="Expiration des points"
        help="À l'échéance, le solde de points repart à zéro. Sans échéance, les points restent acquis jusqu'à la récompense."
        value={rules.expiration}
        onChange={(expiration) => onChange({ ...rules, expiration })}
      />
    </div>
  );
}
