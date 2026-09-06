import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StatusBar, type StatusBarStyle } from "expo-status-bar";

/**
 * Barre de statut de l'écran, posée SEULEMENT quand il a le focus. Les onglets
 * restent montés en arrière-plan : sans cette garde, le dernier onglet monté
 * imposerait sa couleur à tous les autres (texte sombre sur le viseur noir).
 */
export function FocusedStatusBar({ style }: { style: StatusBarStyle }) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused ? <StatusBar style={style} /> : null;
}
