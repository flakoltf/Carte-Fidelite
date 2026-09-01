"use client";

import { useState, useEffect } from "react";
import { Save, Palette, Image as ImageIcon, Store, Loader2, CheckCircle, Gift, Clock, Camera, Star } from "lucide-react";
import { motion } from "framer-motion";
import { SecuritySection } from "./SecuritySection";
import { SegmentsSection } from "./SegmentsSection";
import BusinessHoursEditor from "./BusinessHoursEditor";
import { DEFAULT_BUSINESS_HOURS, normalizeBusinessHours, type BusinessHours } from "@/lib/merchant-config/hours";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [shopName, setShopName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrMsg, setAddrMsg] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // Carte vivante (Feature 1)
  const [rewardLabel, setRewardLabel] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    // Chargement unique au montage.
    fetchMerchant();
  }, []);

  const fetchMerchant = async () => {
    // Source du marchand : endpoint serveur qui respecte l'impersonation
    // (admin concierge), au lieu de résoudre via le client navigateur.
    const res = await fetch("/api/merchant/me");
    const { merchant: data } = await res.json();

    if (data) {
      setShopName(data.shop_name);
      setPrimaryColor(data.primary_color || "#10b981");
      setLogoUrl(data.logo_url || "");
      setAddress(data.address || "");
      setLat(data.latitude != null ? String(data.latitude) : "");
      setLng(data.longitude != null ? String(data.longitude) : "");
      setRewardLabel(data.reward_label || "");
      setBusinessHours(normalizeBusinessHours(data.business_hours));
      setGooglePlaceId(data.google_place_id || "");
    }
    setLoading(false);
  };

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true); setPhotoMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/merchant/card-photo", { method: "POST", body: fd });
      setPhotoMsg(res.ok ? "Photo mise à jour — vos cartes se rafraîchissent." : "Échec de l'envoi de la photo.");
    } catch {
      setPhotoMsg("Erreur réseau.");
    }
    setUploadingPhoto(false);
  };

  const saveAddress = async () => {
    setSavingAddr(true); setAddrMsg("");
    try {
      const payload: { address: string; latitude?: number; longitude?: number } = { address };
      if (lat.trim() && lng.trim()) { payload.latitude = Number(lat); payload.longitude = Number(lng); }
      const res = await fetch("/api/merchant/location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

    // Écriture via endpoint serveur (impersonation-safe : utilise currentMerchantId()
    // côté serveur via supabaseAdmin, contourne la RLS own-row de `merchants`).
    const res = await fetch("/api/merchant/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_name: shopName,
        primary_color: primaryColor,
        logo_url: logoUrl,
        reward_label: rewardLabel.trim() === "" ? null : rewardLabel.trim(),
        business_hours: businessHours,
        google_place_id: googlePlaceId.trim() === "" ? null : googlePlaceId.trim(),
      }),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-halo" />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-10">

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-onyx">Paramètres</h1>
        <p className="text-galet-ink">Personnalisez votre boutique et l&apos;apparence de vos cartes Wallet.</p>
      </div>

      {/* Formulaire — pleine largeur depuis le retrait de l'aperçu (le vrai
          rendu de la carte vit dans le Studio, source unique de vérité). */}
      <div className="space-y-6">
            <form onSubmit={handleSave} className="bg-surface border border-line-warm rounded-3xl p-8 space-y-8 shadow-sm">

                {/* Identité */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-halo font-bold text-sm mb-4">
                        <Store className="w-4 h-4" />
                        IDENTITÉ DE LA BOUTIQUE
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="set-shopname" className="text-sm font-medium text-galet-ink">Nom public</label>
                        <input
                            id="set-shopname"
                            type="text"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Branding */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-halo font-bold text-sm mb-4">
                        <Palette className="w-4 h-4" />
                        APPARENCE DE LA CARTE
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="set-color" className="text-sm font-medium text-galet-ink">Couleur principale</label>
                            <div className="flex gap-3">
                                <input
                                    id="set-color"
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    aria-label="Couleur principale (sélecteur)"
                                    className="w-12 h-12 bg-transparent border-none outline-none cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    aria-label="Couleur principale (code hex)"
                                    className="flex-1 bg-surface border border-line-warm rounded-2xl py-3 px-4 text-sm font-mono text-onyx focus:border-halo outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="set-logo" className="text-sm font-medium text-galet-ink">URL du Logo (HTTPS)</label>
                            <div className="relative group">
                                <ImageIcon className="absolute left-4 top-3.5 w-5 h-5 text-galet" aria-hidden />
                                <input
                                    id="set-logo"
                                    type="url"
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-surface border border-line-warm rounded-2xl py-3.5 pl-12 pr-4 text-sm text-onyx placeholder:text-galet-ink focus:border-halo outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Carte vivante (Feature 1) ─────────────────────────── */}
                <div className="pt-6 border-t border-line-warm space-y-6">
                    <div>
                        <h2 className="font-bold text-onyx flex items-center gap-2"><Gift className="w-4 h-4 text-halo" /> Carte vivante</h2>
                        <p className="text-sm text-galet-ink mt-1">Ces infos s&apos;affichent directement sur la carte Wallet de vos clients.</p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="set-reward" className="text-sm font-medium text-galet-ink">Récompense affichée</label>
                        <input
                            id="set-reward"
                            type="text"
                            maxLength={80}
                            value={rewardLabel}
                            onChange={(e) => setRewardLabel(e.target.value)}
                            placeholder="Un café offert"
                            className="w-full bg-surface border border-line-warm rounded-2xl py-3.5 px-4 text-sm text-onyx placeholder:text-galet-ink focus:border-halo outline-none transition-all"
                        />
                        <p className="text-xs text-galet-ink">{rewardLabel.length}/80</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-galet-ink flex items-center gap-1.5"><Clock className="w-4 h-4" /> Horaires d&apos;ouverture</label>
                        <BusinessHoursEditor value={businessHours} onChange={setBusinessHours} />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="set-placeid" className="text-sm font-medium text-galet-ink flex items-center gap-1.5"><Star className="w-4 h-4" aria-hidden /> Avis Google (au moment magique)</label>
                        <p className="text-xs text-galet-ink">Quand un client débloque sa récompense, sa carte affiche « Laisser un avis Google ». Collez votre Place ID (commence par <code>ChIJ…</code>).</p>
                        <input
                            id="set-placeid"
                            type="text"
                            value={googlePlaceId}
                            onChange={(e) => setGooglePlaceId(e.target.value)}
                            placeholder="ChIJ…"
                            className="w-full bg-surface border border-line-warm rounded-2xl py-3.5 px-4 text-sm text-onyx placeholder:text-galet-ink focus:border-halo outline-none transition-all font-mono"
                        />
                        {googlePlaceId.trim() !== "" && !/^ChIJ[A-Za-z0-9_-]{10,256}$/.test(googlePlaceId.trim()) && (
                            <p role="alert" className="text-xs text-amber-700">Format inattendu — un Place ID commence par « ChIJ ».</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="set-photo" className="text-sm font-medium text-galet-ink flex items-center gap-1.5"><Camera className="w-4 h-4" aria-hidden /> Photo du commerce</label>
                        <p className="text-xs text-galet-ink">Affichée en bandeau sur la carte. Même image que dans le Studio — la dernière modification fait foi.</p>
                        <input
                            id="set-photo"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={uploadingPhoto}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
                            className="block text-sm text-galet-ink file:mr-3 file:rounded-full file:border-0 file:bg-halo file:px-4 file:py-2 file:text-white file:font-semibold disabled:opacity-50"
                        />
                        {uploadingPhoto && <p className="text-xs text-galet-ink inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Envoi…</p>}
                        {photoMsg && <p role="status" aria-live="polite" className="text-xs text-galet-ink">{photoMsg}</p>}
                    </div>
                </div>

                <div className="pt-4 border-t border-line-warm flex items-center justify-between">
                    <button
                        disabled={saving}
                        className="bg-halo text-white font-bold py-3 px-8 rounded-2xl hover:bg-halo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Enregistrer
                    </button>

                    {success && (
                        <motion.div
                            role="status"
                            aria-live="polite"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 text-halo text-sm font-medium"
                        >
                            <CheckCircle className="w-5 h-5" aria-hidden />
                            Modifications enregistrées !
                        </motion.div>
                    )}
                </div>
            </form>
          <div className="bg-surface border border-line-warm rounded-3xl p-6 space-y-4 shadow-sm">
            <h2 className="font-bold text-onyx flex items-center gap-2"><Store className="w-4 h-4" /> Adresse & proximité</h2>
            <p className="text-sm text-galet-ink">Vos clients verront leur carte sur leur écran verrouillé quand ils passent près de votre boutique (≈100 m).</p>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue de la Paix, Genève" aria-label="Adresse de la boutique"
              className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-sm text-onyx placeholder:text-galet-ink outline-none focus:border-halo" />
            <div className="grid grid-cols-2 gap-3">
              <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="Latitude (optionnel)" aria-label="Latitude"
                className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-sm text-onyx placeholder:text-galet-ink outline-none focus:border-halo" />
              <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="Longitude (optionnel)" aria-label="Longitude"
                className="w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-sm text-onyx placeholder:text-galet-ink outline-none focus:border-halo" />
            </div>
            <p className="text-xs text-galet-ink">Si l&apos;adresse n&apos;est pas trouvée, collez vos coordonnées (Google Maps → clic droit → copier).</p>
            <button type="button" onClick={saveAddress} disabled={savingAddr || address.trim().length < 5}
              className="bg-halo text-white rounded-xl px-5 py-2.5 font-bold disabled:opacity-50 hover:bg-halo-600 transition-all">
              {savingAddr ? "Enregistrement…" : "Enregistrer l'adresse"}
            </button>
            {addrMsg && <p role="status" aria-live="polite" className="text-sm text-galet-ink">{addrMsg}</p>}
          </div>
      </div>

      <SegmentsSection />

      <SecuritySection />

    </div>
  );
}
