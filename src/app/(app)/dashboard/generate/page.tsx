"use client";

import { useState } from "react";
import { Wallet, ArrowRight, CheckCircle, Loader2, AlertCircle, Sparkles, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";

export default function GeneratePage() {
  const [saveUrl, setSaveUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");

  const generatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-google-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customerName: customerName,
            currentStamps: 0
        })
      });

      const data = await res.json();

      if (data.saveUrl) {
        setSaveUrl(data.saveUrl);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Connexion au serveur impossible. Vérifiez votre réseau.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">

      <div>
        <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx flex items-center gap-3">
            Générer une Carte
            <Sparkles className="w-6 h-6 text-halo" />
        </h1>
        <p className="text-galet-ink">Créez une nouvelle carte de fidélité numérique pour l&apos;un de vos clients.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">

        {/* Formulaire de génération */}
        <div className="bg-surface border border-line-warm rounded-3xl p-8 space-y-8 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Wallet className="w-32 h-32" />
            </div>

            {!saveUrl ? (
                <form onSubmit={generatePass} className="space-y-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-galet-ink ml-1">Nom complet du client</label>
                        <input
                            required
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex: Jean Dupont"
                            className="w-full bg-surface border border-line-warm rounded-2xl py-4 px-6 focus:border-halo outline-none transition-all placeholder:text-galet text-lg text-onyx"
                        />
                    </div>

                    <div className="p-4 bg-calcaire border border-line-warm rounded-2xl text-xs text-galet-ink leading-relaxed">
                        <p>💡 La carte sera automatiquement configurée avec **0 points** et liée à votre boutique. Le client pourra l&apos;ajouter instantanément à son Google Wallet.</p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-2xl flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="text-sm">{error}</span>
                        </motion.div>
                    )}

                    <button
                        disabled={loading || !customerName}
                        className="w-full bg-halo text-white font-bold py-5 rounded-2xl hover:bg-halo-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 group text-lg"
                    >
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <>
                                Générer le lien Wallet
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-300"
                >
                    <div className="w-20 h-20 bg-halo rounded-full flex items-center justify-center shadow-lg shadow-halo/20">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold mb-2 text-onyx">Carte Prête !</h2>
                        <p className="text-galet-ink text-sm">Faites scanner ce code QR à votre client **{customerName}**.</p>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border-8 border-line-warm shadow-2xl shadow-halo/10">
                        <QRCode
                            value={saveUrl}
                            size={200}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    </div>

                    <div className="w-full flex flex-col gap-3">
                        <a
                            href={saveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-surface border border-line-warm text-onyx py-4 rounded-2xl font-bold hover:bg-calcaire transition-all"
                        >
                            <Smartphone className="w-5 h-5" />
                            Ouvrir sur ce téléphone
                        </a>
                        <button
                            onClick={() => { setSaveUrl(""); setCustomerName(""); }}
                            className="text-galet-ink text-sm underline hover:text-onyx transition-colors"
                        >
                            Générer une autre carte
                        </button>
                    </div>
                </motion.div>
            )}
        </div>

        {/* Aide visuelle / Preview */}
        <div className="hidden lg:block space-y-6">
            <h3 className="text-sm font-bold text-galet ml-1">PRÉVISUALISATION DU PASS</h3>
            <div className="aspect-[1/1.6] w-64 mx-auto bg-surface border border-line-warm rounded-[40px] p-3 shadow-2xl relative">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-onyx rounded-b-2xl z-20" />

                <div className="h-full w-full bg-calcaire rounded-[30px] overflow-hidden flex flex-col p-4 pt-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="w-6 h-6 bg-halo/20 rounded-md" />
                        <div className="w-12 h-2 bg-line-warm rounded-full" />
                    </div>

                    <div className="bg-halo h-24 rounded-2xl mb-4 p-3 flex flex-col justify-between">
                        <div className="w-10 h-1 bg-white/20 rounded-full" />
                        <div className="w-16 h-4 bg-white/20 rounded-md" />
                    </div>

                    <div className="flex-1 bg-surface rounded-2xl p-3 border border-line-warm border-dashed flex flex-col items-center justify-center gap-2">
                        <div className="w-20 h-20 bg-calcaire rounded-md flex items-center justify-center">
                           <div className="w-12 h-12 bg-line-warm/30 rounded-sm border border-line-warm p-2 opacity-40">
                             <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-full w-full">
                                {[...Array(9)].map((_, i) => <div key={i} className="bg-galet/40" />)}
                             </div>
                           </div>
                        </div>
                        <div className="w-12 h-2 bg-line-warm rounded-full" />
                    </div>
                </div>
            </div>
            <p className="text-xs text-center text-galet italic">Ceci est un aperçu générique de la carte.</p>
        </div>

      </div>

    </div>
  );
}
