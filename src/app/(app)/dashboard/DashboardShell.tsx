"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Scan,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronRight,
  Layers,
  ShieldAlert,
  CreditCard,
  Palette,
  History,
  Gem,
  type LucideIcon
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { HaloSymbol } from "@/components/halo/HaloMark";
import { EASE_DRAWER } from "@/lib/motion";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabaseClient = createClient();

  // Ferme le menu mobile à chaque navigation (y compris liens internes, retour
  // navigateur) — pas seulement au clic d'item, qui ne couvrait pas tous les cas.
  // Pattern React officiel « ajuster l'état pendant le rendu » (pas d'effet → pas
  // de rendu en cascade) : on mémorise le chemin précédent dans un état.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  }

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/login");
  };

  // Actif si la route courante est la page ou une sous-page (P2 audit UX :
  // l'exact-match laissait /dashboard/customers/xyz sans état actif).
  const isNavActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");

  // UXP-1 : 12 items à plat → 5 zones cohérentes pour un commerçant. Moins de
  // charge cognitive, le Comptoir (scan) toujours en tête et mis en avant.
  // Pas d'accordéon (un tap de plus = friction) : 5 sections compactes ouvertes.
  // La 1re zone garde son aria-label « Comptoir » mais n'affiche pas de titre :
  // l'item d'accueil s'appelle lui-même « Comptoir » (ex-« Vue d'ensemble »),
  // un intitulé répété deux fois de suite ne guiderait personne.
  type NavItem = { name: string; icon: LucideIcon; href: string; featured?: boolean };
  const navZones: { title: string; showTitle?: boolean; items: NavItem[] }[] = [
    {
      title: "Comptoir",
      showTitle: false,
      items: [
        { name: "Scanner", icon: Scan, href: "/dashboard/scan", featured: true },
        { name: "Comptoir", icon: LayoutDashboard, href: "/dashboard" },
      ],
    },
    {
      title: "Ma carte",
      items: [
        { name: "Ma carte", icon: CreditCard, href: "/dashboard/card" },
        { name: "Studio de carte", icon: Palette, href: "/dashboard/studio" },
      ],
    },
    {
      title: "Clients",
      items: [
        { name: "Clients", icon: Users, href: "/dashboard/customers" },
        { name: "Groupes", icon: Layers, href: "/dashboard/segments" },
      ],
    },
    {
      title: "Marketing",
      items: [
        { name: "Messages clients", icon: Bell, href: "/dashboard/notifications" },
      ],
    },
    {
      title: "Réglages",
      items: [
        { name: "Abonnement", icon: Gem, href: "/dashboard/subscription" },
        { name: "Sécurité", icon: ShieldAlert, href: "/dashboard/security" },
        { name: "Paramètres", icon: Settings, href: "/dashboard/settings" },
        { name: "Activité", icon: History, href: "/dashboard/activity" },
      ],
    },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-calcaire text-onyx lg:flex-row">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-line-warm bg-sidebar p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
          <HaloSymbol size={32} className="text-halo" />
          <span className="font-display text-xl tracking-[0.14em]">HALO</span>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto">
            {navZones.map((zone) => (
                <section key={zone.title} aria-label={zone.title} className="space-y-0.5">
                    {zone.showTitle !== false && (
                      <h6 className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-galet-ink">
                          {zone.title}
                      </h6>
                    )}
                    {zone.items.map((item) => {
                        const isActive = isNavActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition duration-200 ease-[var(--ease-out)] group ${
                                    isActive
                                    ? "bg-halo text-white"
                                    : item.featured
                                    ? "bg-halo/10 text-halo hover:bg-halo/15"
                                    : "text-galet-ink hover:text-onyx hover:bg-sidebar-hover"
                                }`}
                            >
                                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-white" : item.featured ? "text-halo" : "group-hover:text-onyx"}`} />
                                <span className={item.featured ? "font-bold" : "font-medium"}>{item.name}</span>
                                {isActive && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
                            </Link>
                        );
                    })}
                </section>
            ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-line-warm">
            <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 w-full text-galet-ink hover:text-red-600 hover:bg-red-500/10 rounded-2xl transition"
            >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Déconnexion</span>
            </button>
        </div>
      </aside>

      {/* Mobile Header — dans le flux (sous les bannières), plus en `fixed` :
          une position fixe recouvrait la bannière d'essai et forçait un
          `pt-24` sur <main>. `z-[60]` : reste au-dessus du menu (z-50). */}
      <div className="lg:hidden relative z-[60] flex h-16 shrink-0 items-center justify-between border-b border-line-warm bg-calcaire px-6">
        <div className="flex items-center gap-2">
            <HaloSymbol size={22} className="text-halo" />
            <span className="font-display tracking-[0.12em]">HALO</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isMobileMenuOpen}
          className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-calcaire"
        >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
            <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: EASE_DRAWER }}
                className="lg:hidden absolute inset-0 bg-calcaire z-50 p-6 pt-24 overflow-y-auto"
            >
                <nav aria-label="Navigation principale" className="space-y-6 pb-6">
                    {navZones.map((zone) => (
                        <section key={zone.title} aria-label={zone.title} className="space-y-2">
                            {zone.showTitle !== false && (
                              <h6 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-galet-ink">
                                  {zone.title}
                              </h6>
                            )}
                            {zone.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={isNavActive(item.href) ? "page" : undefined}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center justify-between px-4 py-3.5 border rounded-2xl ${
                                        item.featured ? "bg-halo/10 border-halo/20" : "bg-surface border-line-warm"
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <item.icon className="w-6 h-6 text-halo" />
                                        <span className={`text-lg ${item.featured ? "font-bold text-halo" : "font-medium"}`}>{item.name}</span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-galet" />
                                </Link>
                            ))}
                        </section>
                    ))}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 px-4 py-4 w-full bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600"
                    >
                        <LogOut className="w-6 h-6" />
                        <span className="text-lg font-medium">Déconnexion</span>
                    </button>
                </nav>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {/* `relative` : les éléments en position absolue du contenu (inputs fichier
          `sr-only` du Studio…) restent DANS ce conteneur de défilement au lieu
          d'allonger le document. `bg-calcaire` : le rebond (overscroll) montre
          le fond du thème, jamais celui du body. */}
      <main className="relative min-h-0 flex-1 overflow-y-auto bg-calcaire p-6 lg:p-10">
        <div className="max-w-6xl mx-auto">
            {children}
        </div>
      </main>

    </div>
  );
}
