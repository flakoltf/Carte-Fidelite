import { describe, expect, it } from "vitest";
import { identityFromMerchant, type MerchantIdentityRow } from "../identityFromMerchant";
import { buildPassJson } from "../passJson";
import { googleIdentityModules } from "../googleIdentity";

// Test d'intégration F1 : une LIGNE merchants (écrite indifféremment par le
// formulaire settings OU le studio — même colonnes) produit la même identité
// sur les DEUX wallets. Source unique → rendu cohérent, pas de divergence.

const MON = new Date("2026-06-15T12:00:00Z"); // lundi

const merchantRow: MerchantIdentityRow = {
  reward_label: "Un café offert",
  address: "Quai des Bergues 23, Genève",
  phone: "+41 22 000 00 00",
  business_hours: { mon: { open: "08:00", close: "18:00" }, sun: null },
  latitude: 46.209,
  longitude: 6.1455,
};

const appleBase = {
  cardId: "c1", customerName: "Alice", stamps: 7, stampGoal: 10,
  orgName: "Café du Rhône", backgroundColor: "rgb(0,0,0)",
  passTypeIdentifier: "pass.x", teamIdentifier: "T1", barcodeMessage: "sig",
};

describe("F1 — identité de bout en bout (ligne merchants → pass)", () => {
  const identity = identityFromMerchant(merchantRow, MON);

  it("Apple : récompense + horaires/adresse/itinéraire/téléphone sur le pass", () => {
    const p = buildPassJson({ ...appleBase, identity });
    expect(p.storeCard.secondaryFields.find((f) => f.key === "reward")?.value).toBe("Un café offert");
    const back = Object.fromEntries(p.storeCard.backFields.map((f) => [f.key, f.value]));
    expect(back.hours).toBe("08:00 – 18:00");
    expect(back.address).toBe("Quai des Bergues 23, Genève");
    expect(back.phone).toBe("+41 22 000 00 00");
    expect(back.maps).toContain("query=46.209,6.1455");
  });

  it("Google : mêmes données en textModules + linksModule", () => {
    const m = googleIdentityModules(identity);
    expect(m.textModulesData).toEqual([
      { id: "reward", header: "Récompense", body: "Un café offert" },
      { id: "hours", header: "Aujourd'hui", body: "08:00 – 18:00" },
    ]);
    expect(m.linksModuleData?.uris.map((u) => u.id)).toEqual(["maps", "phone"]);
    expect(m.linksModuleData?.uris.find((u) => u.id === "phone")?.uri).toBe("tel:+41220000000");
  });

  it("cohérence inter-wallet : la récompense et les horaires sont identiques côté Apple et Google", () => {
    const p = buildPassJson({ ...appleBase, identity });
    const g = googleIdentityModules(identity);
    const appleReward = p.storeCard.secondaryFields.find((f) => f.key === "reward")?.value;
    const googleReward = g.textModulesData?.find((t) => t.id === "reward")?.body;
    expect(appleReward).toBe(googleReward);
    const appleHours = p.storeCard.backFields.find((f) => f.key === "hours")?.value;
    const googleHours = g.textModulesData?.find((t) => t.id === "hours")?.body;
    expect(appleHours).toBe(googleHours);
  });

  it("dimanche fermé → 'Fermé aujourd'hui' sur les deux wallets", () => {
    const sun = new Date("2026-06-14T12:00:00Z");
    const idSun = identityFromMerchant(merchantRow, sun);
    const p = buildPassJson({ ...appleBase, identity: idSun });
    const g = googleIdentityModules(idSun);
    expect(p.storeCard.backFields.find((f) => f.key === "hours")?.value).toBe("Fermé aujourd'hui");
    expect(g.textModulesData?.find((t) => t.id === "hours")?.body).toBe("Fermé aujourd'hui");
  });
});
