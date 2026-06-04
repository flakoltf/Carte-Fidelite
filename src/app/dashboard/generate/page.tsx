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
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            Générer une Carte
            <Sparkles className="w-6 h-6 text-emerald-400" />
        </h1>
        <p className="text-zinc-500">Créez une nouvelle carte de fidélité numérique pour l&apos;un de vos clients.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        
        {/* Formulaire de génération */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-[32px] p-8 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Wallet className="w-32 h-32" />
            </div>

            {!saveUrl ? (
                <form onSubmit={generatePass} className="space-y-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400 ml-1">Nom complet du client</label>
                        <input 
                            required
                            type="text" 
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex: Jean Dupont"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-700 text-lg"
                        />
                    </div>

                    <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl text-xs text-zinc-500 leading-relaxed">
                        <p>💡 La carte sera automatiquement configurée avec **0 points** et liée à votre boutique. Le client pourra l&apos;ajouter instantanément à son Google Wallet.</p>
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="text-sm">{error}</span>
                        </motion.div>
                    )}

                    <button 
                        disabled={loading || !customerName}
                        className="w-full bg-emerald-500 text-black font-bold py-5 rounded-2xl hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 group text-lg"
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
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <CheckCircle className="w-12 h-12 text-black" />
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Carte Prête !</h2>
                        <p className="text-zinc-500 text-sm">Faites scanner ce code QR à votre client **{customerName}**.</p>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border-8 border-zinc-950 shadow-2xl shadow-emerald-500/10">
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
                            className="flex items-center justify-center gap-2 bg-white text-black py-4 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                        >
                            <Smartphone className="w-5 h-5" />
                            Ouvrir sur ce téléphone
                        </a>
                        <button 
                            onClick={() => { setSaveUrl(""); setCustomerName(""); }} 
                            className="text-zinc-500 text-sm underline hover:text-white transition-colors"
                        >
                            Générer une autre carte
                        </button>
                    </div>
                </motion.div>
            )}
        </div>

        {/* Aide visuelle / Preview */}
        <div className="hidden lg:block space-y-6">
            <h3 className="text-sm font-bold text-zinc-500 ml-1">PRÉVISUALISATION DU PASS</h3>
            <div className="aspect-[1/1.6] w-64 mx-auto bg-zinc-900 border border-zinc-800 rounded-[40px] p-3 shadow-2xl relative">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />
                
                <div className="h-full w-full bg-zinc-950 rounded-[30px] overflow-hidden flex flex-col p-4 pt-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="w-6 h-6 bg-emerald-500/20 rounded-md" />
                        <div className="w-12 h-2 bg-zinc-800 rounded-full" />
                    </div>
                    
                    <div className="bg-emerald-500 h-24 rounded-2xl mb-4 p-3 flex flex-col justify-between">
                        <div className="w-10 h-1 bg-white/20 rounded-full" />
                        <div className="w-16 h-4 bg-white/20 rounded-md" />
                    </div>

                    <div className="flex-1 bg-zinc-900/50 rounded-2xl p-3 border border-zinc-800 border-dashed flex flex-col items-center justify-center gap-2">
                        <div className="w-20 h-20 bg-zinc-800 rounded-md flex items-center justify-center">
                           <div className="w-12 h-12 bg-white/5 rounded-sm border border-white/10 p-2 opacity-20">
                             <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-full w-full">
                                {[...Array(9)].map((_, i) => <div key={i} className="bg-white/40" />)}
                             </div>
                           </div>
                        </div>
                        <div className="w-12 h-2 bg-zinc-800 rounded-full" />
                    </div>
                </div>
            </div>
            <p className="text-xs text-center text-zinc-500 italic">Ceci est un aperçu générique de la carte.</p>
        </div>

      </div>

    </div>
  );
}
