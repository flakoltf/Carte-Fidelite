"use client";

// Wizard self-service — 5 étapes, sauvegarde-et-reprise, défauts par secteur,
// validation inline, mobile-first. Chaque étape persiste côté serveur
// (/api/onboarding/*) : fermer l'onglet ne perd rien.

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { HaloSymbol } from "@/components/halo/HaloMark";
import EnrollmentQR from "@/app/(app)/admin/EnrollmentQR";
import type { OnboardingState } from "@/lib/signup/state";
import {
  SECTOR_CHOICES,
  PLAN_CHOICES,
  sectorPreset,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from "@/lib/signup/onboarding";

const STEP_LABELS: Record<OnboardingStep, string> = {
  profile: "Votre commerce",
  program: "Votre programme",
  design: "Votre carte",
  plan: "Votre palier",
  launch: "Mise en ligne",
};

const MARKETING_BASE = "https://halocard.ch";

// Même convention que « Ma carte » (dashboard/card) : en dev/preview, le
// domaine vitrine n'existe pas — on reste sur l'origine courante.
function enrollUrlFor(slug: string): string {
  if (typeof window !== "undefined" && !window.location.hostname.endsWith("halocard.ch")) {
    return `${window.location.origin}/c/${slug}`;
  }
  return `${MARKETING_BASE}/c/${slug}`;
}

async function callApi(
  path: string,
  method: string,
  body?: unknown
): Promise<{ ok: boolean; data: Record<string, unknown>; error: string }> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, data, error: typeof data.error === "string" ? data.error : "Une erreur est survenue. Réessayez." };
    }
    return { ok: true, data, error: "" };
  } catch {
    return { ok: false, data: {}, error: "Erreur de connexion. Vérifiez votre réseau et réessayez." };
  }
}

const inputClass =
  "w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 px-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-halo px-6 py-3.5 font-semibold text-white transition-all hover:bg-halo-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100";

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600"
      role="alert"
    >
      {message}
    </motion.div>
  );
}

export default function OnboardingClient({
  initialState,
  welcome,
}: {
  initialState: OnboardingState;
  welcome: boolean;
}) {
  const [step, setStep] = useState<OnboardingStep>(initialState.step);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Étape profil
  const [shopName, setShopName] = useState(initialState.profileFilled ? initialState.shopName : "");
  const [businessType, setBusinessType] = useState(initialState.businessType);
  const [address, setAddress] = useState(initialState.address ?? "");
  const [slug, setSlug] = useState(initialState.slug);

  // Étape programme
  const preset = useMemo(() => sectorPreset(businessType), [businessType]);
  const [programType, setProgramType] = useState<"stamp_card" | "visit_based">(
    initialState.loyaltyType === "visit_based" ? "visit_based" : "stamp_card"
  );
  const [goal, setGoal] = useState(initialState.stampGoal >= 2 && initialState.stampGoal <= 30 ? initialState.stampGoal : preset.stampGoal);
  const [milestonesText, setMilestonesText] = useState(
    initialState.milestones.length > 0 ? initialState.milestones.join(", ") : "3, 6, 10"
  );

  // Étape design
  const [designPublished, setDesignPublished] = useState(initialState.designPublished);
  const [checkingDesign, setCheckingDesign] = useState(false);

  // Étape palier
  const [plan, setPlan] = useState<"essentiel" | "croissance" | "premium">(
    initialState.plan === "custom" ? "essentiel" : initialState.plan
  );
  const [cycle, setCycle] = useState<"monthly" | "annual">(initialState.billingCycle);
  const [planWarning, setPlanWarning] = useState("");

  // Étape mise en ligne
  const [liveSlug, setLiveSlug] = useState<string | null>(null);

  const stepIdx = ONBOARDING_STEPS.indexOf(step);

  function goTo(next: OnboardingStep) {
    setError("");
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await callApi("/api/onboarding/profile", "PATCH", {
      shopName,
      businessType,
      address,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    if (typeof res.data.slug === "string") setSlug(res.data.slug);
    goTo("program");
  }

  async function saveProgram(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body =
      programType === "stamp_card"
        ? { type: "stamp_card", goal }
        : {
            type: "visit_based",
            milestones: milestonesText
              .split(/[,;\s]+/)
              .filter(Boolean)
              .map((s) => Number(s)),
          };
    const res = await callApi("/api/onboarding/program", "PATCH", body);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    goTo("design");
  }

  async function refreshDesignStatus() {
    setCheckingDesign(true);
    const res = await callApi("/api/onboarding", "GET");
    setCheckingDesign(false);
    const state = res.data.state as { designPublished?: boolean } | undefined;
    if (res.ok && state) setDesignPublished(Boolean(state.designPublished));
  }

  async function savePlan() {
    setSaving(true);
    setError("");
    setPlanWarning("");
    const res = await callApi("/api/onboarding/plan", "POST", { plan, cycle });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    // Couture Stripe : si le provider renvoie une URL de paiement, on la suit.
    if (typeof res.data.redirectUrl === "string") {
      window.location.href = res.data.redirectUrl;
      return;
    }
    if (typeof res.data.warning === "string" && res.data.warning) setPlanWarning(res.data.warning);
    goTo("launch");
  }

  async function goLive() {
    setSaving(true);
    setError("");
    const res = await callApi("/api/onboarding/complete", "POST");
    setSaving(false);
    if (!res.ok) return setError(res.error);
    if (typeof res.data.slug === "string") setLiveSlug(res.data.slug);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <HaloSymbol size={36} className="mb-3 text-halo" />
        {welcome && !liveSlug && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-halo/10 px-4 py-1.5 text-xs font-medium text-halo">
            <Check className="h-3.5 w-3.5" aria-hidden /> Adresse confirmée — bienvenue !
          </p>
        )}
        <h1 className="font-display text-2xl text-onyx sm:text-3xl">
          {liveSlug ? "Votre programme est en ligne." : "Mettons votre carte en ligne"}
        </h1>
        {!liveSlug && (
          <p className="mt-1 text-sm text-galet-ink">
            Quelques minutes suffisent — tout est enregistré au fur et à mesure.
          </p>
        )}
      </header>

      {/* Barre de progression */}
      {!liveSlug && (
        <nav aria-label="Progression" className="mb-8">
          <ol className="flex items-center gap-1 sm:gap-2">
            {ONBOARDING_STEPS.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      done ? "bg-halo text-white" : active ? "border-2 border-halo bg-surface text-halo" : "border border-line-warm bg-surface text-galet"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={`hidden text-[11px] sm:block ${active ? "font-medium text-onyx" : "text-galet"}`}>
                    {STEP_LABELS[s]}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-center text-xs font-medium text-galet-ink sm:hidden">
            Étape {stepIdx + 1} / {ONBOARDING_STEPS.length} — {STEP_LABELS[step]}
          </p>
        </nav>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={liveSlug ? "live" : step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* ── Étape 1 : profil commerce ── */}
          {!liveSlug && step === "profile" && (
            <form onSubmit={saveProfile} className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <Store className="h-4 w-4 text-halo" aria-hidden /> Votre commerce
                </h2>
                <p className="text-xs text-galet-ink">
                  Ces informations apparaîtront sur votre carte et votre page d&apos;inscription.
                </p>
              </div>

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
            </form>
          )}

          {/* ── Étape 2 : programme de fidélité ── */}
          {!liveSlug && step === "program" && (
            <form onSubmit={saveProgram} className="space-y-6 rounded-3xl border border-line-warm bg-surface p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-bold text-onyx">
                  <Sparkles className="h-4 w-4 text-halo" aria-hidden /> Votre programme de fidélité
                </h2>
                <p className="text-xs text-galet-ink">{preset.programHint}</p>
              </div>

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
          {!liveSlug && step === "design" && (
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
          {!liveSlug && step === "plan" && (
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
                {PLAN_CHOICES.map((p) => (
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
                      {cycle === "annual" ? p.priceChf * 10 : p.priceChf}
                      <span className="text-sm font-normal text-galet-ink"> CHF/{cycle === "annual" ? "an" : "mois"}</span>
                    </span>
                    {cycle === "annual" && (
                      <span className="block text-[11px] text-halo">soit {Math.round((p.priceChf * 10) / 12)} CHF/mois</span>
                    )}
                    <span className="mt-2 block text-xs text-galet-ink">jusqu&apos;à {p.cap} cartes actives</span>
                    {p.key === "croissance" && (
                      <span className="mt-2 inline-block rounded-full bg-halo/10 px-2.5 py-0.5 text-[11px] font-medium text-halo">
                        Le plus choisi
                      </span>
                    )}
                  </button>
                ))}
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
          {!liveSlug && step === "launch" && (
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
                  {programType === "stamp_card" ? `Carte à tampons — récompense au ${goal}e passage` : `Paliers de visites — ${milestonesText}`}
                </li>
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
              <div className="rounded-3xl border border-halo/30 bg-halo/[0.05] p-6 text-center shadow-sm sm:p-8">
                <p className="mb-4 text-sm leading-relaxed text-galet-ink">
                  Vos clients peuvent dès maintenant scanner ce QR pour ajouter votre carte à
                  Apple Wallet ou Google Wallet — sans installer d&apos;application.
                </p>
                <div className="flex justify-center">
                  <EnrollmentQR url={enrollUrlFor(liveSlug)} fileName={`qr-${liveSlug}`} />
                </div>
              </div>

              <div className="rounded-3xl border border-line-warm bg-surface p-6 shadow-sm">
                <h2 className="mb-2 font-bold text-onyx">Et maintenant ?</h2>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-galet-ink">
                  <li>Téléchargez le QR (PNG) et posez-le en caisse, à hauteur des yeux.</li>
                  <li>Proposez la carte à chaque encaissement : « Elle va direct dans votre téléphone, ça prend 10 secondes. »</li>
                  <li>Suivez vos premières cartes depuis le tableau de bord.</li>
                </ol>
              </div>

              <Link href="/dashboard" className={`${primaryBtn} w-full`}>
                Voir mon tableau de bord <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {!liveSlug && slug && step !== "profile" && (
        <p className="mt-6 text-center text-xs text-galet">
          Votre future page publique : {MARKETING_BASE.replace("https://", "")}/c/{slug}
        </p>
      )}
    </main>
  );
}
