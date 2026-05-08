"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Scan, 
  PlusCircle, 
  LogOut, 
  Wallet,
  Menu,
  X,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    { name: "Générer Carte", icon: PlusCircle, href: "/dashboard/generate" },
    { name: "Scanner", icon: Scan, href: "/scan" },
    { name: "Paramètres", icon: Settings, href: "/dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-zinc-900 bg-zinc-950 p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="text-emerald-400 w-5 h-5" />
            </div>
            <span className="text-xl font-bold italic tracking-tight">WalletCard</span>
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
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                        }`}
                    >
                        <item.icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "group-hover:text-white"}`} />
                        <span className="font-medium">{item.name}</span>
                        {isActive && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </Link>
                );
            })}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-900">
            <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all"
            >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Déconnexion</span>
            </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
            <Wallet className="text-emerald-400 w-5 h-5" />
            <span className="font-bold italic">WalletCard</span>
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
                className="lg:hidden fixed inset-0 bg-zinc-950 z-40 p-6 pt-24"
            >
                <nav className="space-y-4">
                    {navItems.map((item) => (
                        <Link 
                            key={item.href} 
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between px-4 py-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl"
                        >
                            <div className="flex items-center gap-4">
                                <item.icon className="w-6 h-6 text-emerald-400" />
                                <span className="text-lg font-medium">{item.name}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-zinc-600" />
                        </Link>
                    ))}
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-4 px-4 py-4 w-full bg-red-400/5 border border-red-400/20 rounded-2xl text-red-400"
                    >
                        <LogOut className="w-6 h-6" />
                        <span className="text-lg font-medium">Déconnexion</span>
                    </button>
                </nav>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto lg:p-10 pt-24 p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800/10 via-transparent to-transparent">
        <div className="max-w-6xl mx-auto">
            {children}
        </div>
      </main>

    </div>
  );
}
