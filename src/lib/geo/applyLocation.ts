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

  await supabaseAdmin
    .from("merchants")
    .update({ address: input.address?.trim() ?? null, latitude, longitude })
    .eq("id", merchantId);

  if (latitude != null && longitude != null) {
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

  return { located: latitude != null && longitude != null, latitude, longitude };
}
