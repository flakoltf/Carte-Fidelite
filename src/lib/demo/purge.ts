// Purge du périmètre démo — mirror EXACT de la suppression client RGPD
// (src/app/api/customers/[id]/route.ts), mais scoped au marchand entier :
// wallet_device_registrations + campaign_sends (pas de FK cascade) purgés par
// cartes, puis DELETE customers .eq("merchant_id") → cascade DB vers
// loyalty_cards puis scan_history. Le marchand et sa config restent intacts.

import type { DemoDb } from "./db";

export interface PurgeResult {
  cards: number;
}

export async function purgeDemoCustomerData(db: DemoDb, merchantId: string): Promise<PurgeResult> {
  // Cartes du marchand, capturées AVANT la purge (clés des tables sans cascade).
  const { data: cards } = await db.from("loyalty_cards").select("id").eq("merchant_id", merchantId);
  const cardIds = (cards ?? []).map((c) => c.id);

  if (cardIds.length) {
    await db.from("wallet_device_registrations").delete().in("serial_number", cardIds);
    await db.from("campaign_sends").delete().in("card_id", cardIds);
  }

  // CASCADE : customers → loyalty_cards → scan_history.
  await db.from("customers").delete().eq("merchant_id", merchantId);

  return { cards: cardIds.length };
}
