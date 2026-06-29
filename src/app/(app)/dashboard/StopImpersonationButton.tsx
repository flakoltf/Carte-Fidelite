"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StopImpersonationButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function stop() {
    setBusy(true);
    await fetch("/api/admin/impersonate/stop", { method: "POST" });
    router.push("/admin");
  }
  return (
    <button onClick={stop} disabled={busy} style={{ background: "#fff", color: "var(--color-halo)", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>
      {busy ? "…" : "Quitter"}
    </button>
  );
}
