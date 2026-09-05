import type { SegmentMember } from "../contracts";
import {
  buildClientRows,
  filterClientRows,
  formatLastVisit,
  initials,
  visitsLabel,
} from "../model";

const NOW = new Date("2026-09-05T10:00:00.000Z");

const member = (over: Partial<SegmentMember> & { customerId: string }): SegmentMember => ({
  name: "Client",
  lastScan: null,
  visits: 0,
  stamps: 0,
  ...over,
});

describe("buildClientRows — fusion des segments serveur en une liste", () => {
  it("attache à chaque client le segment d'où il vient", () => {
    const rows = buildClientRows({
      vip: [member({ customerId: "a", name: "Anna Roux", visits: 12 })],
      nouveau: [member({ customerId: "b", name: "Bruno Ky", visits: 1 })],
    });
    expect(rows.map((r) => [r.id, r.stage])).toEqual([
      ["a", "vip"],
      ["b", "nouveau"],
    ]);
  });

  it("trie par dernier passage décroissant, les « jamais venus » en fin, puis par nom", () => {
    const rows = buildClientRows({
      regulier: [
        member({ customerId: "old", name: "Zoé", lastScan: "2026-08-01T09:00:00.000Z" }),
        member({ customerId: "never2", name: "Yann" }),
        member({ customerId: "recent", name: "Marc", lastScan: "2026-09-04T09:00:00.000Z" }),
      ],
      inactif: [member({ customerId: "never1", name: "Alice" })],
    });
    expect(rows.map((r) => r.id)).toEqual(["recent", "old", "never1", "never2"]);
  });

  it("garde les visites et le nom tels que renvoyés par le serveur (aucun recalcul)", () => {
    const [row] = buildClientRows({
      vip: [member({ customerId: "a", name: "  Anna Roux ", visits: 12, stamps: 9 })],
    });
    expect(row).toMatchObject({ name: "Anna Roux", visits: 12, initials: "AR" });
  });

  it("liste vide quand aucun segment n'a de membre", () => {
    expect(buildClientRows({})).toEqual([]);
  });
});

describe("filterClientRows — recherche par nom et filtre par segment", () => {
  const rows = buildClientRows({
    vip: [member({ customerId: "a", name: "Anna Roux" })],
    nouveau: [member({ customerId: "b", name: "Bruno Ky" }), member({ customerId: "c", name: "Élodie Bé" })],
  });

  it("sans requête ni segment : tout le monde", () => {
    expect(filterClientRows(rows, "", "all")).toHaveLength(3);
  });

  it("recherche insensible à la casse et aux accents, sur une partie du nom", () => {
    expect(filterClientRows(rows, "  anNA", "all").map((r) => r.id)).toEqual(["a"]);
    expect(filterClientRows(rows, "elodie", "all").map((r) => r.id)).toEqual(["c"]);
  });

  it("filtre par segment (les mêmes clés que le web)", () => {
    expect(filterClientRows(rows, "", "nouveau").map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterClientRows(rows, "", "vip").map((r) => r.id)).toEqual(["a"]);
  });

  it("combine recherche et segment", () => {
    expect(filterClientRows(rows, "b", "nouveau").map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterClientRows(rows, "anna", "nouveau")).toEqual([]);
  });
});

describe("formatLastVisit — dernier passage lisible au comptoir", () => {
  it("jamais venu", () => {
    expect(formatLastVisit(null, NOW)).toBe("Jamais venu");
  });

  it("aujourd'hui, hier, il y a quelques jours", () => {
    expect(formatLastVisit("2026-09-05T08:30:00.000Z", NOW)).toBe("Aujourd'hui");
    expect(formatLastVisit("2026-09-04T18:00:00.000Z", NOW)).toBe("Hier");
    expect(formatLastVisit("2026-09-02T18:00:00.000Z", NOW)).toBe("Il y a 3 jours");
  });

  it("au-delà d'une semaine : la date, en français, sans l'année si c'est la même", () => {
    expect(formatLastVisit("2026-08-12T18:00:00.000Z", NOW)).toBe("12 août");
    expect(formatLastVisit("2025-12-24T18:00:00.000Z", NOW)).toBe("24 décembre 2025");
  });

  it("date illisible → jamais venu plutôt qu'un « Invalid Date »", () => {
    expect(formatLastVisit("n'importe quoi", NOW)).toBe("Jamais venu");
  });
});

describe("initials / visitsLabel", () => {
  it("initiales : deux lettres max, en capitales, robustes aux noms courts", () => {
    expect(initials("Anna Roux")).toBe("AR");
    expect(initials("jean-luc de la tour")).toBe("JT");
    expect(initials("Cléo")).toBe("C");
    expect(initials("   ")).toBe("?");
  });

  it("visites : accord du pluriel, zéro explicite", () => {
    expect(visitsLabel(0)).toBe("Aucune visite");
    expect(visitsLabel(1)).toBe("1 visite");
    expect(visitsLabel(7)).toBe("7 visites");
  });
});
