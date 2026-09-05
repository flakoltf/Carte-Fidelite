import { StyleSheet, View, type ColorValue } from "react-native";

import { colors } from "@/theme";

export type TabIconName = "comptoir" | "clients" | "messages" | "menu";

/**
 * Quatre glyphes géométriques dessinés en Views — traits fins, dans l'esprit
 * de la marque, et zéro dépendance d'icônes.
 */
export function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: TabIconName;
  color: ColorValue;
  size?: number;
}) {
  const stroke = 1.8;

  if (name === "comptoir") {
    // Quatre coins de visée : le geste du scan au comptoir.
    const corner = size * 0.3;
    const base = { position: "absolute", width: corner, height: corner, borderColor: color } as const;
    return (
      <View style={{ width: size, height: size }}>
        <View style={[base, { top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke, borderTopLeftRadius: 4 }]} />
        <View style={[base, { top: 0, right: 0, borderTopWidth: stroke, borderRightWidth: stroke, borderTopRightRadius: 4 }]} />
        <View style={[base, { bottom: 0, left: 0, borderBottomWidth: stroke, borderLeftWidth: stroke, borderBottomLeftRadius: 4 }]} />
        <View style={[base, { bottom: 0, right: 0, borderBottomWidth: stroke, borderRightWidth: stroke, borderBottomRightRadius: 4 }]} />
        <View style={{ position: "absolute", top: size / 2 - stroke / 2, left: size * 0.15, right: size * 0.15, height: stroke, backgroundColor: color }} />
      </View>
    );
  }

  if (name === "clients") {
    const head = size * 0.36;
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: "absolute",
            top: size * 0.08,
            left: (size - head) / 2,
            width: head,
            height: head,
            borderRadius: head / 2,
            borderWidth: stroke,
            borderColor: color,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: size * 0.08,
            left: size * 0.12,
            right: size * 0.12,
            height: size * 0.36,
            borderTopLeftRadius: size * 0.36,
            borderTopRightRadius: size * 0.36,
            borderWidth: stroke,
            borderBottomWidth: 0,
            borderColor: color,
          }}
        />
      </View>
    );
  }

  if (name === "messages") {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: "absolute",
            top: size * 0.14,
            left: size * 0.06,
            right: size * 0.06,
            height: size * 0.56,
            borderRadius: 6,
            borderWidth: stroke,
            borderColor: color,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: size * 0.12,
            left: size * 0.26,
            width: size * 0.2,
            height: size * 0.2,
            borderColor: color,
            borderLeftWidth: stroke,
            borderBottomWidth: stroke,
            transform: [{ rotate: "-45deg" }],
          }}
        />
      </View>
    );
  }

  const bar = { height: stroke, backgroundColor: color, borderRadius: stroke } as const;
  return (
    <View style={[{ width: size, height: size }, styles.menu]}>
      <View style={[bar, { width: size * 0.8 }]} />
      <View style={[bar, { width: size * 0.8 }]} />
      <View style={[bar, { width: size * 0.55 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { justifyContent: "center", alignItems: "flex-start", gap: 5, paddingLeft: 2 },
});

export const tabIconColors = { active: colors.halo, inactive: colors.galet };
