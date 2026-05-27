import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/adminAuth";
import DashboardShell from "./DashboardShell";

export const dynamic = "force-dynamic";

// Garde server : non connecté → /login ; admin → /admin (routing role-aware).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, role } = await getSessionRole();
  if (!userId) redirect("/login");
  if (role === "admin") redirect("/admin");
  return <DashboardShell>{children}</DashboardShell>;
}
