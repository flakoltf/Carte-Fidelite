import { redeemReward } from "@/lib/loyalty/redeem";

export const runtime = "nodejs";

// Encaissement « récompense » depuis la fiche Clients (UUID brut). Logique
// partagée — voir src/lib/loyalty/redeem.ts. /api/scan/redeem (comptoir) pointe
// sur le MÊME chemin atomique + audité.
export const POST = redeemReward;
