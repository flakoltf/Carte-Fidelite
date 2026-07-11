"use client";

// Étape 1 : profil du commerce (nom, secteur, adresse).

import Link from "next/link";
import { Store, Sparkles, Wand2, ArrowRight, MapPin, Loader2 } from "lucide-react";
import { SECTOR_CHOICES } from "@/lib/signup/onboarding";
import type { SectorDraft } from "@/lib/onboarding/sectorSelection";
import { ErrorBox, inputClass, primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function ProfileStep({ wizard, sectorDraft }: { wizard: OnboardingWizard; sectorDraft: SectorDraft | null }) {
  const { saveProfile, shopName, setShopName, businessType, setBusinessType, address, setAddress, saving, error, setMode } = wizard;
  return (
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
  );
}
