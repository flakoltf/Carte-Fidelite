"use client";

import { useState, useEffect } from "react";
import { Save, Palette, Image as ImageIcon, Store, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  
  const [shopName, setShopName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrMsg, setAddrMsg] = useState("");

  // Utilisation du client SSR Browser
  const supabaseClient = createClient();

  useEffect(() => {
    fetchMerchant();
  }, []);

  const fetchMerchant = async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data } = await supabaseClient
      .from("merchants")
      .select("*")
      .eq("user_id", user?.id)
      .single();
    
    if (data) {
      setMerchant(data);
      setShopName(data.shop_name);
      setPrimaryColor(data.primary_color || "#10b981");
      setLogoUrl(data.logo_url || "");
      setAddress(data.address || "");
    }
    setLoading(false);
  };

  const saveAddress = async () => {
    setSavingAddr(true); setAddrMsg("");
    try {
      const res = await fetch("/api/merchant/location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      if (!res.ok) { setAddrMsg(json.error || "Erreur."); return; }
      setAddrMsg(json.located ? "Position trouvée ✓ — vos clients seront alertés à proximité." : "Adresse enregistrée, mais non localisée. Vérifiez l'adresse.");
    } catch {
      setAddrMsg("Erreur de connexion.");
    } finally { setSavingAddr(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    const { error } = await supabaseClient
      .from("merchants")
      .update({
        shop_name: shopName,
        primary_color: primaryColor,
        logo_url: logoUrl
      })
      .eq("id", merchant.id);

    if (!error) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-10">
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Paramètres</h1>
        <p className="text-zinc-500">Personnalisez votre boutique et l'apparence de vos cartes Wallet.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSave} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-8">
                
                {/* Identité */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-4">
                        <Store className="w-4 h-4" />
                        IDENTITÉ DE LA BOUTIQUE
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Nom public</label>
                        <input 
                            type="text" 
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Branding */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-4">
                        <Palette className="w-4 h-4" />
                        APPARENCE DE LA CARTE
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Couleur principale</label>
                            <div className="flex gap-3">
                                <input 
                                    type="color" 
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-12 h-12 bg-transparent border-none outline-none cursor-pointer"
                                />
                                <input 
                                    type="text" 
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">URL du Logo (HTTPS)</label>
                            <div className="relative group">
                                <ImageIcon className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
                                <input 
                                    type="text" 
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <button 
                        disabled={saving}
                        className="bg-white text-black font-bold py-3 px-8 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Enregistrer
                    </button>

                    {success && (
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 text-emerald-400 text-sm font-medium"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Modifications enregistrées !
                        </motion.div>
                    )}
                </div>
            </form>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><Store className="w-4 h-4" /> Adresse & proximité</h2>
            <p className="text-sm text-zinc-500">Vos clients verront leur carte sur leur écran verrouillé quand ils passent près de votre boutique (≈100 m).</p>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue de la Paix, Genève"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm outline-none focus:border-emerald-500" />
            <button type="button" onClick={saveAddress} disabled={savingAddr || address.trim().length < 5}
              className="bg-emerald-500 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50">
              {savingAddr ? "Enregistrement…" : "Enregistrer l'adresse"}
            </button>
            {addrMsg && <p className="text-sm text-zinc-300">{addrMsg}</p>}
          </div>
        </div>

        {/* Aperçu */}
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-zinc-500 ml-1">APERÇU DE LA CARTE</h3>
            <div 
                className="aspect-[1.58/1] w-full rounded-3xl p-8 relative overflow-hidden shadow-2xl transition-all duration-500"
                style={{ backgroundColor: primaryColor }}
            >
                {/* Gloss effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] opacity-70 font-bold tracking-widest uppercase mb-1">BOUTIQUE</div>
                            <div className="text-xl font-bold italic">{shopName || "Ma Boutique"}</div>
                        </div>
                        {logoUrl ? (
                            <img src={logoUrl} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm p-1 border border-white/20" alt="logo" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm" />
                        )}
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-[10px] opacity-70 font-bold tracking-widest uppercase mb-1">POINTS DE FIDÉLITÉ</div>
                            <div className="text-3xl font-black">7 / 10</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg">
                            <div className="w-12 h-12 bg-zinc-200 animate-pulse rounded-sm" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 text-xs text-zinc-500 leading-relaxed">
                <p>💡 <strong>Note :</strong> La couleur et le logo s'appliqueront aux prochaines cartes générées. Pour mettre à jour les cartes existantes, utilisez le bouton "Push Update" (disponible prochainement).</p>
            </div>
        </div>

      </div>

    </div>
  );
}
