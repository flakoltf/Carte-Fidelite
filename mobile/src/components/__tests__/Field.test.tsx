import { fireEvent, render, screen } from "@testing-library/react-native";

import { MIN_TOUCH_TARGET } from "@/theme";
import { Field } from "../Field";

function flattenStyle(style: unknown): Record<string, unknown> {
  const parts = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...parts.filter(Boolean));
}

describe("Field", () => {
  it("associe l'intitulé au champ pour les lecteurs d'écran", async () => {
    await render(<Field testID="champ" label="Adresse e-mail" />);

    expect(screen.getByText("Adresse e-mail")).toBeTruthy();
    expect(screen.getByLabelText("Adresse e-mail")).toBeTruthy();
  });

  it("remonte la saisie", async () => {
    const onChangeText = jest.fn();
    await render(<Field testID="champ" label="Code" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByTestId("champ"), "123456");
    expect(onChangeText).toHaveBeenCalledWith("123456");
  });

  it("affiche l'erreur et l'annonce poliment", async () => {
    await render(<Field testID="champ" label="Mot de passe" error="E-mail ou mot de passe incorrect." />);

    const message = screen.getByText("E-mail ou mot de passe incorrect.");
    expect(message.props.accessibilityLiveRegion).toBe("polite");
  });

  it("laisse l'erreur prendre la place de l'indice", async () => {
    await render(<Field testID="champ" label="Code" hint="Six chiffres" error="Code incorrect." />);

    expect(screen.queryByText("Six chiffres")).toBeNull();
    expect(screen.getByText("Code incorrect.")).toBeTruthy();
  });

  it("offre une zone de saisie d'au moins 44 pt", async () => {
    await render(<Field testID="champ" label="Adresse e-mail" />);

    const style = flattenStyle(screen.getByTestId("champ").props.style);
    expect(style.minHeight as number).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});
