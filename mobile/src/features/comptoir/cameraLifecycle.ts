import type { AppStateStatus } from "react-native";

/**
 * La caméra ne tourne que si l'onglet Comptoir est visible ET l'app au premier
 * plan. Tout état incertain (« unknown », null) l'éteint : on n'allume jamais
 * une caméra par défaut — batterie, vie privée, LED « caméra active » d'iOS.
 */
export function cameraShouldRun({
  focused,
  appState,
}: {
  focused: boolean;
  appState: AppStateStatus | null | undefined;
}): boolean {
  return focused && appState === "active";
}
