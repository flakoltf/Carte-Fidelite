import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { Card } from "../Card";

describe("Card", () => {
  it("expose son titre comme en-tête", async () => {
    await render(<Card title="Compte" />);

    expect(screen.getByRole("header", { name: "Compte" })).toBeTruthy();
  });

  it("met le sur-titre en capitales", async () => {
    await render(<Card eyebrow="Commerce" title="Café du Rhône" />);

    expect(screen.getByText("COMMERCE")).toBeTruthy();
  });

  it("rend le contenu qu'on lui confie", async () => {
    await render(
      <Card title="Réglages">
        <Text>Ouvrir le tableau de bord</Text>
      </Card>,
    );

    expect(screen.getByText("Ouvrir le tableau de bord")).toBeTruthy();
  });

  it("se contente d'un contenu sans titre", async () => {
    await render(
      <Card>
        <Text>Seul</Text>
      </Card>,
    );

    expect(screen.queryByRole("header")).toBeNull();
    expect(screen.getByText("Seul")).toBeTruthy();
  });
});
