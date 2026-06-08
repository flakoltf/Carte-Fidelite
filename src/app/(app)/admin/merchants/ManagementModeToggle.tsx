"use client";
import { useState } from "react";

export default function ManagementModeToggle({
  merchantId,
  initial,
}: {
  merchantId: string;
  initial: boolean;
}) {
  const [managed, setManaged] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await fetch(`/api/admin/merchants/${merchantId}/management-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managed: !managed }),
    });
    if (r.ok) setManaged(!managed);
    setBusy(false);
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title="Géré par nous (étiquette)"
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors disabled:opacity-60 ${
        managed
          ? "bg-halo/10 border-halo/30 text-halo"
          : "bg-surface border-line-warm text-galet-ink hover:bg-calcaire"
      }`}
    >
      {managed ? "● géré par nous" : "○ géré par lui"}
    </button>
  );
}
