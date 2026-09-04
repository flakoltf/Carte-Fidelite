import { describe, it, expect } from "vitest";
import { LEAD_SECTORS, validateLeadForm } from "../leadFormValidation";

// Formulaire public /demarrer : validation serveur stricte (jamais confiance
// au client) + honeypot anti-bots. Fonction pure, testée sans réseau.

function base(): Record<string, unknown> {
  return {
    business: "Boulangerie du Bourg",
    sector: "Boulangerie",
    contactName: "Anne Favre",
    email: "anne@bourg.ch",
    phone: "079 555 12 34",
    message: "Nous cherchons une carte simple pour fidéliser le quartier.",
    plan: "",
    website: "",
  };
}

describe("LEAD_SECTORS", () => {
  it("expose la liste fermée des secteurs du formulaire", () => {
    expect(LEAD_SECTORS).toEqual([
      "Boulangerie",
      "Café-restaurant",
      "Coiffeur-beauté",
      "Boucherie-épicerie",
      "Fleuriste",
      "Autre",
    ]);
  });
});

describe("validateLeadForm", () => {
  it("accepte un formulaire complet et normalise les valeurs", () => {
    const r = validateLeadForm(base());
    expect(r).toEqual({
      ok: true,
      value: {
        business: "Boulangerie du Bourg",
        sector: "Boulangerie",
        contactName: "Anne Favre",
        email: "anne@bourg.ch",
        phone: "079 555 12 34",
        message: "Nous cherchons une carte simple pour fidéliser le quartier.",
        plan: null,
      },
    });
  });

  it("accepte les champs facultatifs vides (téléphone, message) → null", () => {
    const r = validateLeadForm({ ...base(), phone: "", message: "  " });
    expect(r).toMatchObject({ ok: true, value: { phone: null, message: null } });
  });

  it("rogne les espaces autour des champs texte", () => {
    const r = validateLeadForm({ ...base(), business: "  Chez Ali  ", contactName: " Ali Ben " });
    expect(r).toMatchObject({ ok: true, value: { business: "Chez Ali", contactName: "Ali Ben" } });
  });

  it("rejette un nom de commerce manquant ou trop court", () => {
    expect(validateLeadForm({ ...base(), business: "" })).toEqual({ ok: false, error: "champs" });
    expect(validateLeadForm({ ...base(), business: "A" })).toEqual({ ok: false, error: "champs" });
  });

  it("rejette un nom de commerce au-delà de 120 caractères", () => {
    expect(validateLeadForm({ ...base(), business: "x".repeat(121) })).toEqual({ ok: false, error: "champs" });
  });

  it("rejette un secteur absent ou hors liste (liste fermée côté serveur)", () => {
    expect(validateLeadForm({ ...base(), sector: "" })).toEqual({ ok: false, error: "champs" });
    expect(validateLeadForm({ ...base(), sector: "Garage" })).toEqual({ ok: false, error: "champs" });
  });

  it("rejette un contact manquant ou hors bornes (2–160)", () => {
    expect(validateLeadForm({ ...base(), contactName: "" })).toEqual({ ok: false, error: "champs" });
    expect(validateLeadForm({ ...base(), contactName: "x".repeat(161) })).toEqual({ ok: false, error: "champs" });
  });

  it("rejette un email manquant", () => {
    expect(validateLeadForm({ ...base(), email: "" })).toEqual({ ok: false, error: "champs" });
  });

  it("rejette un email invalide ou trop long", () => {
    expect(validateLeadForm({ ...base(), email: "pas-un-email" })).toEqual({ ok: false, error: "email" });
    expect(validateLeadForm({ ...base(), email: "a b@c.ch" })).toEqual({ ok: false, error: "email" });
    expect(validateLeadForm({ ...base(), email: `${"a".repeat(250)}@x.ch` })).toEqual({ ok: false, error: "email" });
  });

  it("normalise l'email en minuscules", () => {
    const r = validateLeadForm({ ...base(), email: "Anne@Bourg.CH" });
    expect(r).toMatchObject({ ok: true, value: { email: "anne@bourg.ch" } });
  });

  it("rejette un téléphone fantaisiste (caractères ou longueur)", () => {
    expect(validateLeadForm({ ...base(), phone: "abc" })).toEqual({ ok: false, error: "telephone" });
    expect(validateLeadForm({ ...base(), phone: "12345" })).toEqual({ ok: false, error: "telephone" });
    expect(validateLeadForm({ ...base(), phone: "0".repeat(31) })).toEqual({ ok: false, error: "telephone" });
  });

  it("accepte les formats de téléphone suisses et internationaux courants", () => {
    for (const phone of ["079 555 12 34", "+41 79 555 12 34", "022/555.12.34"]) {
      expect(validateLeadForm({ ...base(), phone })).toMatchObject({ ok: true, value: { phone } });
    }
  });

  it("rejette un message au-delà de 1000 caractères", () => {
    expect(validateLeadForm({ ...base(), message: "x".repeat(1001) })).toEqual({ ok: false, error: "message" });
  });

  it("ne garde le palier que s'il fait partie de la grille (attribution pricing)", () => {
    expect(validateLeadForm({ ...base(), plan: "croissance" })).toMatchObject({ ok: true, value: { plan: "croissance" } });
    expect(validateLeadForm({ ...base(), plan: "gratuit" })).toMatchObject({ ok: true, value: { plan: null } });
  });

  it("signale un bot quand le honeypot est rempli", () => {
    expect(validateLeadForm({ ...base(), website: "https://spam.example" })).toEqual({ ok: false, bot: true });
  });

  it("tolère des valeurs non-string (FormData peut porter des File)", () => {
    expect(validateLeadForm({ ...base(), business: null, email: 42 })).toEqual({ ok: false, error: "champs" });
  });
});
