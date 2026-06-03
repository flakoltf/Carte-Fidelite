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
  Layers
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

  const navItems = [
    { name: "Vue d'ensemble", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Clients", icon: Users, href: "/dashboard/customers" },
    { name: "Segments", icon: Layers, href: "/dashboard/segments" },
    { name: "Notifications", icon: Bell, href: "/dashboard/notifications" },
    { name: "Campagnes", icon: Megaphone, href: "/dashboard/campaigns" },
    { name: "Scanner", icon: Scan, href: "/scan" },
    { name: "Paramètres", icon: Settings, href: "/dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-line-warm bg-[#EFEBE1] p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
          <HaloSymbol size={32} className="text-halo" />
          <span className="font-display text-xl tracking-[0.14em]">HALO</span>
        </div>

        <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                            isActive
                            ? "bg-halo text-white"
                            : "text-galet-ink hover:text-onyx hover:bg-[#E9E4D8]"
                        }`}
                    >
                        <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "group-hover:text-onyx"}`} />
                        <span className="font-medium">{item.name}</span>
                        {isActive && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
                    </Link>
                );
            })}
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
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
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
                className="lg:hidden fixed inset-0 bg-calcaire z-40 p-6 pt-24"
            >
                <nav className="space-y-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
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
