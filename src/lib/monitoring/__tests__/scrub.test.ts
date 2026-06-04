import { describe, it, expect } from "vitest";
import { scrubSentryEvent } from "../scrub";

describe("scrubSentryEvent", () => {
  it("retire les en-têtes sensibles (Authorization, Cookie) quelle que soit la casse", () => {
    const e = {
      request: { headers: { Authorization: "Bearer x", Cookie: "sid=abc", "User-Agent": "UA" } },
    };
    expect(scrubSentryEvent(e).request.headers).toEqual({ "User-Agent": "UA" });
  });

  it("masque l'email de l'utilisateur, garde l'id", () => {
    const e = { user: { id: "u1", email: "john@example.com" } };
    expect(scrubSentryEvent(e).user).toEqual({ id: "u1", email: "j***@e***.com" });
  });

  it("masque les données perso dans extra, garde le reste", () => {
    const e = { extra: { customer_name: "John Doe", count: 3 } };
    expect(scrubSentryEvent(e).extra).toEqual({ customer_name: "J*** D***", count: 3 });
  });

  it("ne mute pas l'événement d'origine", () => {
    const e = { user: { email: "john@example.com" } };
    scrubSentryEvent(e);
    expect(e.user.email).toBe("john@example.com");
  });

  it("laisse passer un événement vide / null sans planter", () => {
    expect(scrubSentryEvent(null)).toBe(null);
    expect(scrubSentryEvent({})).toEqual({});
  });
});
