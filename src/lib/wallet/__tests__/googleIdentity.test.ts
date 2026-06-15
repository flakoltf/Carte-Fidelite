import { describe, expect, it } from "vitest";
import { googleIdentityModules } from "../googleIdentity";

describe("googleIdentityModules", () => {
  it("compose textModules (récompense, horaires) et linksModule (maps, tel sans espaces)", () => {
    const m = googleIdentityModules({
      rewardLabel: "Un café offert",
      todaysHours: "08:00 – 18:00",
      mapsUrl: "https://maps.google.com/?q=46.2,6.1",
      phone: "+41 22 000 00 00",
      address: "Quai des Bergues 23",
    });
    expect(m.textModulesData).toEqual([
      { id: "reward", header: "Récompense", body: "Un café offert" },
      { id: "hours", header: "Aujourd'hui", body: "08:00 – 18:00" },
    ]);
    expect(m.linksModuleData?.uris).toEqual([
      { uri: "https://maps.google.com/?q=46.2,6.1", description: "Itinéraire", id: "maps" },
      { uri: "tel:+41220000000", description: "Appeler", id: "phone" },
    ]);
  });

  it("omet les sections vides (jamais de module vide)", () => {
    expect(googleIdentityModules({})).toEqual({});
    expect(googleIdentityModules(undefined)).toEqual({});
    const onlyReward = googleIdentityModules({ rewardLabel: "X" });
    expect(onlyReward.textModulesData).toHaveLength(1);
    expect(onlyReward.linksModuleData).toBeUndefined();
  });

  it("ignore les valeurs blanches", () => {
    expect(googleIdentityModules({ rewardLabel: "  ", phone: null, mapsUrl: undefined })).toEqual({});
  });
});
