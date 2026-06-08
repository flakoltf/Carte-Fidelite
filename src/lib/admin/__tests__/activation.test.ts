import { describe, it, expect } from "vitest";
import { computeActivation } from "../activation";

describe("computeActivation", () => {
  it("aucune étape faite → doneCount 0, isLive false", () => {
    const a = computeActivation({ hasCard: false, customerCount: 0, scanCount: 0 });
    expect(a.doneCount).toBe(0);
    expect(a.isLive).toBe(false);
    expect(a.steps.map((s) => s.done)).toEqual([false, false, false]);
  });

  it("toutes les étapes faites → doneCount 3, isLive true", () => {
    const a = computeActivation({ hasCard: true, customerCount: 5, scanCount: 12 });
    expect(a.doneCount).toBe(3);
    expect(a.isLive).toBe(true);
    expect(a.steps.every((s) => s.done)).toBe(true);
  });

  it("partiel (carte seule) → doneCount 1, isLive false", () => {
    const a = computeActivation({ hasCard: true, customerCount: 0, scanCount: 0 });
    expect(a.doneCount).toBe(1);
    expect(a.isLive).toBe(false);
    expect(a.steps.find((s) => s.key === "card")?.done).toBe(true);
    expect(a.steps.find((s) => s.key === "customer")?.done).toBe(false);
  });

  it("expose les 3 étapes attendues dans l'ordre card → customer → scan", () => {
    const a = computeActivation({ hasCard: false, customerCount: 1, scanCount: 0 });
    expect(a.steps.map((s) => s.key)).toEqual(["card", "customer", "scan"]);
    expect(a.steps.find((s) => s.key === "customer")?.done).toBe(true);
  });
});
