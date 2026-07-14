import { describe, it, expect } from "vitest";
import { designToRow, rowToDesign } from "../repository";
import type { CardDesign } from "../types";

const design: CardDesign = {
  colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
  programName: "Café du Léman",
  logo: {},
  fields: [{ id: "p", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 }],
  barcode: { type: "QR", source: "card_token" },
  cardType: "points",
  stamps: { goal: 8, icon: "☕", shape: "circle" },
};

describe("repository — designToRow persiste card_type & stamps (unification des mappers)", () => {
  it("écrit card_type et stamps", () => {
    const row = designToRow(design);
    expect(row.card_type).toBe("points");
    expect(row.stamps).toEqual({ goal: 8, icon: "☕", shape: "circle" });
  });

  it("card_type défaut 'stamps' quand absent ; stamps null", () => {
    const row = designToRow({ ...design, cardType: undefined, stamps: undefined });
    expect(row.card_type).toBe("stamps");
    expect(row.stamps).toBeNull();
  });

  it("round-trip designToRow → rowToDesign conserve card_type et stamps", () => {
    const back = rowToDesign({ ...designToRow(design), google_class_id: null });
    expect(back.cardType).toBe("points");
    expect(back.stamps).toEqual({ goal: 8, icon: "☕", shape: "circle" });
  });
});
