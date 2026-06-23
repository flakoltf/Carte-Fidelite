import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import type { LoyaltyType } from "@/lib/loyalty/types";
import ComptoirScan from "./_components/ComptoirScan";

// ── SEAM E2E (inerte en prod) ──────────────────────────────────────────────
// AFFICHAGE SEULEMENT. Gated `NEXT_PUBLIC_E2E === "1"` — flag jamais posé sur le
// Vercel de prod (cf. leçon Sentry DSN) → en prod ce code est mort et retourne
// toujours `null`. En E2E, `?e2eProgram=amount_points` force la PROP `programType`
// passée à <ComptoirScan> pour tester le pavé CHF sans marchand amount_points
// réel. Ça n'altère JAMAIS la résolution serveur du crédit : /api/scan lit
// toujours le programme réel du marchand (et il est mocké dans les tests).
// cf. e2e/README.md.
export function e2eProgramOverride(raw: string | string[] | undefined): LoyaltyType | null {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "stamp_card" || v === "visit_based" || v === "tiered" || v === "amount_points" ? v : null;
}

// Page Scanner du comptoir (destination du bouton géant de la home). Server
// component : résout le TYPE de programme (pour décider d'afficher le pavé CHF
// sur amount_points) et la récompense en clair (écran « Offrir »). Le
// scan/caméra vit dans <ComptoirScan>.
export default async function ComptoirScanPage({
  searchParams,
}: {
  searchParams: Promise<{ e2eProgram?: string }>;
}) {
  const merchantId = await currentMerchantId();
  let programType: ReturnType<typeof resolveLoyaltyProgram>["type"] = "stamp_card";
  let rewardLabel = "🎁 Récompense offerte";

  if (merchantId) {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("loyalty_type, loyalty_config, stamp_goal, reward_label")
      .eq("id", merchantId)
      .maybeSingle();
    const program = resolveLoyaltyProgram(merchant ?? null);
    programType = program.type;
    // Libellé de récompense : pour amount_points il vit dans la config du
    // programme ; sinon c'est le reward_label du marchand.
    const label =
      program.type === "amount_points"
        ? program.config.rewardLabel?.trim()
        : (merchant?.reward_label as string | null)?.trim();
    if (label) rewardLabel = label;
  }

  // Seam E2E (affichage seul) : override la prop si le flag est actif.
  const { e2eProgram } = await searchParams;
  const override = e2eProgramOverride(e2eProgram);
  if (override) programType = override;

  return <ComptoirScan programType={programType} rewardLabel={rewardLabel} />;
}
