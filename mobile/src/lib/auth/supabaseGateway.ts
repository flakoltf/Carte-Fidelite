import type { SupabaseClient } from "@supabase/supabase-js";

import { statusAfterPassword, type AuthStatus } from "../authFlow";
import { getSupabase } from "../supabase";
import type { AuthGateway, MerchantProfile } from "./gateway";

// Seule implémentation qui parle vraiment à Supabase. Tout le reste de l'app
// passe par le port `AuthGateway`.
export function createSupabaseAuthGateway(
  supabase: SupabaseClient = getSupabase(),
): AuthGateway {
  async function statusFromLevels(): Promise<AuthStatus> {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return statusAfterPassword(data?.currentLevel, data?.nextLevel);
  }

  return {
    async resolveStatus() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return "signed-out";
      return statusFromLevels();
    },

    async signInWithPassword(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      return statusFromLevels();
    },

    async verifyTotp(code) {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw new Error(listError.message);
      const totp = factors?.totp?.find((factor) => factor.status === "verified");
      if (!totp) throw new Error("no-factor");
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totp.id,
        code: code.trim(),
      });
      if (error) throw new Error(error.message);
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async loadMerchant(): Promise<MerchantProfile | null> {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      const { data } = await supabase
        .from("merchants")
        .select("id, shop_name, role, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) return null;
      return {
        id: String(data.id),
        shopName: data.shop_name ?? null,
        role: data.role ?? null,
        email: data.email ?? null,
      };
    },

    subscribe(onChange) {
      const { data } = supabase.auth.onAuthStateChange(() => onChange());
      return () => data.subscription.unsubscribe();
    },
  };
}
