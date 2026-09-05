import { render, screen } from "@testing-library/react-native";

import { ChiffresDuJour } from "../components/ChiffresDuJour";

describe("ChiffresDuJour", () => {
  it("affiche les scans du jour et les cartes actives", async () => {
    await render(<ChiffresDuJour stats={{ scansToday: 17, activeCards: 128 }} chargement={false} />);

    expect(screen.getByText("17")).toBeTruthy();
    expect(screen.getByText("128")).toBeTruthy();
    expect(screen.getByText("scans aujourd'hui")).toBeTruthy();
    expect(screen.getByText("cartes actives")).toBeTruthy();
  });

  it("montre un tiret tant que rien n'est chargé", async () => {
    await render(<ChiffresDuJour stats={null} chargement />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("garde les derniers chiffres connus pendant un rafraîchissement", async () => {
    await render(<ChiffresDuJour stats={{ scansToday: 3, activeCards: 9 }} chargement />);

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("affiche zéro plutôt que rien un jour sans scan", async () => {
    await render(<ChiffresDuJour stats={{ scansToday: 0, activeCards: 0 }} chargement={false} />);

    expect(screen.getAllByText("0")).toHaveLength(2);
  });
});
