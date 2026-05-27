"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Store, Mail, Copy, Check, AlertCircle, KeyRound } from "lucide-react";

export default function NewMerchantForm() {
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName, email, primaryColor }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Une erreur est survenue.");
        return;
      }
      setResult({ email: body.email, tempPassword: body.tempPassword });
    } catch {
      setError("Erreur de connexion. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const copyCreds = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`Email : ${result.email}\nMot de passe : ${result.tempPassword}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  if (result) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Check className="w-5 h-5" />
          Marchand créé
        </div>
        <p className="text-sm text-zinc-400">
          Transmettez ces identifiants au marchand. <strong className="text-amber-400">Le mot de passe ne sera plus affiché</strong> ensuite.
        </p>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2 font-mono text-sm">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-zinc-500" />
            {result.email}
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-zinc-500" />
            {result.tempPassword}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={copyCreds}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-3 rounded-2xl font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copié" : "Copier"}
          </button>
          <Link
            href="/admin/merchants"
            className="flex items-center bg-amber-500 text-black font-bold px-5 py-3 rounded-2xl hover:bg-amber-400 transition-all"
          >
            Terminer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Nom de la boutique</label>
        <div className="relative group">
          <Store className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
          <input
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            maxLength={100}
            placeholder="Ex: Boulangerie du Coin"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Email du marchand</label>
        <div className="relative group">
          <Mail className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            placeholder="marchand@boutique.com"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Couleur de marque</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-12 h-12 rounded-xl bg-transparent border border-zinc-800 cursor-pointer"
          />
          <span className="font-mono text-sm text-zinc-400">{primaryColor}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-amber-500 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-400 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Créer le marchand"}
      </button>
    </form>
  );
}
