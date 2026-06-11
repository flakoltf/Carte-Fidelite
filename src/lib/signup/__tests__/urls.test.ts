import { describe, expect, it } from "vitest";
import { resolveAppBaseUrl, buildConfirmUrl, PROD_APP_BASE_URL } from "../urls";

describe("resolveAppBaseUrl (anti-forgerie du header Host)", () => {
  it("en production, ignore l'origine de la requête (Host forgeable)", () => {
    expect(
      resolveAppBaseUrl({ envBaseUrl: undefined, nodeEnv: "production", requestOrigin: "https://evil.example" })
    ).toBe(PROD_APP_BASE_URL);
  });

  it("APP_BASE_URL https prime partout", () => {
    expect(
      resolveAppBaseUrl({ envBaseUrl: "https://preview.halocard.ch/", nodeEnv: "production", requestOrigin: "https://x" })
    ).toBe("https://preview.halocard.ch");
  });

  it("APP_BASE_URL non-https (sauf localhost) est ignorée", () => {
    expect(
      resolveAppBaseUrl({ envBaseUrl: "http://evil.example", nodeEnv: "production", requestOrigin: "https://x" })
    ).toBe(PROD_APP_BASE_URL);
    expect(
      resolveAppBaseUrl({ envBaseUrl: "http://localhost:3002", nodeEnv: "development", requestOrigin: "https://x" })
    ).toBe("http://localhost:3002");
  });

  it("en dev, retombe sur l'origine de la requête", () => {
    expect(
      resolveAppBaseUrl({ envBaseUrl: undefined, nodeEnv: "development", requestOrigin: "http://localhost:3002" })
    ).toBe("http://localhost:3002");
  });
});

describe("buildConfirmUrl", () => {
  it("construit l'URL de confirmation avec jeton haché et type whitelisté", () => {
    const url = new URL(buildConfirmUrl("https://app.halocard.ch", "abc123"));
    expect(url.pathname).toBe("/signup/confirm");
    expect(url.searchParams.get("token_hash")).toBe("abc123");
    expect(url.searchParams.get("type")).toBe("magiclink");
  });
});
