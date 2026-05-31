import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/analytics/csv";

describe("toCsv", () => {
  it("entêtes + lignes, échappe les virgules/guillemets", () => {
    const csv = toCsv(["nom", "visites"], [["Café, Léman", 12], ['Say "hi"', 3]]);
    expect(csv).toBe('nom,visites\n"Café, Léman",12\n"Say ""hi""",3');
  });
});
