"use client";

import { WEEKDAY_KEYS, type BusinessHours, type DayHours } from "@/lib/merchant-config/hours";

// Éditeur d'horaires 7 jours — contrôlé. Chaque jour : ouvert/fermé + plage.
// La validation fine (HH:MM, open<close) est refaite côté serveur
// (normalizeBusinessHours) : ici on vise la simplicité d'usage.

const DAY_LABELS: Record<(typeof WEEKDAY_KEYS)[number], string> = {
  mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi",
  fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
};

export default function BusinessHoursEditor({
  value,
  onChange,
}: {
  value: BusinessHours;
  onChange: (next: BusinessHours) => void;
}) {
  const setDay = (key: (typeof WEEKDAY_KEYS)[number], day: DayHours) => {
    onChange({ ...value, [key]: day });
  };

  return (
    <div className="space-y-2">
      {WEEKDAY_KEYS.map((key) => {
        const day = value[key];
        const open = day !== null;
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-galet-ink">{DAY_LABELS[key]}</span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => setDay(key, e.target.checked ? { open: "09:00", close: "18:00" } : null)}
                className="accent-halo"
              />
              <span className="text-xs text-galet-ink">{open ? "Ouvert" : "Fermé"}</span>
            </label>
            {open && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.open}
                  onChange={(e) => setDay(key, { ...day, open: e.target.value })}
                  className="rounded-lg border border-line-warm bg-surface px-2 py-1"
                  aria-label={`${DAY_LABELS[key]} ouverture`}
                />
                <span className="text-galet-ink">–</span>
                <input
                  type="time"
                  value={day.close}
                  onChange={(e) => setDay(key, { ...day, close: e.target.value })}
                  className="rounded-lg border border-line-warm bg-surface px-2 py-1"
                  aria-label={`${DAY_LABELS[key]} fermeture`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
