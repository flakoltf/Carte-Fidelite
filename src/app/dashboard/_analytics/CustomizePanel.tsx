"use client";
import { useState } from "react";
import { WIDGETS, type DashboardConfig, type WidgetConfigItem } from "@/lib/analytics/types";

export function CustomizePanel({ config, onClose, onSaved }: {
  config: DashboardConfig; onClose: () => void; onSaved: (c: DashboardConfig) => void;
}) {
  const [items, setItems] = useState<WidgetConfigItem[]>(config.widgets);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const copy = [...items]; [copy[i], copy[j]] = [copy[j], copy[i]];
    setItems(copy.map((w, idx) => ({ ...w, order: idx })));
  };
  const toggle = (i: number) => setItems(items.map((w, idx) => idx === i ? { ...w, visible: !w.visible } : w));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setSaveError(null);
    try {
      const next = { widgets: items };
      const res = await fetch("/api/dashboard-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error("save failed");
      onSaved(next); onClose();
    } catch {
      setSaveError("Impossible de sauvegarder. Réessayez.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-80 bg-zinc-950 border-l border-zinc-800 p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Personnaliser</h3>
        <ul className="space-y-2">
          {items.map((w, i) => (
            <li key={w.key} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={w.visible} onChange={() => toggle(i)} />
                {WIDGETS[w.key].label}
              </label>
              <span className="flex gap-1">
                <button onClick={() => move(i, -1)} className="text-zinc-500 hover:text-white">↑</button>
                <button onClick={() => move(i, 1)} className="text-zinc-500 hover:text-white">↓</button>
              </span>
            </li>
          ))}
        </ul>
        <button onClick={save} disabled={saving}
          className="mt-4 w-full bg-emerald-500 text-black rounded-xl py-2 font-bold disabled:opacity-50">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}
      </div>
    </div>
  );
}
