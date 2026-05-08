"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabaseClient = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Client-side rate limiting indication (server will enforce)
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message?.includes("429") || error.message?.includes("too many")) {
          setError("Trop de tentatives. Réessayez dans 15 minutes.");
        } else {
          setError(error.message || "Email ou mot de passe incorrect.");
        }
        throw error;
      }

      router.push("/dashboard");
    } catch (err: any) {
      if (!error) {
        setError("Erreur de connexion. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Wallet className="text-emerald-400 w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold italic tracking-tighter">WalletCard</h1>
            <p className="text-zinc-500 mt-2">Bon retour parmi nous</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 ml-1">Email professionnel</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline px-1">
                <label className="text-sm font-medium text-zinc-400">Mot de passe</label>
                <Link href="#" className="text-xs text-zinc-500 hover:text-white transition-colors">Oublié ?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                <input 
                  required
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl text-sm"
              >
                {error}
              </motion.div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-zinc-500 text-sm mt-8">
            Vous n'avez pas de compte ?{" "}
            <Link href="/signup" className="text-white font-bold hover:underline">Créer un compte</Link>
          </p>
        </div>
      </motion.div>

    </div>
  );
}
