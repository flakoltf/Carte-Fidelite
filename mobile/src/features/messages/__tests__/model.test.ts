import type { SegmentSummary } from "@/features/clients/contracts";
import {
  AUDIENCE_KEYS,
  audienceLabel,
  audienceSize,
  sendResultMessage,
  validateMessage,
} from "../model";

const summary: SegmentSummary = {
  total: 7,
  stages: {
    nouveau: { count: 2, pct: 29 },
    regulier: { count: 3, pct: 43 },
    vip: { count: 1, pct: 14 },
    en_train_de_partir: { count: 1, pct: 14 },
    inactif: { count: 0, pct: 0 },
  },
  flags: { recompense_prete: 1, joignable_push: 4 },
};

describe("audiences — mêmes clés et libellés que le web", () => {
  it("les 5 segments, puis « Récompense prête », puis « Tous mes clients »", () => {
    expect(AUDIENCE_KEYS).toEqual([
      "nouveau",
      "regulier",
      "vip",
      "en_train_de_partir",
      "inactif",
      "recompense_prete",
      "all",
    ]);
    expect(audienceLabel("all")).toBe("Tous mes clients");
    expect(audienceLabel("recompense_prete")).toBe("Récompense prête");
    expect(audienceLabel("en_train_de_partir")).toBe("En train de partir");
  });

  it("taille d'un segment lue dans le résumé serveur", () => {
    expect(audienceSize(summary, "all")).toBe(7);
    expect(audienceSize(summary, "recompense_prete")).toBe(1);
    expect(audienceSize(summary, "regulier")).toBe(3);
    expect(audienceSize(summary, "inactif")).toBe(0);
  });

  it("sans résumé (chargement ou erreur) : null, jamais 0 par défaut", () => {
    expect(audienceSize(null, "all")).toBeNull();
  });
});

describe("validateMessage — mêmes règles que le formulaire web", () => {
  it("titre et message non vides → valeurs nettoyées", () => {
    const v = validateMessage({ title: "  Offre du week-end ", body: " -20 % samedi. " });
    expect(v).toEqual({ ok: true, value: { title: "Offre du week-end", body: "-20 % samedi." } });
  });

  it("titre vide ou message vide (espaces compris) → erreurs ciblées", () => {
    expect(validateMessage({ title: "   ", body: "Bonjour" })).toEqual({
      ok: false,
      errors: { title: "Donnez un titre à votre message." },
    });
    expect(validateMessage({ title: "Titre", body: "" })).toEqual({
      ok: false,
      errors: { body: "Écrivez votre message." },
    });
    const both = validateMessage({ title: "", body: "" });
    expect(both.ok).toBe(false);
    if (!both.ok) expect(Object.keys(both.errors)).toEqual(["title", "body"]);
  });
});

describe("sendResultMessage — même confirmation que le web", () => {
  it("personne de joignable : avertissement, pas de faux succès", () => {
    expect(sendResultMessage({ pushed: 0, reachable: 0 })).toEqual({
      tone: "warning",
      text: "Aucun client ne peut encore recevoir de message : dès qu'ils ajoutent leur carte, ils le recevront.",
    });
  });

  it("envoi réussi : nombre de clients touchés et cartes installées", () => {
    expect(sendResultMessage({ pushed: 4, reachable: 4 })).toEqual({
      tone: "success",
      text: "Message envoyé à 4 clients. (4 ont la carte dans leur téléphone.)",
    });
  });

  it("singulier au client unique", () => {
    expect(sendResultMessage({ pushed: 1, reachable: 1 }).text).toBe(
      "Message envoyé à 1 client. (1 a la carte dans son téléphone.)",
    );
  });
});
