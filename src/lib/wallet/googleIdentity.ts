import type { PassIdentity } from "@/lib/wallet/passJson";

// Modules d'identité commerce pour l'OBJET Google Wallet (Feature 1, carte
// vivante). Pur et testable — fusionné dans le loyaltyObject par googlePass.ts.
//
// Le hero/logo et le nom de programme restent au niveau CLASSE (via le design
// studio + ensureLoyaltyClass). Ici on ne pose que ce qui est propre au commerce
// et/ou variable dans le temps : récompense, horaires du jour, liens d'action.
//
// `tel:` doit être un URI valide : on retire les espaces du numéro.

export interface GoogleIdentityModules {
  textModulesData?: { id: string; header: string; body: string }[];
  linksModuleData?: { uris: { uri: string; description: string; id: string }[] };
}

export function googleIdentityModules(identity?: PassIdentity): GoogleIdentityModules {
  if (!identity) return {};
  const v = (s?: string | null) => (typeof s === "string" && s.trim() ? s.trim() : null);

  const text: { id: string; header: string; body: string }[] = [];
  const reward = v(identity.rewardLabel);
  const hours = v(identity.todaysHours);
  if (reward) text.push({ id: "reward", header: "Récompense", body: reward });
  if (hours) text.push({ id: "hours", header: "Aujourd'hui", body: hours });

  const uris: { uri: string; description: string; id: string }[] = [];
  const review = v(identity.reviewUrl);
  const maps = v(identity.mapsUrl);
  const phone = v(identity.phone);
  // Avis Google en premier (moment magique : récompense débloquée).
  if (review) uris.push({ uri: review, description: "★ Laisser un avis Google", id: "review" });
  if (maps) uris.push({ uri: maps, description: "Itinéraire", id: "maps" });
  if (phone) uris.push({ uri: `tel:${phone.replace(/\s+/g, "")}`, description: "Appeler", id: "phone" });

  const out: GoogleIdentityModules = {};
  if (text.length) out.textModulesData = text;
  if (uris.length) out.linksModuleData = { uris };
  return out;
}
