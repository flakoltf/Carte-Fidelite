"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError("Lien expiré ou invalide. Demandez un nouveau lien via « mot de passe oublié »."); return; }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Définissez votre mot de passe</h1>
        <input type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe (min. 8 caractères)"
          className="w-full rounded-lg border px-3 py-2" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-halo text-white py-2 font-semibold disabled:opacity-50">
          {loading ? "…" : "Activer mon compte"}
        </button>
      </form>
    </div>
  );
}
