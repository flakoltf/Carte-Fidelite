import { act, renderHook } from "@testing-library/react-native";

import { markSessionExpired, takeSessionNotice, useSessionNotice, _resetSessionNotice } from "../sessionNotice";

beforeEach(() => _resetSessionNotice());

describe("sessionNotice — message affiché à la reconnexion après un 401", () => {
  it("vide par défaut", () => {
    expect(takeSessionNotice()).toBeNull();
  });

  it("marqué puis consommé UNE fois (pas de bannière fantôme à la connexion suivante)", () => {
    markSessionExpired();
    expect(takeSessionNotice()).toBe("Votre session a expiré. Reconnectez-vous.");
    expect(takeSessionNotice()).toBeNull();
  });

  it("le hook lit la notice au montage et la garde affichée tant que l'écran vit", async () => {
    markSessionExpired();
    const { result } = await renderHook(() => useSessionNotice());
    expect(result.current).toMatch(/session a expiré/);
    // Consommée : un second écran ne la verrait plus.
    expect(takeSessionNotice()).toBeNull();
  });

  it("le hook réagit si la session expire pendant que l'écran est déjà monté", async () => {
    const { result } = await renderHook(() => useSessionNotice());
    expect(result.current).toBeNull();
    await act(() => markSessionExpired());
    expect(result.current).toMatch(/session a expiré/);
  });
});
