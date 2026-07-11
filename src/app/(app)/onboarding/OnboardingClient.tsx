"use client";

// Wizard self-service — 5 étapes, sauvegarde-et-reprise, défauts par secteur,
// validation inline, mobile-first. Chaque étape persiste côté serveur
// (/api/onboarding/*) : fermer l'onglet ne perd rien.

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Palette,
  PartyPopper,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stamp,
  Store,
  Footprints,
  ExternalLink,
  Wand2,
  Clock,
  Printer,
} from "lucide-react";
import EnrollmentQR from "@/app/(app)/admin/EnrollmentQR";
import QrPosterButton from "@/components/halo/QrPosterButton";
import type { OnboardingState } from "@/lib/signup/state";
import type { SectorDraft } from "@/lib/onboarding/sectorSelection";
import { SECTOR_CHOICES, PLAN_CHOICES, sectorPreset } from "@/lib/signup/onboarding";
import {
  enrollUrl,
  planPriceDisplay,
  programSummaryLine,
  MARKETING_HOST,
} from "@/lib/onboarding/wizardModel";
import { ErrorBox, inputClass, primaryBtn } from "./_components/onboardingUi";
import { ProgressBar } from "./_components/ProgressBar";
import { OnboardingHeader } from "./_components/OnboardingHeader";
import { useOnboarding } from "./useOnboarding";

// Wrapper client : lit window puis délègue à la logique pure (testée sans DOM).
function enrollUrlFor(slug: string): string {
  if (typeof window === "undefined") return `https://halocard.ch/c/${slug}`;
  return enrollUrl(slug, { hostname: window.location.hostname, origin: window.location.origin });
}

export default function OnboardingClient({
  initialState,
  welcome,
  sectorDraft = null,
}: {
  initialState: OnboardingState;
  welcome: boolean;
  /** Pré-remplissage issu de l'étape 0 « Quel commerce ? » (récompense + couleurs). */
  sectorDraft?: SectorDraft | null;
}) {
  const {
    step, error, saving, mode, conciergeLive,
    shopName, businessType, address, slug,
    preset, isAmountPoints, programType, goal, milestonesText,
    designPublished, checkingDesign,
    plan, cycle, planWarning, liveSlug,
    setMode, setShopName, setBusinessType, setAddress,
    setProgramType, setGoal, setMilestonesText,
    setPlan, setCycle,
    goTo, chooseMode, launchConcierge, saveProfile, saveProgram,
    refreshDesignStatus, savePlan, goLive,
  } = useOnboarding(initialState);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <OnboardingHeader welcome={welcome} liveSlug={liveSlug} mode={mode} conciergeLive={conciergeLive} />

      {/* Barre de progression — wizard autonome uniquement */}
      {!liveSlug && mode === "self" && <ProgressBar step={step} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={liveSlug ? "live" : mode === null ? "fork" : mode === "concierge" ? "concierge" : step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* ── Fork : « Je crée ma carte » / « HALO crée ma carte » ── */}
          {!liveSlug && mode === null && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseMode("concierge")}
                  disabled={saving}
                  className="group rounded-3xl border-2 border-halo bg-surface p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-halo/10 text-halo">
                    <Wand2 className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="mb-1 flex items-center gap-2 font-bold text-onyx">
                    HALO crée ma carte
                    <span className="rounded-full bg-halo/10 px-2.5 py-0.5 text-[11px] font-medium text-halo">
                      Recommandé
                    </span>
                  </span>
                  <span className="block text-sm leading-relaxed text-galet-ink">
                    Dites-nous votre nom et votre métier : votre QR est prêt à imprimer dans
                    2 minutes, et notre équipe dessine votre carte sur-mesure sous 24 h.
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-halo">
                    <Clock className="h-3.5 w-3.5" aria-hidden /> ~2 min, zéro réglage
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => chooseMode("self")}
                  disabled={saving}
                  className="group rounded-3xl border border-line-warm bg-surface p-6 text-left shadow-sm transition-all hover:border-galet hover:shadow-md active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-calcaire text-onyx">
                    <Palette className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="mb-1 block font-bold text-onyx">Je crée ma carte</span>
                  <span className="block text-sm leading-relaxed text-galet-ink">
                    Couleurs, logo, tampons, palier : vous réglez tout vous-même dans le studio,
                    avec aperçu Apple Wallet et Google Wallet en direct.
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-galet-ink">
                    <Clock className="h-3.5 w-3.5" aria-hidden /> ~15 min, contrôle total
                  </span>
                </button>
              </div>

              <ErrorBox message={error} />

              <p className="text-center text-xs text-galet">
                Dans les deux cas : QR imprimable immédiatement, design modifiable à tout moment,
                aucune carte bancaire requise.
              </p>
            </div>
          )}

          {/* ── Parcours concierge : mini-profil puis mise en ligne auto ── */}
          {!liveSlug && mode === "concierge" && (
            <form onSubmit={launchConcierge} className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <Store className="h-4 w-4 text-halo" aria-hidden /> Votre commerce
                </h2>
                <p className="text-xs text-galet-ink">
                  C&apos;est tout ce dont nous avons besoin — notre équipe s&apos;occupe du reste.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="conciergeShopName" className="ml-1 text-sm font-medium text-galet-ink">
                  Nom du commerce
                </label>
                <input
                  id="conciergeShopName"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="organization"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Café du Léman"
                  className={inputClass}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="ml-1 text-sm font-medium text-galet-ink">Secteur d&apos;activité</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SECTOR_CHOICES.map(({ key, preset: p }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setBusinessType(key)}
                      aria-pressed={businessType === key}
                      className={`min-h-11 rounded-2xl border p-3 text-left text-sm transition-all ${
                        businessType === key
                          ? "border-halo bg-halo/[0.06] font-medium text-onyx ring-1 ring-halo/30"
                          : "border-line-warm bg-calcaire text-galet-ink hover:border-galet"
                      }`}
                    >
                      <span className="mr-1.5">{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <label htmlFor="conciergeAddress" className="ml-1 flex items-center gap-1.5 text-sm font-medium text-galet-ink">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Adresse <span className="font-normal text-galet">(facultatif)</span>
                </label>
                <input
                  id="conciergeAddress"
                  maxLength={200}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rue du Rhône 12, 1204 Genève"
                  className={inputClass}
                />
              </div>

              <div className="rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm leading-relaxed text-galet-ink">
                <span className="font-medium text-onyx">Ce qui se passe ensuite :</span> votre carte
                part en ligne immédiatement avec un programme adapté à votre métier
                ({sectorPreset(businessType).rewardExample.toLowerCase()}) et un design provisoire.
                Notre équipe livre votre design sur-mesure sous 24 h ouvrées — les cartes déjà
                installées par vos clients se mettent à jour automatiquement.
              </div>

              <ErrorBox message={error} />

              <button disabled={saving} className={`${primaryBtn} w-full`}>
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Mettre ma carte en ligne <ArrowRight className="h-4 w-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => setMode(null)}
                className="mx-auto block min-h-11 px-2 text-xs text-galet underline-offset-2 hover:text-galet-ink hover:underline"
              >
                ↩ Finalement, je préfère créer ma carte moi-même
              </button>
            </form>
          )}

          {/* ── Étape 1 : profil commerce ── */}
          {!liveSlug && mode === "self" && step === "profile" && (
            <form onSubmit={saveProfile} className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <Store className="h-4 w-4 text-halo" aria-hidden /> Votre commerce
                </h2>
                <p className="text-xs text-galet-ink">
                  Ces informations apparaîtront sur votre carte et votre page d&apos;inscription.
                </p>
              </div>

              {/* Étape 0 « Quel commerce ? » — raccourci de pré-remplissage (additif). */}
              {sectorDraft ? (
                <p className="flex items-center gap-2 rounded-2xl border border-halo/30 bg-halo/[0.05] p-3.5 text-sm text-galet-ink">
                  <Sparkles className="h-4 w-4 shrink-0 text-halo" aria-hidden />
                  <span>
                    Programme et couleurs pré-remplis pour votre secteur —{" "}
                    <span className="font-medium text-onyx">{sectorDraft.rewardLabel.toLowerCase()}</span>.
                    Tout reste modifiable. <Link href="/onboarding/secteur" className="text-halo underline-offset-2 hover:underline">Changer de secteur</Link>
                  </span>
                </p>
              ) : (
                <Link
                  href="/onboarding/secteur"
                  className="flex items-center gap-2 rounded-2xl border border-halo/30 bg-halo/[0.05] p-3.5 text-sm text-galet-ink transition-colors hover:border-halo"
                >
                  <Wand2 className="h-4 w-4 shrink-0 text-halo" aria-hidden />
                  <span className="flex-1">
                    <span className="font-medium text-onyx">Gagnez du temps :</span> choisissez votre type de
                    commerce et tout se pré-remplit.
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-halo" aria-hidden />
                </Link>
              )}

              <div className="space-y-2">
                <label htmlFor="shopName" className="ml-1 text-sm font-medium text-galet-ink">
                  Nom du commerce
                </label>
                <input
                  id="shopName"
                  required
                  minLength={2}
                  maxLength={100}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Café du Léman"
                  className={inputClass}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="ml-1 text-sm font-medium text-galet-ink">Secteur d&apos;activité</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SECTOR_CHOICES.map(({ key, preset: p }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setBusinessType(key)}
                      aria-pressed={businessType === key}
                      className={`rounded-2xl border p-3 text-left text-sm transition-all ${
                        businessType === key
                          ? "border-halo bg-halo/[0.06] font-medium text-onyx ring-1 ring-halo/30"
                          : "border-line-warm bg-calcaire text-galet-ink hover:border-galet"
                      }`}
                    >
                      <span className="mr-1.5">{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="ml-1 text-xs text-galet">
                  Nous préparons des réglages et un design adaptés à votre métier.
                </p>
              </fieldset>

              <div className="space-y-2">
                <label htmlFor="address" className="ml-1 flex items-center gap-1.5 text-sm font-medium text-galet-ink">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Adresse <span className="font-normal text-galet">(facultatif)</span>
                </label>
                <input
                  id="address"
                  maxLength={200}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rue du Rhône 12, 1204 Genève"
                  className={inputClass}
                />
              </div>

              <ErrorBox message={error} />

              <button disabled={saving} className={`${primaryBtn} w-full`}>
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuer <ArrowRight className="h-4 w-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => setMode(null)}
                className="mx-auto block min-h-11 px-2 text-xs text-galet underline-offset-2 hover:text-galet-ink hover:underline"
              >
                ↩ Préférez-vous que notre équipe crée votre carte ?
              </button>
            </form>
          )}

          {/* ── Étape 2 : programme de fidélité ── */}
          {!liveSlug && mode === "self" && step === "program" && (
            <form onSubmit={saveProgram} className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <Sparkles className="h-4 w-4 text-halo" aria-hidden /> Votre programme de fidélité
                </h2>
                <p className="text-xs text-galet-ink">{preset.programHint}</p>
              </div>

              {sectorDraft && !isAmountPoints && (
                <p className="rounded-2xl border border-halo/30 bg-halo/[0.05] p-3.5 text-sm text-galet-ink">
                  <span className="font-medium text-onyx">Récompense suggérée :</span>{" "}
                  {sectorDraft.rewardLabel}. À ajuster à votre convenance ci-dessous.
                </p>
              )}

              {isAmountPoints && (
                <div className="space-y-2 rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm leading-relaxed text-galet-ink">
                  <span className="flex items-center gap-2 font-semibold text-onyx">
                    <Sparkles className="h-4 w-4 text-halo" aria-hidden /> Programme « points par montant »
                  </span>
                  <p>
                    Vos clients cumulent <span className="font-medium text-onyx">1 point par franc dépensé</span>
                    {sectorDraft ? (
                      <>
                        {" "}et reçoivent{" "}
                        <span className="font-medium text-onyx">{sectorDraft.rewardLabel.toLowerCase()}</span>
                      </>
                    ) : null}
                    . Le réglage fin (points par franc, seuil, récompense) se peaufine dans le studio — c&apos;est déjà
                    prêt pour votre secteur.
                  </p>
                </div>
              )}

              {!isAmountPoints && (
                <>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setProgramType("stamp_card")}
                  aria-pressed={programType === "stamp_card"}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    programType === "stamp_card"
                      ? "border-halo bg-halo/[0.06] ring-1 ring-halo/30"
                      : "border-line-warm bg-calcaire hover:border-galet"
                  }`}
                >
                  <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-onyx">
                    <Stamp className="h-4 w-4 text-halo" aria-hidden /> Carte à tampons
                  </span>
                  <span className="text-xs leading-relaxed text-galet-ink">
                    Un tampon par passage, une récompense une fois la carte pleine. Le plus simple à expliquer en caisse.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setProgramType("visit_based")}
                  aria-pressed={programType === "visit_based"}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    programType === "visit_based"
                      ? "border-halo bg-halo/[0.06] ring-1 ring-halo/30"
                      : "border-line-warm bg-calcaire hover:border-galet"
                  }`}
                >
                  <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-onyx">
                    <Footprints className="h-4 w-4 text-halo" aria-hidden /> Paliers de visites
                  </span>
                  <span className="text-xs leading-relaxed text-galet-ink">
                    Plusieurs petites récompenses au fil des visites (ex. à la 3e, 6e et 10e).
                  </span>
                </button>
              </div>

              {programType === "stamp_card" ? (
                <div className="space-y-2">
                  <label className="ml-1 text-sm font-medium text-galet-ink">Nombre de tampons avant récompense</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGoal((g) => Math.max(2, g - 1))}
                      className="h-11 w-11 rounded-2xl border border-line-warm bg-calcaire text-lg font-semibold text-onyx transition-colors hover:border-galet"
                      aria-label="Diminuer l'objectif"
                    >
                      −
                    </button>
                    <span className="min-w-[3rem] text-center font-display text-2xl text-onyx" aria-live="polite">
                      {goal}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGoal((g) => Math.min(30, g + 1))}
                      className="h-11 w-11 rounded-2xl border border-line-warm bg-calcaire text-lg font-semibold text-onyx transition-colors hover:border-galet"
                      aria-label="Augmenter l'objectif"
                    >
                      +
                    </button>
                  </div>
                  <p className="ml-1 text-xs text-galet">
                    Exemple pour votre secteur : {preset.rewardExample.toLowerCase()} ({preset.stampGoal} tampons).
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="milestones" className="ml-1 text-sm font-medium text-galet-ink">
                    Visites récompensées (séparées par des virgules)
                  </label>
                  <input
                    id="milestones"
                    required
                    value={milestonesText}
                    onChange={(e) => setMilestonesText(e.target.value)}
                    placeholder="3, 6, 10"
                    className={inputClass}
                  />
                  <p className="ml-1 text-xs text-galet">
                    Ex. « 3, 6, 10 » : une attention à la 3e visite, une autre à la 6e, la grande récompense à la 10e.
                  </p>
                </div>
              )}
                </>
              )}

              <ErrorBox message={error} />

              <div className="flex gap-3">
                <button type="button" onClick={() => goTo("profile")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
                </button>
                <button disabled={saving} className={`${primaryBtn} flex-1`}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuer <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* ── Étape 3 : design de la carte (handoff studio — territoire A) ── */}
          {!liveSlug && mode === "self" && step === "design" && (
            <div className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <Palette className="h-4 w-4 text-halo" aria-hidden /> Le design de votre carte
                </h2>
                <p className="text-xs leading-relaxed text-galet-ink">
                  Le studio vous propose des modèles adaptés à votre secteur ({preset.label.toLowerCase()}),
                  avec aperçu Apple Wallet et Google Wallet en direct. Couleurs, logo, tampons : tout se règle en quelques clics.
                </p>
              </div>

              {sectorDraft && (
                <div className="flex items-center gap-3 rounded-2xl border border-line-warm bg-calcaire p-3.5">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
                    style={{ backgroundColor: sectorDraft.palette.background, color: sectorDraft.palette.foreground }}
                    aria-hidden
                  >
                    {sectorDraft.stampIcon ?? "★"}
                  </span>
                  <div className="flex-1 text-xs text-galet-ink">
                    <span className="font-medium text-onyx">Couleurs suggérées pour votre secteur</span> — un
                    point de départ que vous pouvez garder ou changer dans le studio.
                    <span className="mt-1.5 flex items-center gap-1.5">
                      {[sectorDraft.palette.background, sectorDraft.palette.label, sectorDraft.palette.foreground].map(
                        (c) => (
                          <span
                            key={c}
                            className="h-4 w-4 rounded-full border border-line-warm"
                            style={{ backgroundColor: c }}
                            aria-hidden
                          />
                        ),
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm text-galet-ink">
                {designPublished ? (
                  <span className="flex items-center gap-2 font-medium text-halo">
                    <Check className="h-4 w-4" aria-hidden /> Votre design est publié — il est magnifique ?
                    Alors continuons.
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-onyx">Bon à savoir :</span> un design par défaut est déjà prêt.
                    Vous pouvez passer cette étape et peaufiner votre carte plus tard, à tout moment.
                  </>
                )}
              </div>

              <a
                href="/dashboard/studio?from=onboarding"
                target="_blank"
                rel="noreferrer"
                className={`${primaryBtn} w-full bg-onyx hover:bg-onyx-soft`}
              >
                Ouvrir le studio de carte <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <p className="text-center text-xs text-galet">
                Le studio s&apos;ouvre dans un nouvel onglet — cette page vous attend.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => goTo("program")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
                </button>
                <button
                  type="button"
                  onClick={refreshDesignStatus}
                  disabled={checkingDesign}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet disabled:opacity-50"
                >
                  {checkingDesign ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                  Vérifier
                </button>
                <button type="button" onClick={() => goTo("plan")} className={`${primaryBtn} flex-1`}>
                  Continuer <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 4 : choix du palier (sans paiement) ── */}
          {!liveSlug && mode === "self" && step === "plan" && (
            <div className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 font-bold text-onyx">Votre palier</h2>
                <p className="text-xs text-galet-ink">
                  Toutes les fonctionnalités sont incluses partout — seul le nombre de cartes actives change.
                  Sans setup, sans engagement.
                </p>
              </div>

              <div className="flex justify-center">
                <div className="inline-flex rounded-2xl border border-line-warm bg-calcaire p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setCycle("monthly")}
                    aria-pressed={cycle === "monthly"}
                    className={`rounded-xl px-4 py-2 transition-colors ${cycle === "monthly" ? "bg-surface font-medium text-onyx shadow-sm" : "text-galet-ink"}`}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setCycle("annual")}
                    aria-pressed={cycle === "annual"}
                    className={`rounded-xl px-4 py-2 transition-colors ${cycle === "annual" ? "bg-surface font-medium text-onyx shadow-sm" : "text-galet-ink"}`}
                  >
                    Annuel <span className="text-halo">· 2 mois offerts</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {PLAN_CHOICES.map((p) => {
                  const price = planPriceDisplay(p.priceChf, cycle);
                  return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setPlan(p.key)}
                    aria-pressed={plan === p.key}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      plan === p.key
                        ? "border-halo bg-halo/[0.06] ring-1 ring-halo/30"
                        : "border-line-warm bg-calcaire hover:border-galet"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-onyx">{p.label}</span>
                    <span className="mt-1 block font-display text-2xl text-onyx">
                      {price.total}
                      <span className="text-sm font-normal text-galet-ink"> CHF/{price.unit}</span>
                    </span>
                    {price.perMonth !== null && (
                      <span className="block text-[11px] text-halo">soit {price.perMonth} CHF/mois</span>
                    )}
                    <span className="mt-2 block text-xs text-galet-ink">jusqu&apos;à {p.cap} cartes actives</span>
                    {p.key === "croissance" && (
                      <span className="mt-2 inline-block rounded-full bg-halo/10 px-2.5 py-0.5 text-[11px] font-medium text-halo">
                        Le plus choisi
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>

              <p className="text-center text-xs text-galet">
                Besoin de plus de 2 000 cartes actives ?{" "}
                <a href="mailto:contact@halocard.ch" className="text-halo hover:underline">Parlons-en</a> — palier sur mesure.
              </p>

              <p className="flex items-center justify-center gap-1.5 rounded-2xl border border-halo/30 bg-halo/[0.05] p-3.5 text-center text-sm font-medium text-halo">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                Aucune carte bancaire requise pendant le lancement.
              </p>

              <ErrorBox message={error} />

              <div className="flex gap-3">
                <button type="button" onClick={() => goTo("design")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
                </button>
                <button type="button" onClick={savePlan} disabled={saving} className={`${primaryBtn} flex-1`}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Choisir {PLAN_CHOICES.find((p) => p.key === plan)?.label} <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 5 : mise en ligne ── */}
          {!liveSlug && mode === "self" && step === "launch" && (
            <div className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <PartyPopper className="h-4 w-4 text-halo" aria-hidden /> Tout est prêt
                </h2>
                <p className="text-xs leading-relaxed text-galet-ink">
                  Un dernier clic : votre page d&apos;inscription devient publique et vos clients pourront
                  ajouter votre carte à leur téléphone.
                </p>
              </div>

              {planWarning && (
                <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-700">{planWarning}</p>
              )}

              <ul className="space-y-2 text-sm text-galet-ink">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-halo" aria-hidden /> {shopName || initialState.shopName} — {preset.label.toLowerCase()}</li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-halo" aria-hidden />
                  {programSummaryLine({ isAmountPoints, programType, goal, milestonesText })}
                </li>
                {sectorDraft && (
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-halo" aria-hidden /> Récompense : {sectorDraft.rewardLabel}
                  </li>
                )}
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-halo" aria-hidden /> Palier {PLAN_CHOICES.find((p) => p.key === plan)?.label} ({cycle === "annual" ? "annuel, 2 mois offerts" : "mensuel"})</li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-halo" aria-hidden />
                  {designPublished ? "Design publié depuis le studio" : "Design par défaut (modifiable à tout moment dans le studio)"}
                </li>
              </ul>

              <ErrorBox message={error} />

              <div className="flex gap-3">
                <button type="button" onClick={() => goTo("plan")} className="inline-flex items-center gap-1.5 rounded-2xl border border-line-warm bg-surface px-5 py-3.5 text-sm font-medium text-galet-ink transition-colors hover:border-galet">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
                </button>
                <button type="button" onClick={goLive} disabled={saving} className={`${primaryBtn} flex-1`}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Mettre ma carte en ligne 🎉</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Succès : carte en ligne ── */}
          {liveSlug && (
            <div className="space-y-6">
              {conciergeLive && (
                <p className="flex items-start gap-2 rounded-2xl border border-halo/30 bg-halo/[0.05] p-4 text-sm leading-relaxed text-galet-ink">
                  <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-halo" aria-hidden />
                  <span>
                    <span className="font-medium text-onyx">Notre équipe personnalise votre carte sous 24 h ouvrées.</span>{" "}
                    Votre QR est définitif : imprimez-le dès maintenant — les cartes installées par
                    vos clients se mettront à jour automatiquement avec le nouveau design.
                  </span>
                </p>
              )}

              <div className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-6 text-center shadow-sm sm:p-8">
                <p className="mb-4 text-sm leading-relaxed text-galet-ink">
                  Vos clients peuvent dès maintenant scanner ce QR pour ajouter votre carte à
                  Apple Wallet ou Google Wallet — sans installer d&apos;application.
                </p>
                <div className="flex justify-center">
                  <EnrollmentQR url={enrollUrlFor(liveSlug)} fileName={`qr-${liveSlug}`} />
                </div>
                <div className="mt-4 flex justify-center">
                  <QrPosterButton
                    url={enrollUrlFor(liveSlug)}
                    shopName={shopName || initialState.shopName}
                    fileName={`affichette-${liveSlug}`}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-bold text-onyx">
                  <Printer className="h-4 w-4 text-halo" aria-hidden /> Déployez en 3 gestes
                </h2>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-galet-ink">
                  <li>Imprimez l&apos;affichette (PDF) et posez-la en caisse, à hauteur des yeux.</li>
                  <li>
                    Testez vous-même :{" "}
                    <a href={enrollUrlFor(liveSlug)} target="_blank" rel="noreferrer" className="text-halo underline-offset-2 hover:underline">
                      ouvrez votre page d&apos;inscription
                    </a>{" "}
                    et ajoutez votre propre carte.
                  </li>
                  <li>Ajoutez le lien à votre profil Instagram et votre fiche Google Business, puis proposez la carte à chaque encaissement : « Elle va direct dans votre téléphone, ça prend 10 secondes. »</li>
                </ol>
              </div>

              <Link href="/dashboard" className={`${primaryBtn} w-full`}>
                Voir mon tableau de bord <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {!liveSlug && mode === "self" && slug && step !== "profile" && (
        <p className="mt-6 text-center text-xs text-galet">
          Votre future page publique : {MARKETING_HOST}/c/{slug}
        </p>
      )}
    </main>
  );
}
