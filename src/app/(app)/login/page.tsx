"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { HaloSymbol } from "@/components/halo/HaloMark";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Email ou mot de passe incorrect.");
        return;
      }

      router.push(body.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <HaloSymbol size={44} className="mb-4 text-halo" />
          <h1 className="font-display text-3xl tracking-[0.18em]">HALO</h1>
          <p className="text-galet-ink mt-2 font-display text-xl">
            Bon retour <em className="text-halo not-italic">parmi nous</em>
          </p>
        </div>

        <div className="bg-surface border border-line-warm rounded-3xl p-8 shadow-[0_8px_30px_-12px_rgba(14,15,17,0.18)]">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-galet-ink ml-1">Email professionnel</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                <input
                  required type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline gap-3 px-1">
                <label className="text-sm font-medium text-galet-ink">Mot de passe</label>
                {/* Réinitialisation en libre-service dans un lot séparé — en
                    attendant, un marchand bloqué a une porte de sortie réelle. */}
                <a
                  href="mailto:contact@halocard.ch?subject=Mot%20de%20passe%20oubli%C3%A9"
                  className="text-xs text-galet hover:text-onyx transition-colors text-right"
                >
                  Oublié ? <span className="underline">Écrivez-nous</span>, on vous le renvoie dans la
                  journée.
                </a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                <input
                  required type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-2xl text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              disabled={loading}
              className="w-full bg-halo text-white font-semibold py-4 rounded-2xl hover:bg-halo-600 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Se connecter <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <p className="text-center text-galet text-xs mt-8">
            Les comptes marchands sont créés par l&apos;administrateur.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
