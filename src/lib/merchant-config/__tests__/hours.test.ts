import { describe, expect, it } from "vitest";
import {
  normalizeBusinessHours,
  hasAnyHours,
  weekdayKeyInTz,
  todaysHoursLabel,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHours,
} from "../hours";

// 2026-06-15 12:00 UTC = un lundi (Europe/Zurich = 14:00 CEST, toujours lundi).
const MON = new Date("2026-06-15T12:00:00Z");
// 2026-06-13 = samedi.
const SAT = new Date("2026-06-13T12:00:00Z");

const FULL: BusinessHours = {
  mon: { open: "08:00", close: "18:00" },
  tue: { open: "08:00", close: "18:00" },
  wed: { open: "08:00", close: "18:00" },
  thu: { open: "08:00", close: "18:00" },
  fri: { open: "08:00", close: "19:00" },
  sat: { open: "09:00", close: "17:00" },
  sun: null,
};

describe("normalizeBusinessHours", () => {
  it("accepte des plages HH:MM valides, rejette le reste vers null", () => {
    const h = normalizeBusinessHours({
      mon: { open: "08:00", close: "18:00" },
      tue: { open: "25:00", close: "18:00" }, // heure invalide
      wed: { open: "18:00", close: "08:00" }, // open >= close
      thu: { open: "08:00" }, // close manquant
      fri: "n'importe quoi",
      xxx: { open: "08:00", close: "18:00" }, // clé inconnue ignorée
    });
    expect(h.mon).toEqual({ open: "08:00", close: "18:00" });
    expect(h.tue).toBeNull();
    expect(h.wed).toBeNull();
    expect(h.thu).toBeNull();
    expect(h.fri).toBeNull();
  });

  it("entrée vide/non-objet → tous les jours fermés", () => {
    expect(normalizeBusinessHours(null)).toEqual(DEFAULT_BUSINESS_HOURS);
    expect(normalizeBusinessHours("x")).toEqual(DEFAULT_BUSINESS_HOURS);
  });
});

describe("weekdayKeyInTz", () => {
  it("résout le bon jour en Europe/Zurich", () => {
    expect(weekdayKeyInTz(MON)).toBe("mon");
    expect(weekdayKeyInTz(SAT)).toBe("sat");
  });

  it("bascule de jour selon le fuseau (samedi 23:30 UTC = déjà dimanche à Zurich)", () => {
    // Samedi 23:30 UTC = dimanche 01:30 CEST à Zurich.
    const lateSat = new Date("2026-06-13T23:30:00Z");
    expect(weekdayKeyInTz(lateSat, "Europe/Zurich")).toBe("sun");
    expect(weekdayKeyInTz(lateSat, "UTC")).toBe("sat");
  });
});

describe("todaysHoursLabel", () => {
  it("affiche la plage du jour", () => {
    expect(todaysHoursLabel(FULL, MON)).toBe("08:00 – 18:00");
    expect(todaysHoursLabel(FULL, SAT)).toBe("09:00 – 17:00");
  });

  it("jour fermé → 'Fermé aujourd'hui'", () => {
    const sun = new Date("2026-06-14T12:00:00Z");
    expect(todaysHoursLabel(FULL, sun)).toBe("Fermé aujourd'hui");
  });

  it("aucun horaire configuré → null (champ omis du pass)", () => {
    expect(todaysHoursLabel(DEFAULT_BUSINESS_HOURS, MON)).toBeNull();
    expect(hasAnyHours(DEFAULT_BUSINESS_HOURS)).toBe(false);
    expect(hasAnyHours(FULL)).toBe(true);
  });
});
