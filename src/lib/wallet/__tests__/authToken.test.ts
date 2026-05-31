import { describe, it, expect } from "vitest";
import { parseApplePassAuth } from "@/lib/wallet/authToken";

describe("parseApplePassAuth", () => {
  it("extrait le token du header ApplePass", () => {
    expect(parseApplePassAuth("ApplePass abc123")).toBe("abc123");
  });
  it("renvoie null si header absent ou mauvais schéma", () => {
    expect(parseApplePassAuth(null)).toBeNull();
    expect(parseApplePassAuth("Bearer xyz")).toBeNull();
  });
});
