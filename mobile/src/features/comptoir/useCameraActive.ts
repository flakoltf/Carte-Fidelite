import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";

import { cameraShouldRun } from "./cameraLifecycle";

/**
 * Vrai seulement quand la caméra a le droit de tourner : onglet au premier
 * plan (focus de navigation) et app active (pas en arrière-plan, pas derrière
 * le centre de contrôle ou un appel). Se rallume tout seul au retour.
 */
export function useCameraActive(): boolean {
  const [focused, setFocused] = useState(false);
  // Au montage, l'écran est en train de s'afficher : l'app est au premier
  // plan, même si RN n'a pas encore reporté d'état (« unknown » / absent au
  // lancement). Seuls « background » et « inactive » éteignent la caméra.
  const [appState, setAppState] = useState<AppStateStatus>(() => {
    const initial = AppState.currentState;
    return initial === "background" || initial === "inactive" ? initial : "active";
  });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  return cameraShouldRun({ focused, appState });
}
