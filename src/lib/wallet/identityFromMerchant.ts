import { normalizeBusinessHours, todaysHoursLabel } from "@/lib/merchant-config/hours";
import type { PassIdentity } from "@/lib/wallet/passJson";
import { reviewUrlFor, shouldShowReview } from "@/lib/wallet/googleReview";

// Construit la couche identité commerce (Feature 1) à partir d'une ligne
// merchants. PUR (now injecté) → garantit que TOUS les chemins d'émission de
// pass (enrôlement, mise à jour via web-service Apple, push) produisent la même
// identité sur la carte, sans duplication de logique.

export interface MerchantIdentityRow {
  reward_label?: string | null;
  address?: string | null;
  phone?: string | null;
  business_hours?: unknown;
  latitude?: number | null;
  longitude?: number | null;
  google_place_id?: string | null;
}

// État dépendant de la carte (pas du marchand) influençant l'identité émise.
export interface IdentityCardState {
  /** La carte est-elle reward-ready à cet instant ? (Feature 2 — lien avis) */
  rewardReady?: boolean;
}

// Lien d'itinéraire : priorité aux coordonnées (précises), sinon l'adresse texte.
export function mapsUrlFor(
  address?: string | null,
  lat?: number | null,
  lng?: number | null
): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address && address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
  }
  return null;
}

export function identityFromMerchant(
  row: MerchantIdentityRow | null | undefined,
  now: Date,
  state: IdentityCardState = {}
): PassIdentity {
  if (!row) return {};
  return {
    rewardLabel: row.reward_label ?? null,
    address: row.address ?? null,
    phone: row.phone ?? null,
    todaysHours: todaysHoursLabel(normalizeBusinessHours(row.business_hours), now),
    mapsUrl: mapsUrlFor(row.address, row.latitude, row.longitude),
    // Lien avis Google : seulement si reward-ready ET place id valide (Feature 2).
    reviewUrl: shouldShowReview(Boolean(state.rewardReady), row.google_place_id)
      ? reviewUrlFor(row.google_place_id)
      : null,
  };
}
