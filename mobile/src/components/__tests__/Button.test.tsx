import { fireEvent, render, screen } from "@testing-library/react-native";

import { MIN_TOUCH_TARGET } from "@/theme";
import { Button } from "../Button";

/** Aplatit le style d'un Pressable (fonction de l'état pressé, ou tableau). */
function flattenStyle(style: unknown): Record<string, unknown> {
  const resolved = typeof style === "function" ? style({ pressed: false }) : style;
  const parts = Array.isArray(resolved) ? resolved.flat(Infinity) : [resolved];
  return Object.assign({}, ...parts.filter(Boolean));
}

describe("Button", () => {
  it("affiche son intitulé et déclenche l'action", async () => {
    const onPress = jest.fn();
    await render(<Button testID="bouton" label="Se connecter" onPress={onPress} />);

    expect(screen.getByText("Se connecter")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("bouton"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("offre une cible tactile d'au moins 44 pt", async () => {
    await render(<Button testID="bouton" label="Valider" />);

    const style = flattenStyle(screen.getByTestId("bouton").props.style);
    expect(style.minHeight as number).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it("est annoncé comme bouton avec son intitulé", async () => {
    await render(<Button label="Vérifier" accessibilityHint="Valide le code à six chiffres" />);

    const node = screen.getByRole("button", { name: "Vérifier" });
    expect(node.props.accessibilityHint).toBe("Valide le code à six chiffres");
  });

  it("n'exécute rien quand il est désactivé", async () => {
    const onPress = jest.fn();
    await render(<Button testID="bouton" label="Valider" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByTestId("bouton"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId("bouton").props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("pendant le chargement : plus d'intitulé, plus d'action, état « occupé »", async () => {
    const onPress = jest.fn();
    await render(<Button testID="bouton" label="Se connecter" loading onPress={onPress} />);

    await fireEvent.press(screen.getByTestId("bouton"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText("Se connecter")).toBeNull();
    expect(screen.getByTestId("bouton").props.accessibilityState).toMatchObject({ busy: true });
    // L'intitulé reste annoncé aux lecteurs d'écran même sans texte visible.
    expect(screen.getByTestId("bouton").props.accessibilityLabel).toBe("Se connecter");
  });
});
