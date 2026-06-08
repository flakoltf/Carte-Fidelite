"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isValidTotpCode } from "@/lib/auth/mfa";

export default function MfaChallenge() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTotpCode(code)) { setError("Entrez un code à 6 chiffres."); return; }
    setBusy(true); setError("");
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) throw new Error("no-factor");
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: code.trim() });
      if (vErr) throw new Error(vErr.message);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: merchant } = await supabase.from("merchants").select("role").eq("user_id", user?.id).maybeSingle();
      router.push(merchant?.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Code incorrect. Réessayez.");
    } finally { setBusy(false); }
  };

  const cancel = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  return (
    <div className="min-h-screen bg-calcaire text-onyx flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-surface border border-line-warm rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="text-halo w-8 h-8" />
          </div>
          <h1 className="font-display text-2xl text-onyx">Vérification en deux étapes</h1>
          <p className="text-galet-ink mt-2 text-center">Entrez le code de votre appli d&apos;authentification.</p>
        </div>
        <form onSubmit={verify} className="bg-surface border border-line-warm rounded-3xl p-8 space-y-5 shadow-[0_8px_30px_-12px_rgba(14,15,17,0.18)]">
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoFocus placeholder="123456"
            className="w-full bg-calcaire border border-line-warm rounded-2xl py-3.5 px-4 text-center text-lg tracking-widest text-onyx placeholder:text-galet outline-none focus:ring-2 focus:ring-halo/25 focus:border-halo transition-all" />
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-3 rounded-2xl text-sm">{error}</div>}
          <button disabled={busy} className="w-full bg-halo text-white font-semibold py-4 rounded-2xl hover:bg-halo-600 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vérifier"}
          </button>
          <button type="button" onClick={cancel} className="w-full text-galet text-sm hover:text-onyx transition-colors">Annuler et se déconnecter</button>
        </form>
      </div>
    </div>
  );
}
