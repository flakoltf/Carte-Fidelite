import { redeemReward } from "@/lib/loyalty/redeem";

export const runtime = "nodejs";

// Encaissement « Offrir la récompense » depuis le COMPTOIR (RedeemFullScreen).
// Accepte le payload QR signé OU un UUID. Même logique atomique + audit
// REWARD_REDEEMED + tenancy que /api/redeem (src/lib/loyalty/redeem.ts) :
// un seul chemin, jamais deux implémentations qui divergent.
export const POST = redeemReward;
