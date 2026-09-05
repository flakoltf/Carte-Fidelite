import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, MIN_TOUCH_TARGET, radius, spacing, type } from "@/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Rendu en pleine largeur (par défaut). */
  block?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  block = true,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        styles[variant],
        pressed && !inactive && styles[`${variant}Pressed` as const],
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? colors.white : colors.halo}
        />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.label, styles[`${variant}Label` as const]]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // 52 pt : confortablement au-dessus du plancher de 44 pt, doigt mouillé de
    // barista compris.
    minHeight: Math.max(52, MIN_TOUCH_TARGET),
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  block: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...type.bodyStrong },

  primary: { backgroundColor: colors.halo },
  primaryPressed: { backgroundColor: colors.haloDark },
  primaryLabel: { color: colors.white },

  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  secondaryPressed: { backgroundColor: colors.calcaire },
  secondaryLabel: { color: colors.ink },

  ghost: { backgroundColor: "transparent" },
  ghostPressed: { backgroundColor: "rgba(13,107,94,0.08)" },
  ghostLabel: { color: colors.halo },

  danger: { backgroundColor: colors.error },
  dangerPressed: { backgroundColor: "#C6432F" },
  dangerLabel: { color: colors.white },

  inactive: { opacity: 0.45 },
});
