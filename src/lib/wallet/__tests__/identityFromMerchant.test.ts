import { describe, expect, it } from "vitest";
import { identityFromMerchant, mapsUrlFor } from "../identityFromMerchant";

const MON = new Date("2026-06-15T12:00:00Z"); // lundi

describe("mapsUrlFor", () => {
  it("priorité aux coordonnées", () => {
    expect(mapsUrlFor("Rue X", 46.2, 6.1)).toBe("https://www.google.com/maps/search/?api=1&query=46.2,6.1");
  });
  it("repli sur l'adresse encodée", () => {
    expect(mapsUrlFor("Quai des Bergues 23, Genève", null, null)).toContain("query=Quai%20des%20Bergues");
  });
  it("rien → null", () => {
    expect(mapsUrlFor(null, null, null)).toBeNull();
  });
});

describe("identityFromMerchant", () => {
  it("mappe tous les champs + calcule horaires du jour + lien maps", () => {
    const id = identityFromMerchant(
      {
        reward_label: "Un café offert",
        address: "Quai des Bergues 23",
        phone: "+41 22 000 00 00",
        business_hours: { mon: { open: "08:00", close: "18:00" } },
        latitude: 46.2,
        longitude: 6.1,
      },
      MON
    );
    expect(id.rewardLabel).toBe("Un café offert");
    expect(id.phone).toBe("+41 22 000 00 00");
    expect(id.todaysHours).toBe("08:00 – 18:00");
    expect(id.mapsUrl).toBe("https://www.google.com/maps/search/?api=1&query=46.2,6.1");
  });

  it("ligne nulle → identité vide", () => {
    expect(identityFromMerchant(null, MON)).toEqual({});
  });

  it("horaires absents → todaysHours null (champ omis)", () => {
    const id = identityFromMerchant({ reward_label: "X" }, MON);
    expect(id.todaysHours).toBeNull();
    expect(id.mapsUrl).toBeNull();
  });
});
