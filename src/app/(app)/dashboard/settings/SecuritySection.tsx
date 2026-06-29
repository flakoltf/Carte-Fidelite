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

  const inputCls = "w-full bg-surface border border-line-warm rounded-2xl py-3 px-4 text-sm text-onyx placeholder:text-galet-ink focus:border-halo outline-none";

  return (
    <div className="bg-surface border border-line-warm rounded-3xl p-8 space-y-6 shadow-sm">
      <div className="flex items-center gap-2 text-halo font-bold text-sm">
        <ShieldCheck className="w-4 h-4" /> SÉCURITÉ — DOUBLE AUTHENTIFICATION
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-galet" />
      ) : factorId ? (
        <div className="space-y-3">
          <p className="text-sm text-halo">✅ Double authentification activée.</p>
          <p className="text-xs text-galet-ink">Un code de votre appli d&apos;authentification sera demandé à chaque connexion.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={disable} disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-sm font-bold disabled:opacity-50">
            {busy ? "…" : "Désactiver"}
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <p className="text-sm text-galet-ink">1. Scannez ce QR avec votre appli (Google / Microsoft Authenticator) :</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code 2FA" className="w-44 h-44 bg-white rounded-xl p-2" />
          <p className="text-xs text-galet-ink break-all">Ou clé manuelle : <span className="font-mono text-galet-ink">{enrolling.secret}</span></p>
          <p className="text-sm text-galet-ink">2. Entrez le code à 6 chiffres affiché :</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" className={inputCls} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={confirmEnroll} disabled={busy} className="px-5 py-2.5 rounded-xl bg-halo text-white font-bold text-sm disabled:opacity-50 hover:bg-halo-600 transition-all">{busy ? "…" : "Confirmer"}</button>
            <button onClick={cancelEnroll} disabled={busy} className="px-4 py-2.5 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink text-sm">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-galet-ink">Protégez votre compte : en plus du mot de passe, un code temporaire de votre téléphone sera requis à la connexion.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={startEnroll} disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-halo text-white font-bold text-sm disabled:opacity-50 hover:bg-halo-600 transition-all">
            {busy ? "…" : "Activer la double authentification"}
          </button>
        </div>
      )}
    </div>
  );
}
