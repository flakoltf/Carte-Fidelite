import { cameraShouldRun } from "../cameraLifecycle";

// La caméra ne tourne QUE si l'onglet est visible ET l'app au premier plan :
// batterie, vie privée, et la LED « caméra active » d'iOS ne doit jamais
// s'allumer hors écran.
describe("cameraShouldRun", () => {
  it("tourne quand l'onglet a le focus et l'app est active", () => {
    expect(cameraShouldRun({ focused: true, appState: "active" })).toBe(true);
  });

  it("s'éteint dès que l'onglet perd le focus", () => {
    expect(cameraShouldRun({ focused: false, appState: "active" })).toBe(false);
  });

  it("s'éteint dès que l'app passe en arrière-plan ou devient inactive (centre de contrôle, appel)", () => {
    expect(cameraShouldRun({ focused: true, appState: "background" })).toBe(false);
    expect(cameraShouldRun({ focused: true, appState: "inactive" })).toBe(false);
  });

  it("état inconnu (null, « unknown ») → éteinte, jamais allumée par défaut", () => {
    expect(cameraShouldRun({ focused: true, appState: "unknown" })).toBe(false);
    expect(cameraShouldRun({ focused: true, appState: null })).toBe(false);
  });
});
