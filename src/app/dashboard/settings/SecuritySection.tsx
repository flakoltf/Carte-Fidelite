"use client";
import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isValidTotpCode } from "@/lib/auth/mfa";

export function SecuritySection() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null); // facteur TOTP vérifié
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === "verified") ?? null;
    setFactorId(verified ? verified.id : null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  const startEnroll = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
      if (error || !data) throw new Error(error?.message ?? "enroll");
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("Impossible de démarrer l'activation.");
    } finally { setBusy(false); }
  };

  const confirmEnroll = async () => {
    if (!enrolling || !isValidTotpCode(code)) { setError("Code à 6 chiffres requis."); return; }
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
      if (error) throw new Error(error.message);
      await fetch("/api/auth/mfa-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "enrolled" }) });
      setEnrolling(null); setCode("");
      await refresh();
    } catch {
      setError("Code incorrect. Réessayez.");
    } finally { setBusy(false); }
  };

  const cancelEnroll = async () => {
    if (enrolling) { try { await supabase.auth.mfa.unenroll({ factorId: enrolling.id }); } catch { /* ignore */ } }
    setEnrolling(null); setCode(""); setError(null);
  };

  const disable = async () => {
    if (!factorId) return;
    if (!window.confirm("Désactiver la double authentification ?")) return;
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw new Error(error.message);
      await fetch("/api/auth/mfa-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "disabled" }) });
      await refresh();
    } catch {
      setError("Échec. Reconnectez-vous puis réessayez.");
    } finally { setBusy(false); }
  };

  const inputCls = "w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm";

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-6">
      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
        <ShieldCheck className="w-4 h-4" /> SÉCURITÉ — DOUBLE AUTHENTIFICATION
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      ) : factorId ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-400">✅ Double authentification activée.</p>
          <p className="text-xs text-zinc-500">Un code de votre appli d&apos;authentification sera demandé à chaque connexion.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={disable} disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-bold disabled:opacity-50">
            {busy ? "…" : "Désactiver"}
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">1. Scannez ce QR avec votre appli (Google / Microsoft Authenticator) :</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code 2FA" className="w-44 h-44 bg-white rounded-xl p-2" />
          <p className="text-xs text-zinc-500 break-all">Ou clé manuelle : <span className="font-mono text-zinc-300">{enrolling.secret}</span></p>
          <p className="text-sm text-zinc-300">2. Entrez le code à 6 chiffres affiché :</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" className={inputCls} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={confirmEnroll} disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm disabled:opacity-50">{busy ? "…" : "Confirmer"}</button>
            <button onClick={cancelEnroll} disabled={busy} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Protégez votre compte : en plus du mot de passe, un code temporaire de votre téléphone sera requis à la connexion.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={startEnroll} disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm disabled:opacity-50">
            {busy ? "…" : "Activer la double authentification"}
          </button>
        </div>
      )}
    </div>
  );
}
