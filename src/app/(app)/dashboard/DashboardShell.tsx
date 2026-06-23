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
  Megaphone,
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
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { HaloSymbol } from "@/components/halo/HaloMark";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabaseClient = createClient();

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
  type NavItem = { name: string; icon: LucideIcon; href: string; featured?: boolean };
  const navZones: { title: string; items: NavItem[] }[] = [
    {
      title: "Comptoir",
      items: [
        { name: "Scanner", icon: Scan, href: "/scan", featured: true },
        { name: "Vue d'ensemble", icon: LayoutDashboard, href: "/dashboard" },
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
        { name: "Campagnes", icon: Megaphone, href: "/dashboard/campaigns" },
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
    <div className="min-h-screen bg-calcaire text-onyx flex overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-line-warm bg-[#EFEBE1] p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
          <HaloSymbol size={32} className="text-halo" />
          <span className="font-display text-xl tracking-[0.14em]">HALO</span>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto">
            {navZones.map((zone) => (
                <section key={zone.title} aria-label={zone.title} className="space-y-0.5">
                    <h6 className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-galet">
                        {zone.title}
                    </h6>
                    {zone.items.map((item) => {
                        const isActive = isNavActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition-all duration-200 group ${
                                    isActive
                                    ? "bg-halo text-white"
                                    : item.featured
                                    ? "bg-halo/10 text-halo hover:bg-halo/15"
                                    : "text-galet-ink hover:text-onyx hover:bg-[#E9E4D8]"
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
                className="flex items-center gap-3 px-4 py-3 w-full text-galet-ink hover:text-red-600 hover:bg-red-500/10 rounded-2xl transition-all"
            >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Déconnexion</span>
            </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-line-warm bg-calcaire/90 backdrop-blur-md flex items-center justify-between px-6 z-50">
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
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="lg:hidden fixed inset-0 bg-calcaire z-40 p-6 pt-24 overflow-y-auto"
            >
                <nav aria-label="Navigation principale" className="space-y-6 pb-6">
                    {navZones.map((zone) => (
                        <section key={zone.title} aria-label={zone.title} className="space-y-2">
                            <h6 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-galet">
                                {zone.title}
                            </h6>
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
      <main className="flex-1 h-screen overflow-y-auto lg:p-10 pt-24 p-6">
        <div className="max-w-6xl mx-auto">
            {children}
        </div>
      </main>

    </div>
  );
}
