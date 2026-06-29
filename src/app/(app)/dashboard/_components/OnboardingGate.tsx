"use client";

// Aiguillage de l'accueil marchand (OE-3) : décide, côté client, entre le guidage
// Express plein écran et l'accueil Comptoir. Le serveur (dashboard/page.tsx)
// fournit la part « base de données » (premier passage + état des étapes) ; ce
// composant y ajoute le signal local « guide masqué » via useSyncExternalStore.
//
// Règle CHEF : le plein écran est RÉSERVÉ aux comptes réellement non configurés
// (mécanique OU récompense manquante). Dès que `loyalty_type` ET `reward_label`
// sont posés, on va DIRECT au Comptoir — même si le compte a moins de 24 h — et
// l'on se contente, tant qu'aucune carte n'est distribuée, d'un petit bandeau
// non bloquant « Distribuez votre QR ».

import { useSyncExternalStore } from "react";
import ComptoirHome from "./ComptoirHome";
import ExpressOnboarding from "./ExpressOnboarding";
import ComptoirDistributeBanner from "./ComptoirDistributeBanner";
import { onboardingDismissedStore } from "./onboardingExpressStore";

export interface OnboardingGateProps {
  /** Premier passage détecté en base (`isFirstRunMerchant`). */
  isFirstRun: boolean;
  shopName: string;
  logoUrl?: string | null;
  /** Étape 1 faite — `merchants.loyalty_type` posé. */
  sectorConfirmed: boolean;
  /** Étape 2 faite — `merchants.reward_label` posé. */
  cardPersonalized: boolean;
  /** Étape 3 — nombre de cartes distribuées (clients enrôlés). */
  cardsCount: number;
}

export default function OnboardingGate({
  isFirstRun,
  shopName,
  logoUrl,
  sectorConfirmed,
  cardPersonalized,
  cardsCount,
}: OnboardingGateProps) {
  const dismissed = useSyncExternalStore(
    onboardingDismissedStore.subscribe,
    onboardingDismissedStore.read,
    () => false
  );

  // Carte configurée = mécanique ET récompense posées. C'est le verrou CHEF :
  // configurée ⇒ jamais de plein écran.
  const configured = sectorConfirmed && cardPersonalized;

  if (isFirstRun && !dismissed && !configured) {
    return (
      <ExpressOnboarding
        shopName={shopName}
        sectorConfirmed={sectorConfirmed}
        cardPersonalized={cardPersonalized}
        cardsCount={cardsCount}
      />
    );
  }

  // Comptoir. Rappel doux « distribuez votre QR » tant que, fraîchement
  // configuré, aucune carte n'a encore été distribuée.
  const showDistributeBanner = isFirstRun && configured && cardsCount === 0;

  return (
    <ComptoirHome
      shopName={shopName}
      logoUrl={logoUrl}
      banner={showDistributeBanner ? <ComptoirDistributeBanner /> : undefined}
    />
  );
}
