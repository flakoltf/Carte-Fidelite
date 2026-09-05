import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors, MIN_TOUCH_TARGET, radius, spacing, type } from "@/theme";

export interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  /** Message d'erreur sous le champ ; colore aussi la bordure. */
  error?: string | null;
  hint?: string;
  /** « dark » pour les écrans sur fond onyx (connexion, code). */
  tone?: "light" | "dark";
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Field({
  label,
  error,
  hint,
  tone = "light",
  containerStyle,
  inputStyle,
  testID,
  onFocus,
  onBlur,
  ...inputProps
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const dark = tone === "dark";

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        style={[styles.label, dark && styles.labelDark]}
        nativeID={testID ? `${testID}-label` : undefined}
      >
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.galet}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          dark && styles.inputDark,
          focused && (dark ? styles.inputFocusedDark : styles.inputFocused),
          error ? styles.inputError : null,
          inputStyle,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={[styles.error, dark && styles.errorDark]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, dark && styles.hintDark]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...type.small, color: colors.inkMuted, fontWeight: "600" },
  labelDark: { color: colors.calcaire },
  input: {
    minHeight: Math.max(52, MIN_TOUCH_TARGET),
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.ink,
    ...type.body,
  },
  inputDark: {
    backgroundColor: colors.onyxLight,
    borderColor: "rgba(243,240,233,0.16)",
    color: colors.calcaire,
  },
  inputFocused: { borderColor: colors.halo },
  inputFocusedDark: { borderColor: colors.glow },
  inputError: { borderColor: colors.error },
  error: { ...type.caption, color: colors.error },
  errorDark: { color: "#F09683" },
  hint: { ...type.caption, color: colors.inkMuted },
  hintDark: { color: colors.galet },
});
