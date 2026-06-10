import { describe, expect, it } from "vitest";
import { mergeActivityFeed, relativeTime } from "../activity";

const NOW = new Date("2026-06-10T12:00:00Z");

describe("mergeActivityFeed", () => {
  it("fusionne scans et inscriptions, trié du plus récent au plus ancien", () => {
    const feed = mergeActivityFeed(
      [{ scanned_at: "2026-06-10T10:00:00Z", who: "Léa M." }],
      [
        { created_at: "2026-06-10T11:00:00Z", who: "Hugo P." },
        { created_at: "2026-06-09T08:00:00Z", who: "Inès K." },
      ]
    );
    expect(feed.map((e) => `${e.type}:${e.who}`)).toEqual([
      "signup:Hugo P.",
      "scan:Léa M.",
      "signup:Inès K.",
    ]);
  });

  it("respecte la limite et tolère noms manquants + dates invalides", () => {
    const feed = mergeActivityFeed(
      [
        { scanned_at: "2026-06-10T10:00:00Z", who: null },
        { scanned_at: "invalide", who: "X" },
      ],
      Array.from({ length: 10 }, (_, i) => ({
        created_at: `2026-06-0${(i % 9) + 1}T00:00:00Z`,
        who: `C${i}`,
      })),
      5
    );
    expect(feed).toHaveLength(5);
    expect(feed[0].who).toBe("Client"); // nom manquant → fallback
    expect(feed.some((e) => e.who === "X")).toBe(false); // date invalide écartée
  });

  it("vide → vide (l'empty state de l'UI prend le relais)", () => {
    expect(mergeActivityFeed([], [])).toEqual([]);
  });
});

describe("relativeTime", () => {
  it("gradue minutes / heures / jours en français", () => {
    expect(relativeTime("2026-06-10T11:59:40Z", NOW)).toBe("à l'instant");
    expect(relativeTime("2026-06-10T11:30:00Z", NOW)).toBe("il y a 30 min");
    expect(relativeTime("2026-06-10T07:00:00Z", NOW)).toBe("il y a 5 h");
    expect(relativeTime("2026-06-09T07:00:00Z", NOW)).toBe("hier");
    expect(relativeTime("2026-06-05T07:00:00Z", NOW)).toBe("il y a 5 j");
  });
});
