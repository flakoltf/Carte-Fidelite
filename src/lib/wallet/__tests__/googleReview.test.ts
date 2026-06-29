import { describe, expect, it } from "vitest";
import { isValidPlaceId, reviewUrlFor, shouldShowReview } from "../googleReview";
import { identityFromMerchant } from "../identityFromMerchant";
import { buildPassJson } from "../passJson";
import { googleIdentityModules } from "../googleIdentity";

const PLACE = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const MON = new Date("2026-06-15T12:00:00Z");

describe("googleReview — validation + URL", () => {
  it("valide le préfixe ChIJ, rejette le reste", () => {
    expect(isValidPlaceId(PLACE)).toBe(true);
    expect(isValidPlaceId("not-a-place")).toBe(false);
    expect(isValidPlaceId("")).toBe(false);
    expect(isValidPlaceId(null)).toBe(false);
  });
  it("construit l'URL writereview, null si invalide", () => {
    expect(reviewUrlFor(PLACE)).toBe(`https://search.google.com/local/writereview?placeid=${PLACE}`);
    expect(reviewUrlFor("x")).toBeNull();
  });
  it("shouldShowReview : reward-ready ET place id valide", () => {
    expect(shouldShowReview(true, PLACE)).toBe(true);
    expect(shouldShowReview(false, PLACE)).toBe(false); // pas reward-ready
    expect(shouldShowReview(true, null)).toBe(false); // pas de place id
  });
});

describe("F2 — présence/absence du lien avis sur le pass", () => {
  const row = { google_place_id: PLACE };

  it("reward-ready : lien présent sur Apple ET Google, en tête", () => {
    const id = identityFromMerchant(row, MON, { rewardReady: true });
    const p = buildPassJson({
      cardId: "c", customerName: "A", stamps: 10, stampGoal: 10,
      orgName: "Café", backgroundColor: "rgb(0,0,0)",
      passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "s",
      identity: id,
    });
    expect(p.storeCard.backFields.find((f) => f.key === "review")?.value).toContain("writereview?placeid=");
    const g = googleIdentityModules(id);
    expect(g.linksModuleData?.uris[0].id).toBe("review");
  });

  it("PAS reward-ready : aucun lien avis (disparaît à la récompense suivante)", () => {
    const id = identityFromMerchant(row, MON, { rewardReady: false });
    const p = buildPassJson({
      cardId: "c", customerName: "A", stamps: 3, stampGoal: 10,
      orgName: "Café", backgroundColor: "rgb(0,0,0)",
      passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "s",
      identity: id,
    });
    expect(p.storeCard.backFields.find((f) => f.key === "review")).toBeUndefined();
    expect(googleIdentityModules(id).linksModuleData).toBeUndefined();
  });

  it("place id absent : pas de lien même reward-ready", () => {
    const id = identityFromMerchant({}, MON, { rewardReady: true });
    expect(id.reviewUrl).toBeNull();
  });
});
