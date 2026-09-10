import { fireEvent, render, screen } from "@testing-library/react-native";

import { PaveMontant } from "../components/PaveMontant";

const rendu = (surcharges: Partial<Parameters<typeof PaveMontant>[0]> = {}) =>
  render(
    <PaveMontant
      customerName={null}
      enCours={false}
      erreur={null}
      onCrediter={jest.fn()}
      onFermer={jest.fn()}
      {...surcharges}
    />,
  );

const taper = async (touches: string[]) => {
  for (const t of touches) {
    await fireEvent.press(screen.getByTestId(`touche-${t === "," ? "virgule" : t}`));
  }
};

describe("PaveMontant", () => {
  it("part de zéro, bouton d'envoi désactivé (le montant doit être > 0)", async () => {
    await rendu();

    expect(screen.getByTestId("montant-affiche").props.children).toBe("CHF 0.—");
    expect(screen.getByTestId("bouton-crediter").props.accessibilityState.disabled).toBe(true);
  });

  it("le montant tapé se RELIT en grand ET sur le bouton avant l'envoi", async () => {
    await rendu();

    await taper(["1", "2", ",", "5", "0"]);

    expect(screen.getByTestId("montant-affiche").props.children).toBe("CHF 12.50");
    expect(screen.getByText("Créditer CHF 12.50")).toBeTruthy();
  });

  it("envoie le montant numérique exact au geste", async () => {
    const onCrediter = jest.fn();
    await rendu({ onCrediter });

    await taper(["1", "2", ",", "5"]);
    await fireEvent.press(screen.getByTestId("bouton-crediter"));

    expect(onCrediter).toHaveBeenCalledWith(12.5);
  });

  it("tient les bornes serveur à la saisie : 2 décimales max, jamais plus de 10 000", async () => {
    await rendu();

    await taper(["9", "9", "9", "9", "9"]); // le 5e chiffre dépasserait 10 000
    expect(screen.getByTestId("montant-affiche").props.children).toBe("CHF 9999.—");

    await taper([",", "5", "0", "9"]); // la 3e décimale est refusée
    expect(screen.getByTestId("montant-affiche").props.children).toBe("CHF 9999.50");
  });

  it("effacer corrige la saisie chiffre par chiffre", async () => {
    await rendu();

    await taper(["7", "5"]);
    await fireEvent.press(screen.getByTestId("touche-back"));

    expect(screen.getByTestId("montant-affiche").props.children).toBe("CHF 7.—");
  });

  it("pendant l'envoi : touches et boutons gelés, état annoncé", async () => {
    const onCrediter = jest.fn();
    const onFermer = jest.fn();
    await rendu({ enCours: true, onCrediter, onFermer });

    await fireEvent.press(screen.getByTestId("touche-5"));
    await fireEvent.press(screen.getByTestId("bouton-crediter"));
    await fireEvent.press(screen.getByTestId("bouton-annuler-montant"));

    expect(screen.getByTestId("montant-affiche").props.children).toBe("CHF 0.—");
    expect(onCrediter).not.toHaveBeenCalled();
    expect(onFermer).not.toHaveBeenCalled();
    expect(screen.getByText("Crédit en cours…")).toBeTruthy();
  });

  it("après un échec réseau : l'erreur s'affiche et le bouton devient « Réessayer »", async () => {
    await rendu({ erreur: "Pas de réseau — le crédit n'a pas été enregistré." });

    await taper(["9"]);

    expect(screen.getByTestId("erreur-montant")).toBeTruthy();
    expect(screen.getByText("Réessayer · CHF 9.—")).toBeTruthy();
  });

  it("« Annuler » rend la main au viseur", async () => {
    const onFermer = jest.fn();
    await rendu({ onFermer });

    await fireEvent.press(screen.getByTestId("bouton-annuler-montant"));

    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});
