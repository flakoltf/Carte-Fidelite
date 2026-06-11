"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Inbox,
  Banknote,
  Wallet,
  Activity,
  ShieldCheck,
  Palette,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { HaloSymbol } from "@/components/halo/HaloMark";

// Navigation dense mais groupée — le centre de commandement du fondateur.
const navGroups = [
  {
    label: "Pilotage",
    items: [{ name: "Vue d'ensemble", icon: LayoutDashboard, href: "/admin" }],
  },
  {
    label: "Marchands",
    items: [{ name: "Marchands", icon: Store, href: "/admin/merchants" }],
  },
  {
    label: "Croissance",
    items: [{ name: "Leads & pipeline", icon: Inbox, href: "/admin/leads" }],
  },
  {
    label: "Facturation",
    items: [{ name: "Abonnements", icon: Banknote, href: "/admin/billing" }],
  },
  {
    label: "Système",
    items: [
      { name: "Opérations Wallet", icon: Wallet, href: "/admin/wallet" },
      { name: "Santé technique", icon: Activity, href: "/admin/system" },
      { name: "Audit & sécurité", icon: ShieldCheck, href: "/admin/audit" },
      { name: "Templates & contenu", icon: Palette, href: "/admin/templates" },
      { name: "Réglages plateforme", icon: Settings, href: "/admin/settings" },
    ],
  },
];

const navItems = navGroups.flatMap((g) => g.items);

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-line-warm bg-surface p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
          <HaloSymbol size={32} className="text-halo" />
          <span className="font-display text-xl tracking-[0.14em]">HALO</span>
          <span className="ml-1 text-[11px] font-semibold bg-halo/10 text-halo border border-halo/20 rounded-full px-2 py-0.5 leading-none">Admin</span>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-galet">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-200 group ${
                      isActive(item.href)
                        ? "bg-halo/10 text-halo border border-halo/20"
                        : "text-galet-ink hover:text-onyx hover:bg-calcaire"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-line-warm">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-galet-ink hover:text-red-600 hover:bg-red-500/10 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Header mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-line-warm bg-calcaire/90 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <HaloSymbol size={22} className="text-halo" />
          <span className="font-display tracking-[0.12em]">HALO</span>
          <span className="text-[10px] font-semibold bg-halo/10 text-halo border border-halo/20 rounded-full px-1.5 py-0.5 leading-none">Admin</span>
        </div>
        <button onClick={() => setOpen(!open)}>{open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="lg:hidden fixed inset-0 bg-calcaire z-40 p-6 pt-24"
          >
            <nav className="space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-4 bg-surface border border-line-warm rounded-2xl"
                >
                  <div className="flex items-center gap-4">
                    <item.icon className="w-6 h-6 text-halo" />
                    <span className="text-lg font-medium">{item.name}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-galet" />
                </Link>
              ))}
              <button
                onClick={logout}
                className="flex items-center gap-4 px-4 py-4 w-full bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600"
              >
                <LogOut className="w-6 h-6" />
                <span className="text-lg font-medium">Déconnexion</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 h-screen overflow-y-auto lg:p-10 pt-24 p-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
