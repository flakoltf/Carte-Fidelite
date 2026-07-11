"use client";

// Parcours concierge : mini-profil puis mise en ligne automatique.

import { Store, MapPin, Loader2, ArrowRight } from "lucide-react";
import { SECTOR_CHOICES, sectorPreset } from "@/lib/signup/onboarding";
import { ErrorBox, inputClass, primaryBtn } from "./onboardingUi";
import type { OnboardingWizard } from "../useOnboarding";

export function ConciergeForm({ wizard }: { wizard: OnboardingWizard }) {
  const { launchConcierge, shopName, setShopName, businessType, setBusinessType, address, setAddress, saving, error, setMode } = wizard;
  return (
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
  );
}
