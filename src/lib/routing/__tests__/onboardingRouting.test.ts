import { describe, expect, it } from "vitest";
import { isAppPath, resolveHostRouting } from "@/lib/routing/host";

// Extension Agent C : /onboarding appartient à l'application authentifiée.
// (Complète host.test.ts sans le modifier — territoire partagé, additif.)
describe("routage /onboarding (wizard self-service)", () => {
  it("/onboarding est une route d'app", () => {
    expect(isAppPath("/onboarding")).toBe(true);
    expect(isAppPath("/onboarding/etape")).toBe(true);
  });

  it("ne confond pas les préfixes partiels", () => {
    expect(isAppPath("/onboard")).toBe(false);
    expect(isAppPath("/onboardingue")).toBe(false);
  });

  it("demandé sur la vitrine → bascule vers app.halocard.ch", () => {
    expect(resolveHostRouting("halocard.ch", "/onboarding")).toBe("https://app.halocard.ch/onboarding");
  });

  it("/signup reste une route d'app (comportement existant intact)", () => {
    expect(isAppPath("/signup")).toBe(true);
    expect(resolveHostRouting("halocard.ch", "/signup")).toBe("https://app.halocard.ch/signup");
  });
});
