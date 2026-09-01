import { redirect } from "next/navigation";

// Fusion « Campagnes » → « Messages clients » (2026-09-01) : une seule page
// pour écrire aux clients (immédiat, programmé, récurrent). La route est
// conservée pour ne casser ni les favoris ni les anciens liens.
export default function CampaignsPage() {
  redirect("/dashboard/notifications");
}
