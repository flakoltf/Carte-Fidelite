import { describe, it, expect } from "vitest";
import { STAGE_KEYS, STAGE_LABELS, FLAG_KEYS, FLAG_LABELS, STAGE_FAMILIES } from "@/lib/segments/types";

describe("registre des segments", () => {
  it("5 stades, chacun avec un label", () => {
    expect(STAGE_KEYS).toHaveLength(5);
    for (const k of STAGE_KEYS) expect(STAGE_LABELS[k].length).toBeGreaterThan(0);
  });
  it("2 étiquettes, chacune avec un label", () => {
    expect(FLAG_KEYS).toHaveLength(2);
    for (const k of FLAG_KEYS) expect(FLAG_LABELS[k].length).toBeGreaterThan(0);
  });
  it("libellés SANS jargon développeur — la clé interne joignable_push ne change pas, son texte si", () => {
    expect(FLAG_LABELS.joignable_push).toBe("Peut recevoir vos messages");
    expect(FLAG_LABELS.recompense_prete).toBe("Récompense prête");
    // Garde générale : aucun terme technique dans un libellé visible.
    for (const k of FLAG_KEYS) expect(FLAG_LABELS[k]).not.toMatch(/push|device|token|sync/i);
  });
  it("les familles couvrent les 5 stades, sans doublon", () => {
    const inFamilies = STAGE_FAMILIES.flatMap((f) => f.stages).sort();
    expect(inFamilies).toEqual([...STAGE_KEYS].sort());
  });
});
