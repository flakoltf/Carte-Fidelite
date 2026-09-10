import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { EncaissementRecompense } from "../components/EncaissementRecompense";
import { interpretScanResult } from "../scanContract";
import type { RedeemResult } from "../scanApi";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

const recompenseTampons = interpretScanResult(
  {
    ok: true,
    body: {
      success: true,
      added: true,
      rewardReady: true,
      loyaltyType: "stamp_card",
      stampGoal: 8,
      card: { stamps_count: 8, customers: { full_name: "Marie Favre" } },
    },
  },
  "carte-1",
);

const recompensePoints = interpretScanResult(
  {
    ok: true,
    body: {
      success: true,
      added: true,
      rewardReady: true,
      loyaltyType: "points",
      currentValue: 200,
      maxThreshold: 200,
      redeemableTiers: [
        { threshold: 100, reward: "Café offert" },
        { threshold: 200, reward: "Menu offert" },
      ],
    },
  },
  "carte-1",
);

const okSingle: RedeemResult = { ok: true, cycleReset: false, tierReward: null };

describe("EncaissementRecompense — un seul bouton (tampons, amount_points)", () => {
  it("n'encaisse RIEN sans geste : le bouton est la confirmation explicite", async () => {
    const encaisser = jest.fn();
    await render(
      <EncaissementRecompense outcome={recompenseTampons} onFermer={jest.fn()} encaisser={encaisser} />,
    );

    expect(screen.getByTestId("resultat-titre").props.children).toBe("Récompense atteinte");
    expect(screen.getByText("Marie Favre")).toBeTruthy();
    expect(screen.getByTestId("bouton-offrir")).toBeTruthy();
    expect(encaisser).not.toHaveBeenCalled();
  });

  it("encaisse au geste, confirme « Récompense offerte » et vibre en succès", async () => {
    const encaisser = jest.fn().mockResolvedValue(okSingle);
    const onEncaisse = jest.fn();
    await render(
      <EncaissementRecompense
        outcome={recompenseTampons}
        onFermer={jest.fn()}
        onEncaisse={onEncaisse}
        encaisser={encaisser}
      />,
    );

    await fireEvent.press(screen.getByTestId("bouton-offrir"));

    await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("Récompense offerte"));
    expect(encaisser).toHaveBeenCalledWith(undefined);
    expect(onEncaisse).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync as jest.Mock).toHaveBeenCalledWith("success");
  });

  it("refus du serveur : message affiché, « Réessayer », jamais d'impasse", async () => {
    const encaisser = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, offline: false, message: "Carte non complète ou déjà encaissée" })
      .mockResolvedValueOnce(okSingle);
    await render(
      <EncaissementRecompense outcome={recompenseTampons} onFermer={jest.fn()} encaisser={encaisser} />,
    );

    await fireEvent.press(screen.getByTestId("bouton-offrir"));
    await waitFor(() => expect(screen.getByTestId("erreur-encaissement")).toBeTruthy());
    expect(screen.getByText("Carte non complète ou déjà encaissée")).toBeTruthy();
    expect(screen.getByText("Réessayer")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("bouton-offrir"));
    await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("Récompense offerte"));
  });

  it("hors ligne : dit que RIEN n'a été encaissé, et laisse réessayer", async () => {
    const encaisser = jest
      .fn()
      .mockResolvedValue({ ok: false, offline: true, message: "Réseau coupé — rien n'a été encaissé. Réessayez." });
    await render(
      <EncaissementRecompense outcome={recompenseTampons} onFermer={jest.fn()} encaisser={encaisser} />,
    );

    await fireEvent.press(screen.getByTestId("bouton-offrir"));

    await waitFor(() => expect(screen.getByText(/rien n'a été encaissé/i)).toBeTruthy());
    expect(screen.getByTestId("bouton-offrir")).toBeTruthy();
  });

  it("toucher à côté referme sans encaisser (retour au viseur)", async () => {
    const onFermer = jest.fn();
    const encaisser = jest.fn();
    await render(
      <EncaissementRecompense outcome={recompenseTampons} onFermer={onFermer} encaisser={encaisser} />,
    );

    await fireEvent.press(screen.getByTestId("encaissement-recompense"));

    expect(onFermer).toHaveBeenCalledTimes(1);
    expect(encaisser).not.toHaveBeenCalled();
  });

  it("amount_points : le libellé de la récompense du serveur est affiché", async () => {
    const recompenseMontant = interpretScanResult(
      { ok: true, body: { success: true, currentValue: 120, pointsEarned: 20, rewardReady: true, rewardLabel: "Café offert" } },
      "carte-1",
    );
    await render(
      <EncaissementRecompense outcome={recompenseMontant} onFermer={jest.fn()} encaisser={jest.fn()} />,
    );

    expect(screen.getByTestId("recompense-libelle").props.children).toBe("Café offert");
  });
});

describe("EncaissementRecompense — paliers d'une carte à points", () => {
  it("un bouton par palier validable, le palier max annonce la remise à zéro", async () => {
    await render(
      <EncaissementRecompense outcome={recompensePoints} onFermer={jest.fn()} encaisser={jest.fn()} />,
    );

    expect(screen.getByText("Choisissez le palier à valider.")).toBeTruthy();
    expect(screen.getByText("Café offert")).toBeTruthy();
    expect(screen.getByText("100 points")).toBeTruthy();
    expect(screen.getByText("200 points · remet la carte à zéro")).toBeTruthy();
  });

  it("palier intermédiaire : validé, retiré de la liste, on reste pour enchaîner", async () => {
    const encaisser = jest.fn().mockResolvedValue({ ok: true, cycleReset: false, tierReward: "Café offert" });
    await render(
      <EncaissementRecompense outcome={recompensePoints} onFermer={jest.fn()} encaisser={encaisser} />,
    );

    await fireEvent.press(screen.getByTestId("bouton-palier-100"));

    await waitFor(() => expect(screen.getByText(/Validé : Café offert/)).toBeTruthy());
    expect(encaisser).toHaveBeenCalledWith(100);
    expect(screen.queryByTestId("bouton-palier-100")).toBeNull();
    expect(screen.getByTestId("bouton-palier-200")).toBeTruthy();
  });

  it("palier max (cycleReset) : « Carte remise à zéro » puis retour au viseur", async () => {
    const encaisser = jest.fn().mockResolvedValue({ ok: true, cycleReset: true, tierReward: "Menu offert" });
    const onFermer = jest.fn();
    await render(
      <EncaissementRecompense outcome={recompensePoints} onFermer={onFermer} encaisser={encaisser} />,
    );

    await fireEvent.press(screen.getByTestId("bouton-palier-200"));

    await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("Carte remise à zéro"));
    expect(encaisser).toHaveBeenCalledWith(200);
    // Retour automatique au viseur (1500 ms, vrai temps — même règle qu'un crédit).
    await waitFor(() => expect(onFermer).toHaveBeenCalled(), { timeout: 4000 });
  });
});
