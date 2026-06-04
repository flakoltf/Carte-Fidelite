"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManageAsButton({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    const r = await fetch("/api/admin/impersonate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId }),
    });
    if (r.ok) router.push("/dashboard");
    else setBusy(false);
  }
  return (
    <button
      onClick={start}
      disabled={busy}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-halo text-white hover:bg-halo-600 transition-colors disabled:opacity-60"
    >
      {busy ? "…" : "Gérer en tant que"}
    </button>
  );
}
