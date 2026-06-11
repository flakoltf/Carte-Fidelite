import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/adminAuth";
import { readImpersonationCookie } from "@/lib/admin/impersonation";

export const dynamic = "force-dynamic";

// Garde server du wizard self-service : non connecté → /login ; admin sans
// impersonation → /admin (un admin peut prévisualiser le wizard en mode
// concierge via l'impersonation, comme le dashboard). Un utilisateur sans
// ligne merchants (provisioning à re-tenter) PASSE : la page self-heal.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { userId, role } = await getSessionRole();
  if (!userId) redirect("/login");
  if (role === "admin") {
    const impersonating = await readImpersonationCookie();
    if (!impersonating) redirect("/admin");
  }
  return <div className="min-h-screen bg-calcaire text-onyx">{children}</div>;
}
