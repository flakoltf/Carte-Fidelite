import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { walletAccessToken } from "@/lib/wallet/googleClass";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { loadDesign } from "@/lib/cardDesign/repository";
import { mapToGoogleObjectExtras } from "@/lib/cardDesign/mapGoogle";

// Mise à jour des OBJETS Google Wallet après un scan / une campagne (le pendant
// Google du push APNs) : Google n'a pas de mécanique pull comme le web service
// Apple — l'état affiché vit DANS l'objet, on le pousse donc par PATCH.
//
// Invariant n°2 : JAMAIS d'UPDATE/PUT (un UPDATE efface les champs omis).
// On parle à l'API REST en fetch nu — le verbe PATCH est explicite et vérifié
// au payload près par les tests. Attention : `loyaltyPoints` est remplacé en
// bloc par le PATCH (la fusion joue entre champs de PREMIER niveau), d'où le
// `label` toujours renvoyé avec le solde, comme à l'émission (googlePass.ts).
//
// Best-effort par conception (mêmes garanties qu'AppleChannel) : un échec —
// carte, réseau ou auth — ne casse jamais le scan ; 404 = objet jamais installé
// côté Google → ignoré silencieusement.

const OBJECT_ENDPOINT = "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject";

/**
 * Id d'objet déterministe `${GOOGLE_ISSUER_ID}.${cardId}` — MÊME règle de
 * sanitisation qu'à l'émission (buildGoogleSaveUrl) : Google Wallet refuse les
 * tirets dans l'id d'objet.
 */
export function objectIdFor(cardId: string): string {
  return `${process.env.GOOGLE_ISSUER_ID}.${cardId.replace(/-/g, "_")}`;
}

export interface GoogleObjectPatch {
  loyaltyPoints: { balance: { int: number }; label: string };
  messages?: { id: string; header: string; body: string; messageType: string }[];
}

export type PatchOutcome = "patched" | "missing";

/** PATCH d'un loyaltyObject. 404 → "missing" (carte jamais installée côté Google). */
export async function patchLoyaltyObject(
  objectId: string,
  patch: GoogleObjectPatch,
): Promise<PatchOutcome> {
  const token = await walletAccessToken();
  const res = await fetch(`${OBJECT_ENDPOINT}/${encodeURIComponent(objectId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.status === 404) return "missing";
  if (!res.ok) throw new Error(`loyaltyobject.patch ${objectId} → HTTP ${res.status}`);
  return "patched";
}

/**
 * Pousse l'état courant des cartes vers leurs objets Google Wallet.
 * Solde affiché : même règle qu'à l'émission (googlePass.ts) — points_balance
 * pour un programme à POINTS, stamps_count (compteur générique) sinon.
 * `message` (campagne / récompense) → `messages` de l'objet, TEXT_AND_NOTIFY
 * pour déclencher la notification Android (fréquence plafonnée par Google).
 */
export async function pushGoogleObjectUpdates(
  cardIds: string[],
  message?: { title: string; body: string },
): Promise<{ pushed: number }> {
  if (!cardIds.length || !process.env.GOOGLE_ISSUER_ID) return { pushed: 0 };

  const { data: cards } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id, merchant_id, stamps_count, points_balance")
    .in("id", cardIds);
  if (!cards?.length) return { pushed: 0 };

  // Programme + label résolus UNE fois par marchand (batch campagne = n cartes
  // d'un même commerce).
  const merchantCache = new Map<string, { isPoints: boolean; pointsLabel: string }>();
  const merchantInfo = async (merchantId: string) => {
    const cached = merchantCache.get(merchantId);
    if (cached) return cached;
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("loyalty_type, loyalty_config, stamp_goal")
      .eq("id", merchantId)
      .single();
    const program = resolveLoyaltyProgram(mRow);
    // Repli identique à l'émission : design illisible → label historique.
    let pointsLabel = "Tampons";
    try {
      pointsLabel = mapToGoogleObjectExtras(await loadDesign(supabaseAdmin, merchantId)).pointsLabel;
    } catch {}
    const info = { isPoints: program.type === "points", pointsLabel };
    merchantCache.set(merchantId, info);
    return info;
  };

  let pushed = 0;
  for (const card of cards) {
    try {
      const info = await merchantInfo(card.merchant_id as string);
      const balance = info.isPoints
        ? ((card.points_balance as number | null) ?? 0)
        : ((card.stamps_count as number | null) ?? 0);
      const patch: GoogleObjectPatch = {
        loyaltyPoints: { balance: { int: balance }, label: info.pointsLabel },
      };
      if (message) {
        patch.messages = [
          { id: "halocard", header: message.title, body: message.body, messageType: "TEXT_AND_NOTIFY" },
        ];
      }
      const outcome = await patchLoyaltyObject(objectIdFor(card.id as string), patch);
      if (outcome === "patched") pushed += 1;
    } catch (e) {
      console.error(
        `[googleObject] patch de la carte ${card.id} a échoué:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return { pushed };
}
