"use client";

// Formulaire d'inscription self-service — mobile-first, validation inline,
// réponse générique anti-énumération (l'écran « vérifiez votre boîte mail »
// est identique que l'adresse soit déjà utilisée ou non).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Mail, Lock, ArrowRight, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { HaloSymbol } from "@/components/halo/HaloMark";
import { PASSWORD_MIN_LENGTH } from "@/lib/signup/validation";

declare global {
  interface Window {
    turnstile?: { getResponse?: (container?: string | HTMLElement) => string | undefined };
  }
}

export default function SignupClient({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  // ?erreur=lien : lien de confirmation expiré/déjà consommé (GET /signup/confirm).
  // Lu via window.location (pas useSearchParams : évite la frontière Suspense).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("erreur") === "lien") {
      setError("Ce lien de confirmation a expiré ou a déjà servi. Réinscrivez-vous : vous recevrez un nouveau lien.");
    }
  }, []);

  const passwordHint = useMemo(() => {
    if (password.length === 0) return null;
    if (password.length < PASSWORD_MIN_LENGTH)
      return { ok: false, text: `Encore ${PASSWORD_MIN_LENGTH - password.length} caractère${PASSWORD_MIN_LENGTH - password.length > 1 ? "s" : ""} — visez ${PASSWORD_MIN_LENGTH} minimum.` };
    if (!/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password))
      return { ok: false, text: "Ajoutez au moins un chiffre ou un symbole." };
    return { ok: true, text: "Bon mot de passe." };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const captchaToken = turnstileSiteKey ? window.turnstile?.getResponse?.() ?? null : null;
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(captchaToken ? { captchaToken } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Une erreur est survenue. Réessayez.");
        return;
      }
      setSentTo(email.trim().toLowerCase());
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="bg-surface border border-line-warm rounded-3xl p-8 text-center shadow-[0_8px_30px_-12px_rgba(14,15,17,0.18)]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-halo/10">
              <MailCheck className="h-7 w-7 text-halo" aria-hidden />
            </div>
            <h1 className="font-display text-2xl mb-2">Vérifiez votre boîte mail</h1>
            <p className="text-galet-ink text-sm leading-relaxed">
              Nous venons d&apos;envoyer un lien de confirmation à <strong className="text-onyx">{sentTo}</strong>.
              Cliquez-le pour activer votre compte — il est valable 24 heures.
            </p>
            <p className="text-galet text-xs mt-6">
              Rien reçu après quelques minutes ? Regardez vos indésirables, ou{" "}
              <button onClick={() => setSentTo(null)} className="text-halo hover:underline">
                réessayez
              </button>
              .
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center px-4 py-8 sm:p-6">
      {turnstileSiteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      )}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <HaloSymbol size={44} className="mb-4 text-halo" />
          <h1 className="font-display text-3xl tracking-[0.18em]">HALO</h1>
          <p className="text-galet-ink mt-2 font-display text-xl">
            Votre carte de fidélité, <em className="text-halo not-italic">en ligne aujourd&apos;hui</em>
          </p>
        </div>

        <div className="bg-surface border border-line-warm rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_-12px_rgba(14,15,17,0.18)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-galet-ink ml-1">Email professionnel</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                <input
                  required type="email" value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-galet-ink ml-1">Mot de passe</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-galet group-focus-within:text-halo transition-colors" />
                <input
                  required type="password" value={password} autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`${PASSWORD_MIN_LENGTH} caractères minimum`}
                  className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-onyx focus:ring-2 focus:ring-halo/25 focus:border-halo outline-none transition-all placeholder:text-galet"
                />
              </div>
              {passwordHint && (
                <p className={`text-xs ml-1 ${passwordHint.ok ? "text-halo" : "text-galet-ink"}`}>{passwordHint.text}</p>
              )}
            </div>

            {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />}

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
                <>Créer mon compte <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-galet-ink">
            Après confirmation de votre email : créez votre carte vous-même (~15 min),
            ou laissez notre équipe la créer pour vous (~2 min).
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-galet">
            <ShieldCheck className="h-3.5 w-3.5 text-halo" aria-hidden />
            Aucune carte bancaire requise pendant le lancement.
          </p>
          <p className="text-center text-galet text-xs mt-3">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-halo hover:underline">Se connecter</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
