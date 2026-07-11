"use client";

// État + actions du wizard d'onboarding, extraits d'OnboardingClient.
// Chaque action persiste côté serveur (/api/onboarding/*) : fermer l'onglet
// ne perd rien. Le composant et ses sous-composants consomment ce hook.

import { useMemo, useState } from "react";
import { sectorPreset, type OnboardingStep, type SetupMode } from "@/lib/signup/onboarding";
import { parseMilestones } from "@/lib/onboarding/wizardModel";
import type { OnboardingState } from "@/lib/signup/state";

async function callApi(
  path: string,
  method: string,
  body?: unknown,
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

export function useOnboarding(initialState: OnboardingState) {
  const [step, setStep] = useState<OnboardingStep>(initialState.step);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Fork de parcours : null tant que le marchand n'a pas choisi.
  const [mode, setMode] = useState<SetupMode | null>(initialState.setupMode);
  const [conciergeLive, setConciergeLive] = useState(false);

  // Étape profil
  const [shopName, setShopName] = useState(initialState.profileFilled ? initialState.shopName : "");
  const [businessType, setBusinessType] = useState(initialState.businessType);
  const [address, setAddress] = useState(initialState.address ?? "");
  const [slug, setSlug] = useState(initialState.slug);

  // Étape programme
  const preset = useMemo(() => sectorPreset(businessType), [businessType]);
  // « Points par montant » : programme déjà configuré par l'étape 0 (secteur
  // restaurant/boutique). Le wizard ne propose ici que tampons/visites — on
  // affiche donc un récapitulatif en lecture seule et on NE ré-enregistre PAS
  // (sinon on écraserait la config amount_points par un stamp_card).
  const isAmountPoints = initialState.loyaltyType === "amount_points";
  const [programType, setProgramType] = useState<"stamp_card" | "visit_based">(
    initialState.loyaltyType === "visit_based" ? "visit_based" : "stamp_card",
  );
  const [goal, setGoal] = useState(
    initialState.stampGoal >= 2 && initialState.stampGoal <= 30 ? initialState.stampGoal : preset.stampGoal,
  );
  const [milestonesText, setMilestonesText] = useState(
    initialState.milestones.length > 0 ? initialState.milestones.join(", ") : "3, 6, 10",
  );

  // Étape design
  const [designPublished, setDesignPublished] = useState(initialState.designPublished);
  const [checkingDesign, setCheckingDesign] = useState(false);

  // Étape palier
  const [plan, setPlan] = useState<"essentiel" | "croissance" | "premium">(
    initialState.plan === "custom" ? "essentiel" : initialState.plan,
  );
  const [cycle, setCycle] = useState<"monthly" | "annual">(initialState.billingCycle);
  const [planWarning, setPlanWarning] = useState("");

  // Étape mise en ligne
  const [liveSlug, setLiveSlug] = useState<string | null>(null);

  function goTo(next: OnboardingStep) {
    setError("");
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function chooseMode(next: SetupMode) {
    setSaving(true);
    setError("");
    const res = await callApi("/api/onboarding/mode", "POST", { mode: next });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setMode(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function launchConcierge(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await callApi("/api/onboarding/concierge", "POST", { shopName, businessType, address });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    if (typeof res.data.slug === "string") {
      setConciergeLive(true);
      setLiveSlug(res.data.slug);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await callApi("/api/onboarding/profile", "PATCH", { shopName, businessType, address });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    if (typeof res.data.slug === "string") setSlug(res.data.slug);
    goTo("program");
  }

  async function saveProgram(e: React.FormEvent) {
    e.preventDefault();
    // amount_points : déjà persisté à l'étape 0, le wizard ne le ré-enregistre pas.
    if (isAmountPoints) {
      goTo("design");
      return;
    }
    setSaving(true);
    setError("");
    const body =
      programType === "stamp_card"
        ? { type: "stamp_card", goal }
        : { type: "visit_based", milestones: parseMilestones(milestonesText) };
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

  return {
    // état
    step, error, saving, mode, conciergeLive,
    shopName, businessType, address, slug,
    preset, isAmountPoints, programType, goal, milestonesText,
    designPublished, checkingDesign,
    plan, cycle, planWarning, liveSlug,
    // setters exposés à l'UI
    setMode, setShopName, setBusinessType, setAddress,
    setProgramType, setGoal, setMilestonesText,
    setPlan, setCycle,
    // actions
    goTo, chooseMode, launchConcierge, saveProfile, saveProgram,
    refreshDesignStatus, savePlan, goLive,
  };
}

export type OnboardingWizard = ReturnType<typeof useOnboarding>;
