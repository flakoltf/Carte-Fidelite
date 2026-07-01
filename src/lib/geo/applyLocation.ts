import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { geocodeAddress, isValidLatLng } from "./geocode";

export type ApplyLocationInput = { address?: string; latitude?: number; longitude?: number };
export type ApplyLocationResult = { located: boolean; latitude: number | null; longitude: number | null };

// Résout les coordonnées (manuelles valides prioritaires, sinon géocodage de l'adresse),
// persiste address/latitude/longitude, puis rafraîchit les pass existants (best-effort).
export async function applyMerchantLocation(merchantId: string, input: ApplyLocationInput): Promise<ApplyLocationResult> {
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (typeof input.latitude === "number" && typeof input.longitude === "number" && isValidLatLng(input.latitude, input.longitude)) {
    latitude = input.latitude;
    longitude = input.longitude;
  } else if (input.address && input.address.trim()) {
    const coords = await geocodeAddress(input.address.trim());
    if (coords) { latitude = coords.latitude; longitude = coords.longitude; }
  }

  const located = latitude != null && longitude != null;

  // L'adresse est toujours persistée. Les coordonnées NE sont écrites QUE si la
  // résolution a réussi : un géocodage en échec ne doit jamais écraser des
  // coordonnées valides déjà en base (ni les remettre à null par erreur).
  const patch: Record<string, unknown> = { address: input.address?.trim() ?? null };
  if (located) {
    patch.latitude = latitude;
    patch.longitude = longitude;
  }

  await supabaseAdmin
    .from("merchants")
    .update(patch)
    .eq("id", merchantId);

  if (located) {
    try {
      const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("id").eq("merchant_id", merchantId);
      const cardIds = (cards ?? []).map((c) => c.id as string);
      if (cardIds.length) {
        const { getChannels } = await import("@/lib/wallet/channel");
        for (const ch of getChannels()) await ch.notify(cardIds);
      }
    } catch (e) {
      console.error("[location] refresh push failed:", e);
    }
  }

  return { located, latitude, longitude };
}
