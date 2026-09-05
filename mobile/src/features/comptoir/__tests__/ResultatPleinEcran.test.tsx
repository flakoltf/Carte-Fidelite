import { fireEvent, render, screen } from "@testing-library/react-native";

import { ResultatPleinEcran } from "../components/ResultatPleinEcran";
import { interpretScanResult, type ScanOutcome } from "../scanContract";

const credit = interpretScanResult(
  {
    ok: true,
    body: {
      success: true,
      added: true,
      rewardReady: false,
      loyaltyType: "stamp_card",
      stampGoal: 8,
      card: { stamps_count: 4, customers: { full_name: "Marie Favre" } },
    },
  },
  "carte-1",
);

const outcomeFor = (result: Parameters<typeof interpretScanResult>[0]): ScanOutcome =>
  interpretScanResult(result, "carte-1");

describe("ResultatPleinEcran", () => {
  it("affiche un crédit en grand : le geste, la progression, le client", async () => {
    await render(<ResultatPleinEcran outcome={credit} onFermer={jest.fn()} />);

    expect(screen.getByTestId("resultat-titre").props.children).toBe("+1 tampon");
    expect(screen.getByTestId("resultat-detail").props.children).toBe("4 / 8");
    expect(screen.getByText("Marie Favre")).toBeTruthy();
  });

  it("distingue la récompense atteinte et dit quoi faire", async () => {
    const reward = outcomeFor({
      ok: true,
      body: { success: true, added: true, rewardReady: true, loyaltyType: "stamp_card", stampGoal: 8, card: { stamps_count: 8 } },
    });

    await render(<ResultatPleinEcran outcome={reward} onFermer={jest.fn()} />);

    expect(screen.getByTestId("resultat-titre").props.children).toBe("Récompense atteinte");
    expect(screen.getByText("Offrez la récompense au client.")).toBeTruthy();
  });

  it("annonce un doublon sans dramatiser", async () => {
    const cooldown = outcomeFor({
      ok: false,
      status: 429,
      message: "Carte déjà scannée à l'instant. Patientez quelques secondes.",
      payload: { cooldown: true },
    });

    await render(<ResultatPleinEcran outcome={cooldown} onFermer={jest.fn()} />);

    expect(screen.getByTestId("resultat-titre").props.children).toBe("Déjà scanné il y a un instant");
    expect(screen.getByTestId("resultat-message").props.children).toContain("Patientez");
  });

  it("affiche une carte inconnue", async () => {
    const inconnue = outcomeFor({ ok: false, status: 404, message: "Carte invalide ou introuvable" });

    await render(<ResultatPleinEcran outcome={inconnue} onFermer={jest.fn()} />);

    expect(screen.getByTestId("resultat-titre").props.children).toBe("Carte inconnue");
  });

  it("dit clairement que rien n'est parti quand le réseau manque", async () => {
    const horsLigne = outcomeFor({ ok: false, status: 0, message: "Connexion impossible. Vérifiez votre réseau." });

    await render(<ResultatPleinEcran outcome={horsLigne} onFermer={jest.fn()} />);

    expect(screen.getByTestId("resultat-titre").props.children).toBe("Pas de réseau");
    expect(screen.getByTestId("resultat-message").props.children).toMatch(/n'a pas été enregistré/);
  });

  it("renvoie vers l'ordinateur pour un crédit au montant", async () => {
    const montant = outcomeFor({
      ok: false,
      status: 400,
      message: "Le montant en CHF est requis (> 0, ≤ 10000, max 2 décimales).",
    });

    await render(<ResultatPleinEcran outcome={montant} onFermer={jest.fn()} />);

    expect(screen.getByTestId("resultat-message").props.children).toMatch(/ordinateur/);
  });

  it("se referme au toucher, où qu'on touche", async () => {
    const onFermer = jest.fn();
    await render(<ResultatPleinEcran outcome={credit} onFermer={onFermer} />);

    await fireEvent.press(screen.getByTestId("resultat-scan"));

    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it("s'annonce aux lecteurs d'écran dès son apparition", async () => {
    await render(<ResultatPleinEcran outcome={credit} onFermer={jest.fn()} />);

    const noeud = screen.getByTestId("resultat-scan");
    expect(noeud.props.accessibilityLiveRegion).toBe("assertive");
    expect(noeud.props.accessibilityLabel).toContain("+1 tampon");
  });
});
