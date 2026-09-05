import { requireAdminPage } from "@/lib/adminAuth";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

// Garde server : redirige les non-admins (→ /dashboard) et les non connectés (→ /login).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  // Colonne = hauteur de la fenêtre (dvh, repli 100vh), comme le dashboard :
  // la coque remplit exactement l'écran, seule <main> défile.
  return (
    <div className="flex h-screen flex-col supports-[height:100dvh]:h-dvh">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
