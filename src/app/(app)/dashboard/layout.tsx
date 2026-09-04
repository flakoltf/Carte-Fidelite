import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/adminAuth";
import { readImpersonationCookie } from "@/lib/admin/impersonation";
import DashboardShell from "./DashboardShell";
import ImpersonationBanner from "./ImpersonationBanner";
import TrialBanner from "./TrialBanner";

export const dynamic = "force-dynamic";

// Garde server : non connecté → /login ; admin sans impersonation → /admin (routing role-aware).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, role } = await getSessionRole();
  if (!userId) redirect("/login");
  if (role === "admin") {
    const impersonating = await readImpersonationCookie();
    if (!impersonating) redirect("/admin"); // admin sans impersonation → back-office
  }
  // Colonne = hauteur de la fenêtre (dvh : viewport dynamique mobile, repli
  // 100vh) : bannières + coque remplissent exactement l'écran. Seul <main>
  // défile — le document n'a jamais d'espace mort sous le contenu.
  return (
    <div className="flex h-screen flex-col supports-[height:100dvh]:h-dvh">
      <ImpersonationBanner />
      <TrialBanner />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
