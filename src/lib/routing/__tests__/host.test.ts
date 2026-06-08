import { describe, it, expect } from "vitest";
import {
  normalizeHost,
  isPlatformHost,
  isMarketingHost,
  isAppHost,
  isAppPath,
  resolveHostRouting,
} from "@/lib/routing/host";

describe("normalizeHost", () => {
  it("retire le port et met en minuscules", () => {
    expect(normalizeHost("App.Halocard.ch:443")).toBe("app.halocard.ch");
  });
  it("gère null/undefined", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost(undefined)).toBe("");
  });
});

describe("classification des hôtes", () => {
  it("hôtes de plateforme (dev/preview)", () => {
    expect(isPlatformHost("localhost:3000")).toBe(true);
    expect(isPlatformHost("127.0.0.1")).toBe(true);
    expect(isPlatformHost("carte-fidelite-abc123.vercel.app")).toBe(true);
    expect(isPlatformHost("app.halocard.ch")).toBe(false);
  });
  it("hôte vitrine", () => {
    expect(isMarketingHost("halocard.ch")).toBe(true);
    expect(isMarketingHost("www.halocard.ch")).toBe(true);
    expect(isMarketingHost("app.halocard.ch")).toBe(false);
  });
  it("hôte app", () => {
    expect(isAppHost("app.halocard.ch")).toBe(true);
    expect(isAppHost("halocard.ch")).toBe(false);
  });
});

describe("isAppPath", () => {
  it("reconnaît les routes d'app", () => {
    expect(isAppPath("/dashboard")).toBe(true);
    expect(isAppPath("/dashboard/customers")).toBe(true);
    expect(isAppPath("/admin")).toBe(true);
    expect(isAppPath("/scan")).toBe(true);
    expect(isAppPath("/login")).toBe(true);
    expect(isAppPath("/signup")).toBe(true);
  });
  it("ne confond pas les préfixes partiels", () => {
    expect(isAppPath("/scanner")).toBe(false); // ≠ /scan
    expect(isAppPath("/")).toBe(false);
    expect(isAppPath("/cgu")).toBe(false);
  });
});

describe("resolveHostRouting", () => {
  it("ne touche jamais aux API (webhooks Wallet), même sur la vitrine", () => {
    expect(resolveHostRouting("halocard.ch", "/api/wallet/apple/v1/log")).toBeNull();
    expect(resolveHostRouting("app.halocard.ch", "/api/generate-apple-pass")).toBeNull();
  });

  it("ne filtre pas en dev/preview", () => {
    expect(resolveHostRouting("localhost:3000", "/dashboard")).toBeNull();
    expect(resolveHostRouting("carte-fidelite-x.vercel.app", "/dashboard")).toBeNull();
  });

  describe("sur le domaine vitrine (halocard.ch)", () => {
    it("bascule les routes d'app vers app.halocard.ch", () => {
      expect(resolveHostRouting("halocard.ch", "/dashboard")).toBe("https://app.halocard.ch/dashboard");
      expect(resolveHostRouting("www.halocard.ch", "/login")).toBe("https://app.halocard.ch/login");
      expect(resolveHostRouting("halocard.ch", "/dashboard/customers")).toBe(
        "https://app.halocard.ch/dashboard/customers"
      );
    });
    it("sert normalement les pages marketing", () => {
      expect(resolveHostRouting("halocard.ch", "/")).toBeNull();
      expect(resolveHostRouting("halocard.ch", "/cgu")).toBeNull();
      expect(resolveHostRouting("halocard.ch", "/contact")).toBeNull();
    });
  });

  describe("sur le domaine app (app.halocard.ch)", () => {
    it("redirige la racine vers /dashboard", () => {
      expect(resolveHostRouting("app.halocard.ch", "/")).toBe("/dashboard");
    });
    it("sert les routes d'app telles quelles", () => {
      expect(resolveHostRouting("app.halocard.ch", "/dashboard")).toBeNull();
      expect(resolveHostRouting("app.halocard.ch", "/login")).toBeNull();
    });
  });

  it("hôte inconnu : ne force rien", () => {
    expect(resolveHostRouting("exemple.com", "/dashboard")).toBeNull();
  });
});
