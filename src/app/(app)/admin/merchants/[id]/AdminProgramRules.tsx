"use client";

// Fiche admin — règles du programme de fidélité, pour les 5 mécaniques du
// moteur. Composant contrôlé : l'état (ProgramRulesState) vit dans
// EditMerchantForm ; la VALIDATION est celle du moteur (validateProgramRules →
// buildLoyaltyUpdate → validateLoyaltyProgram), aucune règle n'est dupliquée
// ici — seulement des gardes de saisie. Toutes les clés de loyalty_config
// ressortent (round-trip), sinon la sauvegarde effacerait une option Studio.
// Le sélecteur reste un <select> (patron historique de la fiche) ; l'éditeur
// « points » réutilise PointsSection du Studio (même composant, mêmes labels).

import { Plus, Trash2 } from "lucide-react";
import type { LoyaltyType } from "@/lib/loyalty/types";
import { PROGRAM_TYPES, type ProgramRulesState, type TierState } from "@/lib/loyalty/studioProgramState";
import PointsSection from "@/app/(app)/dashboard/studio/_components/PointsSection";

export const PROGRAM_LABELS: Record<LoyaltyType, string> = {
  stamp_card: "Carte à tampons (objectif)",
  visit_based: "Paliers de visites (récompenses successives)",
  tiered: "Niveaux de fidélité (statuts)",
  amount_points: "Points par CHF dépensés",
  points: "Carte à points (points fixes par passage)",
};

const PROGRAM_HELP: Record<LoyaltyType, string> = {
  stamp_card: "Cyclique : la carte se remplit jusqu'à l'objectif, puis se remet à zéro à l'encaissement.",
  visit_based: "Cumulatif : une récompense est offerte à chaque palier de visites atteint, sans remise à zéro.",
  tiered: "Cumulatif : le client gagne des niveaux permanents selon ses visites (pas d'encaissement).",
  amount_points: "Cumulatif : chaque encaissement crédite des points au prorata du montant dépensé ; récompense au seuil de points.",
  points: "Un nombre fixe de points par passage, plusieurs paliers de récompense, expiration et statuts possibles.",
};

const MILESTONES_MAX = 10;
const TIERS_MAX = 6;

const numInput = "w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 focus:border-halo outline-none transition-all text-onyx";
const removeBtn = "p-3 rounded-2xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink transition-colors disabled:opacity-30";
const addBtn = "flex items-center gap-2 text-sm text-halo hover:text-halo-600 transition-colors ml-1";

type Props = {
  rules: ProgramRulesState;
  onChange: (rules: ProgramRulesState) => void;
  onSelectType: (type: LoyaltyType) => void;
  /** Objectif de tampons (champ « Objectif carte ») — borne la récompense intermédiaire. */
  stampGoal: number;
  /** Erreurs live du moteur (validateProgramRules). */
  errors: string[];
  /** Champ « Objectif carte » (stamp_card) — rendu juste après la mécanique :
   *  il borne la récompense intermédiaire affichée en dessous. */
  goalField?: React.ReactNode;
};

export default function AdminProgramRules({ rules, onChange, onSelectType, stampGoal, errors, goalField }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="admin-loyalty-type" className="text-sm font-medium text-galet-ink ml-1">
          Type de programme
        </label>
        <select
          id="admin-loyalty-type"
          value={rules.type}
          onChange={(e) => onSelectType(e.target.value as LoyaltyType)}
          className={numInput}
        >
          {PROGRAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROGRAM_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="text-xs text-galet ml-1">{PROGRAM_HELP[rules.type]}</p>
      </div>

      {rules.type === "stamp_card" && goalField}

      <RulesEditor rules={rules} onChange={onChange} stampGoal={stampGoal} />

      {errors.length > 0 && (
        <p role="alert" className="text-sm text-red-600 ml-1">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

function RulesEditor({ rules, onChange, stampGoal }: { rules: ProgramRulesState; onChange: (r: ProgramRulesState) => void; stampGoal: number }) {
  switch (rules.type) {
    case "stamp_card":
      return <StampRulesEditor rules={rules} onChange={onChange} stampGoal={stampGoal} />;
    case "visit_based":
      return <MilestonesEditor rules={rules} onChange={onChange} />;
    case "tiered":
      return <TiersEditor rules={rules} onChange={onChange} />;
    case "amount_points":
      return <AmountPointsEditor rules={rules} onChange={onChange} />;
    case "points":
      return <PointsSection value={rules} onChange={(v) => onChange({ type: "points", ...v })} />;
  }
}

function StampRulesEditor({
  rules,
  onChange,
  stampGoal,
}: {
  rules: Extract<ProgramRulesState, { type: "stamp_card" }>;
  onChange: (r: ProgramRulesState) => void;
  stampGoal: number;
}) {
  const options: number[] = [];
  for (let n = 2; n < stampGoal; n++) options.push(n);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={rules.welcomeStamp}
          onChange={(e) => onChange({ ...rules, welcomeStamp: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-halo"
        />
        <span>
          <span className="block text-sm font-medium text-onyx">Tampon de bienvenue</span>
          <span className="block text-xs text-galet">Le client reçoit son premier tampon dès qu&apos;il ajoute la carte dans son téléphone.</span>
        </span>
      </label>
      <div className="space-y-2">
        <label htmlFor="admin-stamp-intermediate" className="text-sm font-medium text-galet-ink ml-1">
          Récompense intermédiaire
        </label>
        <select
          id="admin-stamp-intermediate"
          value={rules.intermediateMilestone ?? ""}
          onChange={(e) => onChange({ ...rules, intermediateMilestone: e.target.value === "" ? null : Number(e.target.value) })}
          className={numInput}
        >
          <option value="">Aucune</option>
          {options.map((n) => (
            <option key={n} value={n}>
              Au {n}e tampon
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function MilestonesEditor({ rules, onChange }: { rules: Extract<ProgramRulesState, { type: "visit_based" }>; onChange: (r: ProgramRulesState) => void }) {
  const set = (i: number, v: number) => onChange({ ...rules, milestones: rules.milestones.map((m, j) => (j === i ? v : m)) });
  const remove = (i: number) => onChange({ ...rules, milestones: rules.milestones.filter((_, j) => j !== i) });
  const add = () => onChange({ ...rules, milestones: [...rules.milestones, (rules.milestones[rules.milestones.length - 1] ?? 0) + 10] });
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-galet-ink ml-1">Paliers de visites (croissants, jusqu&apos;à {MILESTONES_MAX})</label>
      {rules.milestones.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-galet-ink">Palier {i + 1}</span>
          <input type="number" min={1} value={m} aria-label={`Palier ${i + 1}`} onChange={(e) => set(i, Number(e.target.value))} className={`${numInput} w-28`} />
          <button type="button" aria-label={`Supprimer le palier ${i + 1}`} disabled={rules.milestones.length <= 1} onClick={() => remove(i)} className={removeBtn}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      {rules.milestones.length < MILESTONES_MAX && (
        <button type="button" onClick={add} className={addBtn}>
          <Plus className="w-4 h-4" /> Ajouter un palier
        </button>
      )}
    </div>
  );
}

function TiersEditor({ rules, onChange }: { rules: Extract<ProgramRulesState, { type: "tiered" }>; onChange: (r: ProgramRulesState) => void }) {
  const set = (i: number, patch: Partial<TierState>) => onChange({ ...rules, tiers: rules.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const remove = (i: number) => onChange({ ...rules, tiers: rules.tiers.filter((_, j) => j !== i) });
  const add = () => onChange({ ...rules, tiers: [...rules.tiers, { name: "", at: (rules.tiers[rules.tiers.length - 1]?.at ?? 0) + 10 }] });
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-galet-ink ml-1">Niveaux (nom + nombre de visites, jusqu&apos;à {TIERS_MAX})</label>
      {rules.tiers.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={t.name} maxLength={40} placeholder="Nom (ex : Argent)" aria-label={`Nom du niveau ${i + 1}`} onChange={(e) => set(i, { name: e.target.value })} className={`${numInput} flex-1`} />
          <input type="number" min={1} value={t.at} aria-label={`Seuil du niveau ${i + 1}`} onChange={(e) => set(i, { at: Number(e.target.value) })} className={`${numInput} w-28`} />
          <button type="button" aria-label={`Supprimer le niveau ${i + 1}`} disabled={rules.tiers.length <= 1} onClick={() => remove(i)} className={removeBtn}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      {rules.tiers.length < TIERS_MAX && (
        <button type="button" onClick={add} className={addBtn}>
          <Plus className="w-4 h-4" /> Ajouter un niveau
        </button>
      )}
    </div>
  );
}

function AmountPointsEditor({ rules, onChange }: { rules: Extract<ProgramRulesState, { type: "amount_points" }>; onChange: (r: ProgramRulesState) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="admin-ap-ppc" className="text-sm font-medium text-galet-ink ml-1">Points par franc dépensé</label>
        <input id="admin-ap-ppc" type="number" min={0} step="0.1" value={rules.pointsPerChf} onChange={(e) => onChange({ ...rules, pointsPerChf: Number(e.target.value) })} className={numInput} />
      </div>
      <div className="space-y-2">
        <label htmlFor="admin-ap-threshold" className="text-sm font-medium text-galet-ink ml-1">Seuil de récompense (points)</label>
        <input id="admin-ap-threshold" type="number" min={1} value={rules.rewardThreshold} onChange={(e) => onChange({ ...rules, rewardThreshold: Number(e.target.value) })} className={numInput} />
      </div>
      <div className="space-y-2">
        <label htmlFor="admin-ap-label" className="text-sm font-medium text-galet-ink ml-1">Libellé de la récompense</label>
        <input id="admin-ap-label" value={rules.rewardLabel} maxLength={80} placeholder="Ex : CHF 20 offerts" onChange={(e) => onChange({ ...rules, rewardLabel: e.target.value })} className={numInput} />
      </div>
      <div className="space-y-2">
        <label htmlFor="admin-ap-max" className="text-sm font-medium text-galet-ink ml-1">Plafond de points par encaissement (optionnel)</label>
        <input
          id="admin-ap-max"
          type="number"
          min={1}
          value={rules.maxPointsPerScan ?? ""}
          placeholder="1000 (défaut moteur)"
          onChange={(e) => onChange({ ...rules, maxPointsPerScan: e.target.value === "" ? null : Number(e.target.value) })}
          className={numInput}
        />
      </div>
    </div>
  );
}
