import { fireEvent, render, screen } from "@testing-library/react-native";

import { BandeauAnnuler, NoteAnnulation } from "../components/BandeauAnnuler";

describe("BandeauAnnuler", () => {
  it("emploie le mot de la mécanique et montre le temps restant", async () => {
    await render(
      <BandeauAnnuler loyaltyType="stamp_card" secondesRestantes={245} enCours={false} onAnnuler={jest.fn()} />,
    );

    expect(screen.getByText("Annuler ce tampon")).toBeTruthy();
    expect(screen.getByText("4:05")).toBeTruthy();
  });

  it("dit « visite » pour une carte de passages", async () => {
    await render(
      <BandeauAnnuler loyaltyType="visit_based" secondesRestantes={60} enCours={false} onAnnuler={jest.fn()} />,
    );

    expect(screen.getByText("Annuler cette visite")).toBeTruthy();
    expect(screen.getByText("1:00")).toBeTruthy();
  });

  it("déclenche l'annulation au toucher", async () => {
    const onAnnuler = jest.fn();
    await render(
      <BandeauAnnuler loyaltyType="stamp_card" secondesRestantes={120} enCours={false} onAnnuler={onAnnuler} />,
    );

    await fireEvent.press(screen.getByTestId("bandeau-annuler"));

    expect(onAnnuler).toHaveBeenCalledTimes(1);
  });

  it("ne se laisse pas toucher deux fois pendant l'appel", async () => {
    const onAnnuler = jest.fn();
    await render(
      <BandeauAnnuler loyaltyType="stamp_card" secondesRestantes={120} enCours onAnnuler={onAnnuler} />,
    );

    await fireEvent.press(screen.getByTestId("bandeau-annuler"));

    expect(onAnnuler).not.toHaveBeenCalled();
    expect(screen.getByTestId("bandeau-annuler").props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe("NoteAnnulation", () => {
  it("confirme poliment et sans bloquer", async () => {
    await render(<NoteAnnulation texte="Tampon annulé" />);

    const note = screen.getByTestId("note-annulation");
    expect(note.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByText("Tampon annulé")).toBeTruthy();
  });
});
