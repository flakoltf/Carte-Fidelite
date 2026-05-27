"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Store, LogOut, ShieldCheck, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

const navItems = [
  { name: "Vue d'ensemble", icon: LayoutDashboard, href: "/admin" },
  { name: "Marchands", icon: Store, href: "/admin/merchants" },
];

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
    <div className="min-h-screen bg-zinc-950 text-white flex overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-zinc-900 bg-zinc-950 p-6">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-amber-400 w-5 h-5" />
          </div>
          <span className="text-xl font-bold italic tracking-tight">
            WalletCard <span className="text-amber-400 not-italic text-sm font-semibold">Admin</span>
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-900">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Header mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-amber-400 w-5 h-5" />
          <span className="font-bold italic">WalletCard Admin</span>
        </div>
        <button onClick={() => setOpen(!open)}>{open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </div>

      <AnimatePresence>
        {open && (
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
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-4 px-4 py-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl"
                >
                  <item.icon className="w-6 h-6 text-amber-400" />
                  <span className="text-lg font-medium">{item.name}</span>
                </Link>
              ))}
              <button
                onClick={logout}
                className="flex items-center gap-4 px-4 py-4 w-full bg-red-400/5 border border-red-400/20 rounded-2xl text-red-400"
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
