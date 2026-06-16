// Rotation 1-clic du mot de passe du compte démo de prospection. La résolution
// passe par le slug réservé + la garde stricte assertDemoMerchant (triple garde) :
// JAMAIS un autre marchand ne peut voir son mot de passe réécrit par cette voie.

import crypto from "crypto";
import { assertDemoMerchant, DemoGuardError } from "./identity";
import type { DemoDb } from "./db";
import { DEMO_SLUG } from "./constants";

// Sous-ensemble de supabaseAdmin.auth.admin nécessaire à la rotation — injecté
// en prod (cast) et doublé en test.
export interface RotateAuthAdmin {
  updateUserById(id: string, attrs: { password: string }): Promise<{ error: unknown }>;
}

export interface RotateResult {
  merchantId: string;
  userId: string;
  tempPassword: string;
}

// 12 octets aléatoires → base64url (~16 caractères, sans symboles ambigus pour
// l'URL/saisie). Mêmes garanties que le mot de passe généré au seed.
function genPassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

export async function rotateDemoPassword(
  db: DemoDb,
  authAdmin: RotateAuthAdmin
): Promise<RotateResult> {
  const { data: existing } = await db
    .from("merchants")
    .select("id, slug, email, role, user_id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();

  // Triple garde AVANT tout effet de bord : slug + email réservés (@example.com)
  // + rôle marchand. Un slug squatté par un vrai marchand → DemoGuardError.
  assertDemoMerchant(existing);

  const userId = existing.user_id;
  if (!userId) {
    throw new DemoGuardError("Compte démo sans utilisateur Auth associé", "not_found");
  }

  const tempPassword = genPassword();
  const { error } = await authAdmin.updateUserById(userId, { password: tempPassword });
  if (error) {
    throw new Error("Mise à jour du mot de passe démo échouée");
  }

  return { merchantId: existing.id, userId, tempPassword };
}
