// DÉPRÉCIÉ — ce helper d'infra auth/tenancy a été déplacé vers
// `@/lib/auth/currentMerchant` (son rôle n'a jamais relevé d'« analytics » :
// code smell architectural relevé à l'audit). Ré-export conservé le temps de
// migrer les ~30 appelants ; importer directement depuis @/lib/auth désormais.
export { currentMerchantId, currentMerchantContext, currentOwnMerchantId } from "@/lib/auth/currentMerchant";
export type { MerchantContext } from "@/lib/auth/currentMerchant";
