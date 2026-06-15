// Reset du compte démo : repart de zéro (clients/cartes/scans purgés) SANS
// supprimer le marchand ni sa config. La résolution passe par le slug réservé
// et la garde stricte assertDemoMerchant — jamais un autre marchand.

import { assertDemoMerchant } from "./identity";
import { purgeDemoCustomerData, type PurgeResult } from "./purge";
import type { DemoDb } from "./db";
import { DEMO_SLUG } from "./constants";

export interface ResetResult extends PurgeResult {
  merchantId: string;
}

export async function resetDemoMerchant(db: DemoDb): Promise<ResetResult> {
  const { data: merchant } = await db
    .from("merchants")
    .select("id, slug, email, role")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();

  // Triple garde AVANT toute suppression : slug + email réservés, role marchand.
  assertDemoMerchant(merchant);

  const res = await purgeDemoCustomerData(db, merchant.id);
  return { merchantId: merchant.id, ...res };
}
