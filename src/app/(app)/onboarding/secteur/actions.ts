"use server";

// Étape 0 du wizard — actions serveur.
//
// `selectSector` : persiste la mécanique du secteur sur la ligne `merchants`
// (tenancy `.eq("id", merchantId)`, audit MERCHANT_UPDATED existant — pas de
// nouvelle AuditAction), pose le brouillon en cookie HTTP-only, puis redirige
// vers le wizard qui pré-remplit l'étape « programme ».
// `skipSector` : « Personnaliser plus tard » — efface le brouillon, flow vierge.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";
import {
  buildSectorSelection,
  serializeSectorDraft,
  SECTOR_DRAFT_COOKIE,
} from "@/lib/onboarding/sectorSelection";

export type SelectSectorResult = { error: string };

// 30 min : le temps de finir l'onboarding, pas davantage (donnée non sensible).
const DRAFT_MAX_AGE_SECONDS = 60 * 30;

export async function selectSector(sector: string): Promise<SelectSectorResult | void> {
  const selection = buildSectorSelection(sector);
  if (!selection.ok) return { error: selection.error };

  const merchantId = await currentMerchantId();
  if (!merchantId) return { error: "Session expirée. Reconnectez-vous." };

  // Tenancy (invariant n°3) : service-role borné au tenant courant.
  const { error } = await supabaseAdmin
    .from("merchants")
    .update(selection.selection.patch)
    .eq("id", merchantId);
  if (error) {
    console.error("selectSector update error:", error.code, error.message);
    return { error: "Enregistrement impossible. Réessayez." };
  }

  const store = await cookies();
  store.set(SECTOR_DRAFT_COOKIE, serializeSectorDraft(selection.selection.draft), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/onboarding",
    maxAge: DRAFT_MAX_AGE_SECONDS,
  });

  await logAuditEvent({
    action: "MERCHANT_UPDATED",
    merchant_id: merchantId,
    details: { via: "onboarding", step: "secteur", sector: selection.selection.draft.sector },
  });

  redirect("/onboarding");
}

export async function skipSector(): Promise<void> {
  const store = await cookies();
  store.delete(SECTOR_DRAFT_COOKIE);
  redirect("/onboarding");
}
