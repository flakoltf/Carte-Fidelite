import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { mfaStepUpRequired } from "@/lib/auth/mfa";

export type Role = "admin" | "merchant" | null;

// Lit l'utilisateur courant et son rôle via le client RLS server (il lit sa propre
// ligne merchants, autorisée par la policy auth.uid() = user_id).
export async function getSessionRole(): Promise<{ userId: string | null; role: Role }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, role: null };

  const { data: merchant } = await supabase
    .from("merchants")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return { userId: user.id, role: (merchant?.role as Role) ?? null };
}

// Garde pour les pages server admin : redirige les non-admins.
export async function requireAdminPage(): Promise<{ userId: string }> {
  const { userId, role } = await getSessionRole();
  if (!userId) redirect("/login");
  if (role !== "admin") redirect("/dashboard");
  return { userId: userId as string };
}

// Garde pour les routes API admin : renvoie 401/403 si non-admin, sinon null.
// SEC-MFA-API : le proxy n'impose le step-up MFA que sur les *pages* (chemins
// commençant par /admin, /dashboard…). Les routes /api/admin/* ne passent pas
// par `isProtected` → un admin en aal1 (mot de passe seul) pourrait appeler des
// opérations destructrices (reset-password, rotate-token, suspension,
// impersonate) sans 2e facteur. On refait donc le contrôle AAL ici, fail-closed
// (niveau MFA invérifiable = refus), pour fermer le contournement par l'API.
export async function requireAdminApi(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: merchant } = await supabase
    .from("merchants")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if ((merchant?.role as Role) !== "admin")
    return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });

  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaStepUpRequired(aal?.currentLevel, aal?.nextLevel))
      return NextResponse.json(
        { error: "Vérification en deux étapes requise", code: "mfa_required" },
        { status: 403 },
      );
  } catch {
    return NextResponse.json(
      { error: "Niveau d'authentification invérifiable" },
      { status: 403 },
    );
  }
  return null;
}
