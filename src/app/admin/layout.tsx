import { requireAdminPage } from "@/lib/adminAuth";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

// Garde server : redirige les non-admins (→ /dashboard) et les non connectés (→ /login).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
