"use client";
import { useState } from "react";
import type { PlanKey } from "@/lib/billing/plans";

export function ChoosePlanButton({ plan, label }: { plan: PlanKey; label: string }) {
  const [state, setState] = useState<"idle" | "loading" | "soon">("idle");
  async function go() {
    setState("loading");
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.status === 503) { setState("soon"); return; }
    const data = await res.json().catch(() => ({}));
    if (data.url) { window.location.href = data.url; return; }
    setState("idle");
  }
  if (state === "soon") return <span className="block text-center text-galet-ink py-3">Bientôt disponible</span>;
  return (
    <button onClick={go} disabled={state === "loading"}
      className="w-full rounded-xl bg-halo text-white py-3 font-bold disabled:opacity-50">
      {state === "loading" ? "…" : label}
    </button>
  );
}
