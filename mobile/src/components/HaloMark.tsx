import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

/**
 * Le symbole de marque : un cercle fin traversé d'un éclat (le « glint »).
 * Dessiné en Views pures — l'app n'embarque pas de moteur SVG.
 */
export function HaloMark({
  size = 56,
  ring = colors.calcaire,
  glow = colors.glow,
  strokeWidth,
}: {
  size?: number;
  ring?: string;
  glow?: string;
  strokeWidth?: number;
}) {
  const border = strokeWidth ?? Math.max(2, Math.round(size * 0.07));
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: border,
  } as const;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[circle, { borderColor: ring }]} />
      <View
        style={[
          styles.overlay,
          circle,
          styles.glint,
          { borderTopColor: glow, transform: [{ rotate: "35deg" }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0 },
  glint: {
    borderColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
});
