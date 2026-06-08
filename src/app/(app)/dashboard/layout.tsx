import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/adminAuth";
import { readImpersonationCookie } from "@/lib/admin/impersonation";
import DashboardShell from "./DashboardShell";
import ImpersonationBanner from "./ImpersonationBanner";

export const dynamic = "force-dynamic";

// Garde server : non connecté → /login ; admin sans impersonation → /admin (routing role-aware).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, role } = await getSessionRole();
  if (!userId) redirect("/login");
  if (role === "admin") {
    const impersonating = await readImpersonationCookie();
    if (!impersonating) redirect("/admin"); // admin sans impersonation → back-office
  }
  return (
    <>
      <ImpersonationBanner />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
