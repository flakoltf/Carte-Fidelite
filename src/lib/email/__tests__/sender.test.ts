import { describe, it, expect } from "vitest";
import { formatSender } from "../sender";

describe("formatSender", () => {
  it("met le nom de la boutique devant l'adresse plateforme", () => {
    expect(formatSender("Café Lumen", "TonApp <noreply@tonapp.ch>")).toBe(
      "Café Lumen <noreply@tonapp.ch>",
    );
  });

  it("fonctionne quand la base est une adresse nue", () => {
    expect(formatSender("Café Lumen", "noreply@tonapp.ch")).toBe("Café Lumen <noreply@tonapp.ch>");
  });

  it("met le nom entre guillemets s'il contient une virgule", () => {
    expect(formatSender("Bar & Co, Genève", "noreply@tonapp.ch")).toBe(
      '"Bar & Co, Genève" <noreply@tonapp.ch>',
    );
  });

  it("nettoie les caractères qui casseraient l'en-tête (<, >, guillemets, retours ligne)", () => {
    expect(formatSender('Evil"<x>\n', "noreply@tonapp.ch")).toBe("Evilx <noreply@tonapp.ch>");
  });

  it("retombe sur l'adresse plateforme si le nom est vide", () => {
    expect(formatSender("", "noreply@tonapp.ch")).toBe("noreply@tonapp.ch");
    expect(formatSender("   ", "TonApp <noreply@tonapp.ch>")).toBe("noreply@tonapp.ch");
  });
});
