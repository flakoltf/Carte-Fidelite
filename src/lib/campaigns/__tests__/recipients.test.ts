import { describe, it, expect } from "vitest";
import { selectRecurringRecipients } from "../recipients";

const now = new Date("2026-06-30T09:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("selectRecurringRecipients", () => {
  it("inclut une carte jamais notifiée", () => {
    expect(selectRecurringRecipients(["a"], new Map(), 30, now)).toEqual(["a"]);
  });
  it("exclut une carte notifiée hier (cooldown 30)", () => {
    const last = new Map([["a", daysAgo(1)]]);
    expect(selectRecurringRecipients(["a"], last, 30, now)).toEqual([]);
  });
  it("ré-inclut une carte notifiée il y a 31 jours (cooldown 30)", () => {
    const last = new Map([["a", daysAgo(31)]]);
    expect(selectRecurringRecipients(["a"], last, 30, now)).toEqual(["a"]);
  });
  it("filtre un mélange et préserve l'ordre", () => {
    const last = new Map([["b", daysAgo(2)], ["c", daysAgo(40)]]);
    expect(selectRecurringRecipients(["a", "b", "c"], last, 30, now)).toEqual(["a", "c"]);
  });
  it("renvoie [] pour une audience vide", () => {
    expect(selectRecurringRecipients([], new Map(), 30, now)).toEqual([]);
  });
});
