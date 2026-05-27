import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
export async function requireAdminApi(): Promise<NextResponse | null> {
  const { userId, role } = await getSessionRole();
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (role !== "admin")
    return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
  return null;
}
