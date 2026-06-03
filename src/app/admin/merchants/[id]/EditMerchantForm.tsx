"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, RefreshCw, Check, AlertCircle, Plus, Trash2 } from "lucide-react";

const BUSINESS_OPTIONS = ["cafe", "restaurant", "boulangerie", "boutique", "salon", "sport", "autre"];

type LoyaltyType = "stamp_card" | "visit_based" | "tiered";

interface Props {
  merchant: {
    id: string;
    shopName: string;
    primaryColor: string;
    logoUrl: string | null;
    stampGoal: number;
    scanCooldownSeconds: number;
    businessType: string;
    thresholds: { activeDays: number; atRiskDays: number; vipVisits: number; newTenureDays: number };
    address: string | null;
    loyaltyType: LoyaltyType;
    milestones: number[];
    tiers: { name: string; at: number }[];
  };
}

export default function EditMerchantForm({ merchant }: Props) {
  const router = useRouter();
  const [shopName, setShopName] = useState(merchant.shopName);
  const [primaryColor, setPrimaryColor] = useState(merchant.primaryColor);
  const [logoUrl, setLogoUrl] = useState(merchant.logoUrl || "");
  const [stampGoal, setStampGoal] = useState(merchant.stampGoal);
  const [loyaltyType, setLoyaltyType] = useState<LoyaltyType>(merchant.loyaltyType);
  const [milestonesStr, setMilestonesStr] = useState(merchant.milestones.join(", "));
  const [tiers, setTiers] = useState<{ name: string; at: number }[]>(
    merchant.tiers.length ? merchant.tiers : [{ name: "", at: 1 }]
  );
  const [scanCooldownSeconds, setScanCooldownSeconds] = useState(merchant.scanCooldownSeconds);
  const [businessType, setBusinessType] = useState(merchant.businessType);
  const [activeDays, setActiveDays] = useState(merchant.thresholds.activeDays);
  const [atRiskDays, setAtRiskDays] = useState(merchant.thresholds.atRiskDays);
  const [vipVisits, setVipVisits] = useState(merchant.thresholds.vipVisits);
  const [newTenureDays, setNewTenureDays] = useState(merchant.thresholds.newTenureDays);
  const [address, setAddress] = useState(merchant.address || "");
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");

    // Construit la config du programme selon le type choisi (la validation serveur fait foi).
    let loyaltyConfig: Record<string, unknown>;
    if (loyaltyType === "visit_based") {
      const milestones = milestonesStr
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      loyaltyConfig = { milestones };
    } else if (loyaltyType === "tiered") {
      loyaltyConfig = { tiers: tiers.map((t) => ({ name: t.name.trim(), at: Number(t.at) })) };
    } else {
      loyaltyConfig = { goal: stampGoal };
    }

    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName, primaryColor, logoUrl,
          stampGoal, scanCooldownSeconds, businessType, activeDays, atRiskDays, vipVisits, newTenureDays,
          address,
          loyaltyType, loyaltyConfig,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Erreur lors de l'enregistrement.");
        return;
      }
      setMsg("Modifications enregistrées.");
      router.refresh();
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    if (!confirm("Régénérer le lien d'enrôlement ? L'ancien QR/lien ne fonctionnera plus.")) return;
    setRotating(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}/rotate-token`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Erreur lors de la rotation.");
        return;
      }
      setMsg("Nouveau lien d'enrôlement généré.");
      router.refresh();
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setRotating(false);
    }
  };

  const numInput = "w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all";

  return (
    <form onSubmit={save} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-5 h-fit">
      <h2 className="font-bold">Branding</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Nom de la boutique</label>
        <div className="relative group">
          <Store className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
          <input
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            maxLength={100}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
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

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">URL du logo (optionnel)</label>
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
        />
      </div>

      <h2 className="font-bold pt-2 border-t border-zinc-800">Programme &amp; segmentation</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Type de programme</label>
        <select value={loyaltyType} onChange={(e) => setLoyaltyType(e.target.value as LoyaltyType)} className={numInput}>
          <option value="stamp_card">Carte à tampons (objectif)</option>
          <option value="visit_based">Paliers de visites (récompenses successives)</option>
          <option value="tiered">Niveaux de fidélité (statuts)</option>
        </select>
        <p className="text-xs text-zinc-500 ml-1">
          {loyaltyType === "stamp_card" && "Cyclique : la carte se remplit jusqu'à l'objectif, puis se remet à zéro à l'encaissement."}
          {loyaltyType === "visit_based" && "Cumulatif : une récompense est offerte à chaque palier de visites atteint, sans remise à zéro."}
          {loyaltyType === "tiered" && "Cumulatif : le client gagne des niveaux permanents selon ses visites (pas d'encaissement)."}
        </p>
      </div>

      {loyaltyType === "stamp_card" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Objectif carte (tampons)</label>
          <input type="number" min={1} max={50} value={stampGoal}
            onChange={(e) => setStampGoal(Number(e.target.value))} className={numInput} />
        </div>
      )}

      {loyaltyType === "visit_based" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Paliers de visites (séparés par des virgules)</label>
          <input value={milestonesStr} onChange={(e) => setMilestonesStr(e.target.value)}
            placeholder="Ex : 5, 20, 50" className={numInput} />
          <p className="text-xs text-zinc-500 ml-1">Valeurs strictement croissantes, jusqu'à 10 paliers.</p>
        </div>
      )}

      {loyaltyType === "tiered" && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-400 ml-1">Niveaux (nom + nombre de visites)</label>
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={t.name} maxLength={40} placeholder="Nom (ex : Argent)"
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className={`${numInput} flex-1`} />
              <input type="number" min={1} value={t.at} placeholder="Seuil"
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, at: Number(e.target.value) } : x)))}
                className={`${numInput} w-28`} />
              <button type="button" aria-label="Retirer le niveau"
                onClick={() => setTiers(tiers.length > 1 ? tiers.filter((_, j) => j !== i) : tiers)}
                className="p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {tiers.length < 6 && (
            <button type="button" onClick={() => setTiers([...tiers, { name: "", at: (tiers[tiers.length - 1]?.at ?? 0) + 1 }])}
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors ml-1">
              <Plus className="w-4 h-4" /> Ajouter un niveau
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Délai mini entre 2 tampons (s)</label>
          <input type="number" min={0} max={600} value={scanCooldownSeconds}
            onChange={(e) => setScanCooldownSeconds(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Métier</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={numInput}>
            {BUSINESS_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Jours « actif » (déf. 30)</label>
          <input type="number" min={1} value={activeDays}
            onChange={(e) => setActiveDays(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Jours « à risque » (déf. 90)</label>
          <input type="number" min={1} value={atRiskDays}
            onChange={(e) => setAtRiskDays(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Visites VIP (déf. 10)</label>
          <input type="number" min={1} value={vipVisits}
            onChange={(e) => setVipVisits(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Ancienneté « nouveau » (déf. 30)</label>
          <input type="number" min={1} value={newTenureDays}
            onChange={(e) => setNewTenureDays(Number(e.target.value))} className={numInput} />
        </div>
      </div>

      <h2 className="font-bold pt-2 border-t border-zinc-800">Adresse (proximité)</h2>
      <input value={address} onChange={(e) => setAddress(e.target.value)}
        placeholder="12 rue de la Paix, Genève"
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" />

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {msg && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl px-4 py-3 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-amber-500 text-black font-bold px-5 py-3 rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={rotate}
          disabled={rotating}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-5 py-3 rounded-2xl font-medium transition-colors disabled:opacity-50"
        >
          {rotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Régénérer le lien
        </button>
      </div>
    </form>
  );
}
