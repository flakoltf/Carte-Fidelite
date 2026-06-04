import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/analytics/csv";

describe("toCsv", () => {
  it("entêtes + lignes, échappe les virgules/guillemets", () => {
    const csv = toCsv(["nom", "visites"], [["Café, Léman", 12], ['Say "hi"', 3]]);
    expect(csv).toBe('nom,visites\n"Café, Léman",12\n"Say ""hi""",3');
  });

  it("anti formula-injection : préfixe d'une apostrophe les chaînes commençant par = + - @", () => {
    const csv = toCsv(["v"], [["=HYPERLINK(\"http://evil\")"], ["+1"], ["-cmd"], ["@x"]]);
    expect(csv).toBe("v\n\"'=HYPERLINK(\"\"http://evil\"\")\"\n'+1\n'-cmd\n'@x");
  });

  it("ne préfixe PAS les nombres (un nombre négatif reste un nombre)", () => {
    expect(toCsv(["n"], [[-5], [42]])).toBe("n\n-5\n42");
  });

  it("ne touche pas une chaîne sûre", () => {
    expect(toCsv(["n"], [["Jean"]])).toBe("n\nJean");
  });
});
