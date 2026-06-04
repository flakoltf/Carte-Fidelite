import { describe, it, expect } from "vitest";
import { maskEmail, maskName, redactPII } from "../mask";

describe("maskEmail", () => {
  it("garde la 1re lettre du local et du domaine, masque le reste", () => {
    expect(maskEmail("john.doe@example.com")).toBe("j***@e***.com");
  });

  it("préserve le TLD composé", () => {
    expect(maskEmail("alice@mail.co.uk")).toBe("a***@m***.co.uk");
  });

  it("renvoie une valeur masquée générique si ce n'est pas un email", () => {
    expect(maskEmail("pas-un-email")).toBe("***");
  });

  it("gère une entrée vide sans planter", () => {
    expect(maskEmail("")).toBe("***");
  });
});

describe("maskName", () => {
  it("garde l'initiale de chaque mot", () => {
    expect(maskName("John Doe")).toBe("J*** D***");
  });

  it("gère un nom simple", () => {
    expect(maskName("Madonna")).toBe("M***");
  });

  it("gère le vide", () => {
    expect(maskName("")).toBe("***");
  });
});

describe("redactPII", () => {
  it("masque les clés sensibles connues, garde le reste", () => {
    const input = {
      email: "john.doe@example.com",
      customer_name: "John Doe",
      merchant_id: "m-123",
      points: 5,
    };
    expect(redactPII(input)).toEqual({
      email: "j***@e***.com",
      customer_name: "J*** D***",
      merchant_id: "m-123",
      points: 5,
    });
  });

  it("descend récursivement dans les objets imbriqués", () => {
    const input = { customer: { email: "a@b.com", phone: "+41791234567" } };
    expect(redactPII(input)).toEqual({
      customer: { email: "a***@b***.com", phone: "+41*********" },
    });
  });

  it("ne mute pas l'objet d'origine", () => {
    const input = { email: "john@example.com" };
    redactPII(input);
    expect(input.email).toBe("john@example.com");
  });

  it("laisse passer null/undefined sans planter", () => {
    expect(redactPII(null)).toBe(null);
    expect(redactPII(undefined)).toBe(undefined);
  });
});
