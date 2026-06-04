import { describe, it, expect } from "vitest";
import { clientIp } from "../clientIp";

const h = (obj: Record<string, string>) => new Headers(obj);

describe("clientIp — IP de confiance (anti-spoofing X-Forwarded-For)", () => {
  it("préfère x-real-ip (posé par la plateforme) et IGNORE un X-Forwarded-For forgé", () => {
    // Un attaquant envoie X-Forwarded-For: 6.6.6.6 pour contourner le rate-limit.
    const headers = h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "1.2.3.4" });
    expect(clientIp(headers)).toBe("1.2.3.4"); // pas 6.6.6.6
  });

  it("sans x-real-ip, prend le DERNIER hop de X-Forwarded-For (pas le premier, spoofable)", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("ignore les segments vides du X-Forwarded-For", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, " }))).toBe("6.6.6.6");
  });

  it("aucun en-tête de proximité → 'unknown'", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("accepte un objet Request-like { headers }", () => {
    expect(clientIp({ headers: h({ "x-real-ip": "5.5.5.5" }) })).toBe("5.5.5.5");
  });

  it("un attaquant ne peut PAS forger une IP différente à chaque requête tant que x-real-ip est posé (clé de rate-limit stable)", () => {
    const a = clientIp(h({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "8.8.8.8" }));
    const b = clientIp(h({ "x-forwarded-for": "2.2.2.2", "x-real-ip": "8.8.8.8" }));
    expect(a).toBe(b); // même IP de confiance → même clé → le rate-limit s'applique
  });
});
