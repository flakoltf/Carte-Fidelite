'use client';

// Studio de design de carte — éditeur WYSIWYG du marchand (Agent A).
// Brouillon → aperçu live (Apple + Google côte à côte) → publication versionnée.
// Source de données : /api/merchant/card-design (tenant résolu côté serveur,
// impersonation concierge comprise).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  History,
  Loader2,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Stamp,
  LayoutTemplate,
  Store,
  ListOrdered,
  QrCode,
} from 'lucide-react';
import type { CardDesign, LogoAssets, StampsConfig, CardTypeKey } from '@/lib/cardDesign/types';
import { DEFAULT_CARD_DESIGN, DEFAULT_STAMPS_CONFIG, CARD_TYPE_LABELS } from '@/lib/cardDesign/types';
import { validateStudioDesign } from '@/lib/cardDesign/studioValidation';
import TemplateGallery from './_components/TemplateGallery';
import ColorsSection from './_components/ColorsSection';
import StampsSection from './_components/StampsSection';
import ProgramSection, { PROGRAM_LABELS } from './_components/ProgramSection';
import {
  cardTypeForProgram,
  defaultProgramRules,
  programRulesFromMerchant,
  programRulesToStudioInput,
  validateProgramRules,
  type PointsRulesState,
  type ProgramRulesState,
} from '@/lib/loyalty/studioProgramState';
import type { LoyaltyType } from '@/lib/loyalty/types';
import FieldsSection from './_components/FieldsSection';
import BarcodeSection from './_components/BarcodeSection';
import ImageUploadField from './_components/ImageUploadField';
import StampGrid from './_components/StampGrid';
import {
  AppleWalletPreview,
  GoogleWalletPreview,
  type PreviewAssets,
  type SampleData,
} from './_components/WalletPreviews';

// ─── Types API ────────────────────────────────────────────────────────────────

type StudioPayload = {
  published: CardDesign | null;
  draft: CardDesign | null;
  version: number;
  publishedAt: string | null;
  draftSavedAt: string | null;
  assetUrls: PreviewAssets & { stampFilled?: string; stampEmpty?: string };
  merchant: {
    shopName: string;
    businessType: string | null;
    stampGoal: number;
    slug: string | null;
    loyaltyType: string | null;
    loyaltyConfig: Record<string, unknown> | null;
  } | null;
};

// Aperçu fidèle du jeton {points} d'une carte à POINTS (Minor 6, revue finale) :
// le vrai pass affiche « solde / dernier palier » (resolvePointsPassState) —
// jamais un nombre brut comme l'ancien `sampleStamps * 12`. On affiche une
// valeur représentative (mi-parcours du dernier palier) plutôt que de coupler
// ce jeton au curseur « Client fictif », qui n'a pas d'échelle liée aux paliers.
function pointsSampleLabel(rules: PointsRulesState): string {
  const maxThreshold = rules.tiers.length > 0 ? rules.tiers[rules.tiers.length - 1].threshold : 0;
  const mid = Math.round(maxThreshold / 2);
  return `${mid} / ${maxThreshold}`;
}

// Aperçu du jeton {progression} d'une carte à POINTS : mi-parcours du PREMIER
// palier — la cible réelle d'un client en début de cycle (redeemed_tiers vide),
// fidèle à pointsProgressionLabel côté pass.
function progressionSampleLabel(rules: PointsRulesState): string {
  const first = rules.tiers.length > 0 ? rules.tiers[0].threshold : 0;
  return `${Math.round(first / 2)}/${first} points`;
}

// Prochain seuil (palier de visites / niveau) que le client fictif n'a pas
// encore atteint — repli sur le dernier quand tout est atteint.
function nextThreshold(thresholds: number[], count: number): number {
  const sorted = [...thresholds].sort((a, b) => a - b);
  return sorted.find((t) => count < t) ?? sorted[sorted.length - 1] ?? 0;
}

// Échantillons statiques des jetons selon la mécanique (aperçu cohérent avec
// les règles, sans refonte du système d'aperçu). `count` = client fictif.
function programSample(rules: ProgramRulesState, count: number, stampGoal: number): Partial<SampleData> {
  switch (rules.type) {
    case 'stamp_card': {
      const c = Math.min(count, stampGoal);
      return { points: `${c} / ${stampGoal}`, progression: `${c}/${stampGoal} tampons` };
    }
    case 'visit_based':
      return { points: String(count), visites: String(count), progression: `${count}/${nextThreshold(rules.milestones, count)} visites` };
    case 'tiered': {
      const top = [...rules.tiers].sort((a, b) => a.at - b.at).filter((t) => t.name.trim());
      return {
        points: String(count),
        visites: String(count),
        progression: `${count}/${nextThreshold(rules.tiers.map((t) => t.at), count)} visites`,
        // Aspirationnel : plus haut niveau configuré (comme {statut}).
        ...(top.length > 0 ? { palier: top[top.length - 1].name } : {}),
      };
    }
    case 'amount_points': {
      const mid = Math.round(rules.rewardThreshold / 2);
      return { points: `${mid} / ${rules.rewardThreshold}`, progression: `${mid}/${rules.rewardThreshold} points` };
    }
    case 'points':
      return {
        points: pointsSampleLabel(rules),
        progression: progressionSampleLabel(rules),
        ...((rules.statusTiers?.length ?? 0) > 0 ? { statut: rules.statusTiers![rules.statusTiers!.length - 1].label } : {}),
      };
  }
}

type Feedback = { kind: 'ok' | 'partial' | 'error'; messages: string[] };

const sectionCls = 'bg-surface border border-line-warm rounded-3xl p-6 shadow-sm';

function SectionHeader({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2 font-bold text-onyx">
        <Icon className="w-4 h-4 text-halo" />
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-galet-ink">{sub}</p>
    </div>
  );
}

function timeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Libellés FR des métiers connus, pour la bannière du mode express.
const BUSINESS_TYPE_LABEL: Record<string, string> = {
  cafe: 'café',
  restaurant: 'restaurant',
  boulangerie: 'boulangerie',
  boutique: 'boutique',
  salon: 'salon',
  sport: 'club de sport',
  autre: 'commerce',
};
function sectorLabelFromType(type: string | null | undefined): string {
  return (type && BUSINESS_TYPE_LABEL[type]) || 'commerce';
}

// ─── Composant principal ──────────────────────────────────────────────────────

// `express` (déclenché par /dashboard/studio?express=1) : vue ultra-simplifiée
// d'onboarding — bannière + 3 essentiels (couleur, nom, récompense) + éditeur
// complet replié sous « Personnaliser plus ». Le studio normal est intact.
export default function StudioClient({ express = false }: { express?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [design, setDesign] = useState<CardDesign>(DEFAULT_CARD_DESIGN);
  const [published, setPublished] = useState<CardDesign | null>(null);
  const [version, setVersion] = useState(0);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<StudioPayload['merchant']>(null);
  const [assets, setAssets] = useState<StudioPayload['assetUrls']>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sampleStamps, setSampleStamps] = useState(7);
  // Règles du programme (merchants.loyalty_type/loyalty_config) — les 5
  // mécaniques du moteur, round-trippées intégralement à la publication.
  const [programRules, setProgramRules] = useState<ProgramRulesState>(() => defaultProgramRules('stamp_card'));
  // Mémoire des règles saisies par mécanique : changer d'avis puis revenir ne
  // perd pas la saisie (ni la config chargée depuis la base).
  const rulesByType = useRef<Partial<Record<LoyaltyType, ProgramRulesState>>>({});
  // Objectif de tampons du moteur tel que chargé (loyalty_config.goal, repli
  // stamp_goal) — utilisé quand la grille n'est pas éditable (visuel « points »
  // avec mécanique stamp_card, ex. kits démo) pour ne JAMAIS republier le défaut.
  const [loadedStampGoal, setLoadedStampGoal] = useState(10);
  // Référence du dernier état persisté (brouillon ou publication) pour le dirty-tracking.
  const lastPersisted = useRef<string>(JSON.stringify(DEFAULT_CARD_DESIGN));
  // Mode express : récompense (merchants.reward_label, hors design), repli de
  // l'éditeur avancé, et verrou pendant la validation finale.
  const [reward, setReward] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/merchant/card-design')
      .then((r) => {
        if (!r.ok) throw new Error('load failed');
        return r.json() as Promise<StudioPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        const initial: CardDesign = payload.draft ??
          payload.published ?? {
            ...DEFAULT_CARD_DESIGN,
            programName: payload.merchant?.shopName ?? DEFAULT_CARD_DESIGN.programName,
            cardType: 'stamps',
            stamps: { ...DEFAULT_STAMPS_CONFIG, goal: payload.merchant?.stampGoal ?? 10 },
          };
        setDesign(initial);
        lastPersisted.current = JSON.stringify(initial);
        setPublished(payload.published);
        setVersion(payload.version);
        setPublishedAt(payload.publishedAt);
        setDraftSavedAt(payload.draftSavedAt);
        setMerchant(payload.merchant);
        setAssets(payload.assetUrls ?? {});
        setSampleStamps(Math.min(7, (initial.stamps?.goal ?? 10) - 1));
        // Porte points→stamps (Important 1, revue finale) : un design TAMPONS
        // publié alors que merchants.loyalty_type vaut encore "points" (comptoir
        // + pass restés sur l'ancien programme) doit refermer la bascule — on
        // part donc sur des règles stamp_card, ce que le sélecteur affiche.
        const rules =
          (initial.cardType ?? 'stamps') === 'stamps' && payload.merchant?.loyaltyType === 'points'
            ? defaultProgramRules('stamp_card')
            : programRulesFromMerchant(payload.merchant?.loyaltyType, payload.merchant?.loyaltyConfig);
        rulesByType.current[rules.type] = rules;
        setProgramRules(rules);
        const cfgGoal = (payload.merchant?.loyaltyConfig as { goal?: unknown } | null)?.goal;
        setLoadedStampGoal(
          typeof cfgGoal === 'number' && Number.isInteger(cfgGoal) && cfgGoal >= 1 && cfgGoal <= 50
            ? cfgGoal
            : payload.merchant?.stampGoal ?? 10
        );
      })
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Pré-remplit `reward` depuis merchants.reward_label existant — utilisé pour
  // l'édition en mode express ET pour ne jamais l'écraser silencieusement à la
  // publication d'une carte à points (voir publish()).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/merchant/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { merchant?: { reward_label?: string | null } } | null) => {
        if (!cancelled && j?.merchant?.reward_label) setReward(String(j.merchant.reward_label));
      })
      .catch(() => {
        /* pas de pré-remplissage : le marchand saisit sa récompense */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cardType: CardTypeKey = design.cardType ?? 'stamps';
  const stamps: StampsConfig = design.stamps ?? DEFAULT_STAMPS_CONFIG;
  // Objectif du PROGRAMME : la grille quand elle est éditable (visuel tampons),
  // sinon l'objectif chargé — source unique pour validation, aperçu et publication.
  const programStampGoal = cardType === 'stamps' ? stamps.goal : loadedStampGoal;
  // Design (studioValidation) + règles du programme (même moteur que le serveur :
  // validateLoyaltyProgram via validateProgramRules — jamais dupliqué ici).
  const validation = useMemo(() => {
    const v = validateStudioDesign(design);
    return { errors: [...v.errors, ...validateProgramRules(programRules, programStampGoal)], warnings: v.warnings };
  }, [design, programRules, programStampGoal]);
  const dirty = JSON.stringify(design) !== lastPersisted.current;

  const sample: SampleData = useMemo(
    () => ({
      // Repli statique (jetons non pilotés par la mécanique) — déterministe, testable.
      nom: 'Sarah M.',
      palier: 'Argent',
      visites: '12',
      derniere_visite: '14.08.2026',
      // {statut} : plus haut statut configuré (aspirationnel), sinon « Or ».
      statut: 'Or',
      ...programSample(programRules, sampleStamps, programStampGoal),
    }),
    [sampleStamps, programStampGoal, programRules]
  );

  // ── Mutations locales ───────────────────────────────────────────────────────

  const update = useCallback((patch: Partial<CardDesign>) => {
    setDesign((d) => ({ ...d, ...patch }));
    setFeedback(null);
  }, []);

  // Changement de mécanique : restaure la saisie mémorisée (ou les défauts) et
  // aligne le visuel de la carte (même mapping que les templates).
  const selectProgramType = (type: LoyaltyType) => {
    if (type === programRules.type) return;
    rulesByType.current[programRules.type] = programRules;
    setProgramRules(rulesByType.current[type] ?? defaultProgramRules(type));
    const nextCardType = cardTypeForProgram(type);
    update({ cardType: nextCardType, ...(nextCardType === 'stamps' && !design.stamps ? { stamps: DEFAULT_STAMPS_CONFIG } : {}) });
  };

  const changeProgramRules = (rules: ProgramRulesState) => {
    setProgramRules(rules);
    setFeedback(null);
  };

  const mergeAssets = (incoming: LogoAssets) => {
    setDesign((d) => ({
      ...d,
      logo: {
        ...d.logo,
        assets: {
          apple: { ...d.logo.assets?.apple, ...incoming.apple },
          google: { ...d.logo.assets?.google, ...incoming.google },
        },
      },
    }));
    setFeedback(null);
  };

  // ── Persistance ─────────────────────────────────────────────────────────────

  const saveDraft = async () => {
    setSavingDraft(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/merchant/card-design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: design }),
      });
      const json = (await res.json().catch(() => ({}))) as { draftSavedAt?: string; error?: string };
      if (!res.ok) {
        setFeedback({ kind: 'error', messages: [json.error ?? "Impossible d'enregistrer le brouillon."] });
        return;
      }
      lastPersisted.current = JSON.stringify(design);
      setDraftSavedAt(json.draftSavedAt ?? new Date().toISOString());
      setFeedback({ kind: 'ok', messages: ['Brouillon enregistré — votre carte publiée reste inchangée.'] });
    } catch {
      setFeedback({ kind: 'error', messages: ['Erreur de connexion.'] });
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    setFeedback(null);
    try {
      // Règles du programme : TOUJOURS envoyées, pour les 5 mécaniques, avec
      // toutes leurs clés (round-trip garanti par studioProgramState — une clé
      // perdue ici serait un effacement silencieux en base). L'objectif de la
      // carte à tampons est celui du design (source unique côté Studio) : la
      // publication aligne ainsi loyalty_config.goal ET merchants.stamp_goal.
      // reward_label : absent du body quand vide → préservé côté serveur
      // (Important 2, revue finale).
      const program = programRulesToStudioInput(programRules, programStampGoal, reward.trim() !== '' ? reward.trim() : undefined);
      const res = await fetch('/api/merchant/card-design/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design, program }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        version?: number;
        errors?: string[];
        warnings?: string[];
        error?: string;
      };
      if (res.status === 422 && Array.isArray(json.errors)) {
        setFeedback({ kind: 'error', messages: json.errors });
      } else if (res.status === 207) {
        finalizePublish(json.version);
        setFeedback({
          kind: 'partial',
          messages: [
            `Version ${json.version} publiée. La mise à jour Google Wallet a échoué — elle sera retentée à la prochaine publication.`,
            ...(json.warnings ?? []),
          ],
        });
      } else if (res.ok) {
        finalizePublish(json.version);
        setFeedback({
          kind: 'ok',
          messages: [
            `Version ${json.version} publiée — vos nouvelles cartes utilisent ce design dès maintenant.`,
            ...(json.warnings ?? []),
          ],
        });
      } else {
        setFeedback({ kind: 'error', messages: [json.error ?? 'Erreur lors de la publication.'] });
      }
    } catch {
      setFeedback({ kind: 'error', messages: ['Erreur de connexion.'] });
    } finally {
      setPublishing(false);
    }
  };

  const finalizePublish = (newVersion?: number) => {
    lastPersisted.current = JSON.stringify(design);
    setPublished(design);
    setDraftSavedAt(null);
    setPublishedAt(new Date().toISOString());
    if (typeof newVersion === 'number') setVersion(newVersion);
  };

  const revertToPublished = () => {
    if (!published) return;
    setDesign(published);
    setFeedback({ kind: 'ok', messages: ['Retour à la version publiée. Enregistrez le brouillon pour confirmer.'] });
  };

  // Mode express : « Valider et continuer ». Persiste la récompense (+ couleur
  // principale) via /api/merchant/me, enregistre le brouillon de design, puis
  // emmène le marchand distribuer son QR (/dashboard/card). Tenancy côté serveur.
  const validateAndContinue = async () => {
    setValidating(true);
    setFeedback(null);
    try {
      const meRes = await fetch('/api/merchant/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reward_label: reward.trim() === '' ? null : reward.trim(),
          primary_color: design.colors.background,
        }),
      });
      if (!meRes.ok) {
        const j = (await meRes.json().catch(() => ({}))) as { error?: string };
        setFeedback({ kind: 'error', messages: [j.error ?? "Impossible d'enregistrer la récompense."] });
        return;
      }
      const draftRes = await fetch('/api/merchant/card-design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: design }),
      });
      if (!draftRes.ok) {
        setFeedback({ kind: 'error', messages: ['Récompense enregistrée, mais le design n\'a pas pu être sauvegardé — réessayez.'] });
        return;
      }
      lastPersisted.current = JSON.stringify(design);
      router.push('/dashboard/card');
    } catch {
      setFeedback({ kind: 'error', messages: ['Erreur de connexion.'] });
    } finally {
      setValidating(false);
    }
  };

  // ── États globaux ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-galet-ink">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-8 text-sm text-red-700">
        Le studio n&apos;a pas pu charger votre carte. Rechargez la page — si le problème persiste,
        écrivez-nous : contact@halocard.ch
      </div>
    );
  }

  const previewAssets: PreviewAssets = {
    appleLogo: assets.appleLogo,
    appleStrip: assets.appleStrip,
    googleLogo: assets.googleLogo,
    googleHero: assets.googleHero,
  };

  return (
    <div className="space-y-6 pb-28">
      {express && (
        <div className="space-y-4">
          {/* Bannière : la carte est déjà pré-remplie pour le métier. */}
          <div className="flex items-start gap-3 rounded-3xl border border-halo/30 bg-halo/[0.06] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-halo text-white">
              <Palette className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-onyx">
                Votre carte de {sectorLabelFromType(merchant?.businessType)} est pré-remplie
              </h1>
              <p className="mt-0.5 text-sm text-galet-ink">
                Vérifiez et validez les 3 essentiels — c&apos;est tout.
              </p>
            </div>
          </div>

          {/* 3 essentiels : couleur, nom du programme, récompense. */}
          <div className="space-y-4 rounded-3xl border border-line-warm bg-surface p-5 shadow-sm">
            <div>
              <label htmlFor="oe-color" className="mb-1.5 block text-xs font-medium text-galet-ink">
                Couleur principale
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="oe-color"
                  type="color"
                  value={design.colors.background}
                  onChange={(e) => update({ colors: { ...design.colors, background: e.target.value } })}
                  className="h-11 w-16 cursor-pointer rounded-xl border border-line-warm bg-calcaire"
                />
                <span className="font-mono text-sm tabular-nums text-galet-ink">{design.colors.background}</span>
              </div>
            </div>
            <div>
              <label htmlFor="oe-program" className="mb-1.5 block text-xs font-medium text-galet-ink">
                Nom du programme
              </label>
              <input
                id="oe-program"
                value={design.programName}
                onChange={(e) => update({ programName: e.target.value })}
                maxLength={60}
                placeholder="Carte de fidélité"
                className="w-full rounded-2xl border border-line-warm bg-calcaire px-4 py-3 text-onyx outline-none transition-colors focus:border-halo placeholder:text-galet-ink"
              />
            </div>
            <div>
              <label htmlFor="oe-reward" className="mb-1.5 block text-xs font-medium text-galet-ink">
                Récompense
              </label>
              <input
                id="oe-reward"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                maxLength={80}
                placeholder="Ex. Le 10e café offert"
                className="w-full rounded-2xl border border-line-warm bg-calcaire px-4 py-3 text-onyx outline-none transition-colors focus:border-halo placeholder:text-galet-ink"
              />
              <p className="mt-1 text-[11px] text-galet-ink">Ce que le client gagne — affiché sur sa carte.</p>
            </div>
          </div>

          {/* Tout le reste replié : l'éditeur complet ne se monte qu'à l'ouverture. */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between rounded-2xl border border-line-warm bg-surface px-4 py-3 text-sm font-medium text-galet-ink transition-colors hover:bg-calcaire"
          >
            <span className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-halo" aria-hidden />
              Personnaliser plus
            </span>
            {advancedOpen ? <Minus className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}

      {!express && (
      <>
      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-onyx mb-2">Studio de carte</h1>
          <p className="text-galet-ink max-w-2xl">
            Composez la carte que vos clients gardent dans leur téléphone. Tout ce que vous voyez à
            droite est fidèle au rendu Apple Wallet et Google Wallet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-calcaire border border-line-warm px-3 py-1.5 text-galet-ink">
            <History className="w-3.5 h-3.5" aria-hidden />
            {version > 0 ? `Version ${version} publiée${timeLabel(publishedAt) ? ` · ${timeLabel(publishedAt)}` : ''}` : 'Jamais publiée'}
          </span>
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 px-3 py-1.5 font-medium">
              Modifications non enregistrées
            </span>
          ) : draftSavedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-halo/10 text-halo px-3 py-1.5 font-medium">
              Brouillon enregistré · {timeLabel(draftSavedAt)}
            </span>
          ) : null}
        </div>
      </div>
      </>
      )}

      {(!express || advancedOpen) && (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] items-start">
        {/* ── Colonne édition ──────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Modèles */}
          <section className={sectionCls}>
            <SectionHeader
              icon={LayoutTemplate}
              title="Modèles de départ"
              sub="Partez d'une base pensée pour votre métier — puis personnalisez chaque détail."
            />
            <TemplateGallery
              businessType={merchant?.businessType ?? null}
              design={design}
              onApply={(d) => {
                setDesign(d);
                setFeedback(null);
              }}
            />
          </section>

          {/* Identité */}
          <section className={sectionCls}>
            <SectionHeader
              icon={Store}
              title="Identité"
              sub="Nom du programme, logo et bannière — l'ossature visuelle de votre carte."
            />
            <label className="block text-xs font-medium text-galet-ink mb-1.5">Nom du programme</label>
            <input
              value={design.programName}
              onChange={(e) => update({ programName: e.target.value })}
              placeholder="Carte de fidélité"
              maxLength={60}
              className="w-full bg-calcaire border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet-ink"
            />
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-galet-ink mb-2">Logo</p>
                <ImageUploadField
                  kind="logo"
                  currentUrl={assets.appleLogo}
                  onUploaded={(result, previewUrl) => {
                    if (result.assets) mergeAssets(result.assets);
                    setAssets((a) => ({ ...a, appleLogo: previewUrl, googleLogo: previewUrl }));
                  }}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-galet-ink mb-2">Bannière (strip Apple / hero Google)</p>
                <ImageUploadField
                  kind="strip"
                  currentUrl={assets.appleStrip}
                  onUploaded={(result, previewUrl) => {
                    if (result.assets) mergeAssets(result.assets);
                    setAssets((a) => ({ ...a, appleStrip: previewUrl, googleHero: previewUrl }));
                  }}
                />
              </div>
            </div>
          </section>

          {/* Couleurs */}
          <section className={sectionCls}>
            <SectionHeader
              icon={Palette}
              title="Couleurs"
              sub="Fond, texte et libellés — le contraste est vérifié en direct (WCAG AA)."
            />
            <ColorsSection colors={design.colors} onChange={(colors) => update({ colors })} />
          </section>

          {/* Programme de fidélité : mécanique + règles, puis visuel des tampons */}
          <section className={sectionCls}>
            <SectionHeader
              icon={Stamp}
              title="Programme de fidélité"
              sub="Choisissez la mécanique, puis réglez toutes ses règles — le comptoir et les cartes suivent dès la publication."
            />
            <ProgramSection
              rules={programRules}
              onChange={changeProgramRules}
              onSelectType={selectProgramType}
              stampGoal={programStampGoal}
              express={express}
            />
            <div className="mt-6 flex flex-wrap gap-2">
              {(['cashback', 'subscription'] as CardTypeKey[]).map((t) => (
                <span
                  key={t}
                  className="rounded-xl border border-dashed border-line-warm px-4 py-2 text-sm text-galet-ink cursor-not-allowed select-none"
                  title="Bientôt disponible"
                >
                  {CARD_TYPE_LABELS[t]} · bientôt
                </span>
              ))}
            </div>
            {cardType === 'stamps' && (
              <div className="mt-8 border-t border-line-warm pt-6">
                <h3 className="mb-1 text-sm font-bold text-onyx">Tampons</h3>
                <p className="mb-5 text-xs text-galet-ink">
                  {programRules.type === 'stamp_card'
                    ? "Objectif, icône et forme des alvéoles — l'objectif est aussi celui du programme."
                    : `Visuel de la grille sur la page client (mécanique « ${PROGRAM_LABELS[programRules.type]} »).`}
                </p>
                <StampsSection
                  stamps={stamps}
                  onChange={(s) => update({ stamps: s })}
                  background={design.colors.background}
                  filledUrl={assets.stampFilled}
                  emptyUrl={assets.stampEmpty}
                  onFilledUploaded={(path, previewUrl) => {
                    update({ stamps: { ...stamps, filledAssetPath: path } });
                    setAssets((a) => ({ ...a, stampFilled: previewUrl }));
                  }}
                  onEmptyUploaded={(path, previewUrl) => {
                    update({ stamps: { ...stamps, emptyAssetPath: path } });
                    setAssets((a) => ({ ...a, stampEmpty: previewUrl }));
                  }}
                />
              </div>
            )}
          </section>

          {/* Champs */}
          <section className={sectionCls}>
            <SectionHeader
              icon={ListOrdered}
              title="Champs de la carte"
              sub="Libellés personnalisés, ordre par glisser-déposer, limites Apple affichées."
            />
            <FieldsSection fields={design.fields} onChange={(fields) => update({ fields })} />
          </section>

          {/* Code-barres */}
          <section className={sectionCls}>
            <SectionHeader
              icon={QrCode}
              title="Code-barres"
              sub="Le code scanné en caisse pour identifier la carte du client."
            />
            <BarcodeSection value={design.barcode} onChange={(barcode) => update({ barcode })} />
          </section>
        </div>

        {/* ── Colonne aperçu (sticky) ──────────────────────────────────────── */}
        <div className="xl:sticky xl:top-6 space-y-5 min-w-0">
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 font-bold text-onyx">
                <Smartphone className="w-4 h-4 text-halo" aria-hidden />
                Aperçu live
              </h2>
              {/* Simulateur : combien de tampons / points a le client fictif */}
              <div className="flex items-center gap-1.5 text-xs text-galet-ink">
                <span>Client fictif :</span>
                <button
                  type="button"
                  onClick={() => setSampleStamps((v) => Math.max(0, v - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-line-warm hover:border-halo"
                  aria-label="Moins de tampons"
                >
                  <Minus className="w-3 h-3" aria-hidden />
                </button>
                <span className="w-5 text-center tabular-nums font-medium text-onyx">
                  {Math.min(sampleStamps, cardType === 'stamps' ? stamps.goal : 99)}
                </span>
                <button
                  type="button"
                  onClick={() => setSampleStamps((v) => Math.min(cardType === 'stamps' ? stamps.goal : 99, v + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-line-warm hover:border-halo"
                  aria-label="Plus de tampons"
                >
                  <Plus className="w-3 h-3" aria-hidden />
                </button>
              </div>
            </div>

            {/* Apple et Google côte à côte (défilement horizontal sur écran étroit) */}
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              <div className="shrink-0 w-[280px] snap-start">
                <p className="text-[11px] uppercase tracking-wide text-galet-ink mb-2"> Apple Wallet</p>
                <AppleWalletPreview design={design} assets={previewAssets} sample={sample} />
              </div>
              <div className="shrink-0 w-[280px] snap-start">
                <p className="text-[11px] uppercase tracking-wide text-galet-ink mb-2">Google Wallet</p>
                <GoogleWalletPreview design={design} assets={previewAssets} sample={sample} />
              </div>
            </div>

            {/* Suivi des tampons */}
            {cardType === 'stamps' && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wide text-galet-ink mb-2">Suivi des tampons</p>
                <div className="rounded-2xl p-4" style={{ background: design.colors.background }}>
                  <StampGrid
                    stamps={stamps}
                    count={Math.min(sampleStamps, stamps.goal)}
                    onBackground={design.colors.foreground}
                    filledUrl={assets.stampFilled}
                    emptyUrl={assets.stampEmpty}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-galet-ink">
                  Grille affichée dans le studio et sur la page client — le pass Wallet affiche le
                  compteur ({'{points}'}) en chiffres.
                </p>
              </div>
            )}
          </div>

          {/* Validation live */}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((msg, i) => (
                <div key={`e${i}`} className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-700 rounded-xl px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                  <span>{msg}</span>
                </div>
              ))}
              {validation.warnings.map((msg, i) => (
                <div key={`w${i}`} className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-xl px-3 py-2 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Retour de sauvegarde / publication */}
          {feedback && (
            <div
              className={`space-y-1.5 rounded-xl px-3 py-2.5 text-sm border ${
                feedback.kind === 'ok'
                  ? 'bg-halo/5 border-halo/30 text-halo'
                  : feedback.kind === 'partial'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                    : 'bg-red-500/10 border-red-500/30 text-red-700'
              }`}
              role="status"
            >
              {feedback.messages.map((msg, i) => (
                <div key={i} className="flex items-start gap-2">
                  {i === 0 &&
                    (feedback.kind === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    ) : feedback.kind === 'partial' ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    ))}
                  <span className={i === 0 ? '' : 'ml-6'}>{msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Barre d'action fixe (studio normal) ─────────────────────────────── */}
      {!express && (
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-40 border-t border-line-warm bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="text-xs text-galet-ink">
            {validation.errors.length > 0 ? (
              <span className="text-red-700 font-medium">
                {validation.errors.length} erreur{validation.errors.length > 1 ? 's' : ''} à corriger avant publication
              </span>
            ) : validation.warnings.length > 0 ? (
              <span className="text-amber-700">
                Publiable — {validation.warnings.length} avertissement{validation.warnings.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-halo font-medium">Prêt à publier ✓</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {published && dirty && (
              <button
                type="button"
                onClick={revertToPublished}
                className="flex items-center gap-1.5 rounded-xl border border-line-warm px-3 py-2.5 text-sm text-galet-ink hover:bg-calcaire transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden />
                Version publiée
              </button>
            )}
            <button
              type="button"
              onClick={saveDraft}
              disabled={savingDraft || publishing || !dirty}
              className="flex items-center gap-2 rounded-xl border border-halo/40 px-4 py-2.5 text-sm font-medium text-halo hover:bg-halo/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
              Enregistrer le brouillon
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={publishing || savingDraft || validation.errors.length > 0}
              className="flex items-center gap-2 rounded-xl bg-halo px-5 py-2.5 text-sm font-semibold text-white hover:bg-halo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CloudUpload className="w-4 h-4" aria-hidden />}
              {version > 0 ? `Publier la version ${version + 1}` : 'Publier ma carte'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ── Barre d'action express : un seul geste, « Valider et continuer ». ── */}
      {express && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-40 border-t border-line-warm bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
            <p
              className={`flex-1 text-xs ${feedback?.kind === 'error' ? 'text-red-700' : 'text-galet-ink'}`}
              role="status"
            >
              {feedback?.kind === 'error'
                ? feedback.messages[0]
                : reward.trim() === ''
                  ? 'Indiquez la récompense pour continuer.'
                  : 'Carte prête à distribuer.'}
            </p>
            <button
              type="button"
              onClick={validateAndContinue}
              disabled={validating || reward.trim() === ''}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-halo px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-halo-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {validating ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              )}
              Valider et continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
