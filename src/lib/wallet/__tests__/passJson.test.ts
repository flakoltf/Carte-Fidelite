import { describe, it, expect } from "vitest";
import { buildPassJson } from "@/lib/wallet/passJson";

const base = {
  cardId: "card-1", customerName: "Alice", stamps: 3,
  orgName: "Café", backgroundColor: "rgb(0,0,0)",
  passTypeIdentifier: "pass.x", teamIdentifier: "T1", barcodeMessage: "sig",
};

describe("buildPassJson", () => {
  it("inclut webServiceURL + authenticationToken quand fournis", () => {
    const p = buildPassJson({ ...base, webServiceURL: "https://x/api/wallet/apple", authToken: "tok", message: "Promo" });
    expect(p.webServiceURL).toBe("https://x/api/wallet/apple");
    expect(p.authenticationToken).toBe("tok");
    const msg = p.storeCard.backFields.find((f) => f.key === "message")!;
    expect(msg.value).toBe("Promo");
    expect(msg.changeMessage).toBe("%@");
    expect(p.serialNumber).toBe("card-1");
  });
  it("sans authToken : pas de webServiceURL (pass non push-ready)", () => {
    const p = buildPassJson(base);
    expect(p.webServiceURL).toBeUndefined();
    expect(p.authenticationToken).toBeUndefined();
  });
});

describe("buildPassJson — objectif de carte", () => {
  const base = {
    cardId: "c", customerName: "A", stamps: 3, orgName: "Café",
    backgroundColor: "rgb(0,0,0)", passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "sig",
  };
  it("stampGoal fourni -> 'stamps / stampGoal'", () => {
    const p = buildPassJson({ ...base, stampGoal: 8 });
    const f = p.storeCard.primaryFields.find((x) => x.key === "stamps");
    expect(f?.value).toBe("3 / 8");
  });
  it("stampGoal absent -> défaut 10", () => {
    const p = buildPassJson(base);
    const f = p.storeCard.primaryFields.find((x) => x.key === "stamps");
    expect(f?.value).toBe("3 / 10");
  });
});

describe("buildPassJson — locations (proximité)", () => {
  const base = {
    cardId: "c", customerName: "A", stamps: 3, stampGoal: 10, orgName: "Café",
    backgroundColor: "rgb(0,0,0)", passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "sig",
  };
  it("locations fournies -> champ top-level locations", () => {
    const p = buildPassJson({ ...base, locations: [{ latitude: 46.2, longitude: 6.14, relevantText: "près" }] });
    expect((p as { locations?: unknown[] }).locations).toEqual([{ latitude: 46.2, longitude: 6.14, relevantText: "près" }]);
  });
  it("sans locations -> pas de champ locations", () => {
    const p = buildPassJson(base);
    expect((p as { locations?: unknown[] }).locations).toBeUndefined();
  });
});
