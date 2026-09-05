import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadow, spacing, type } from "@/theme";

export interface CardProps {
  title?: string;
  /** Petit intitulé en capitales au-dessus du titre. */
  eyebrow?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Surface blanche sur fond calcaire : la respiration fait le premium. */
export function Card({ title, eyebrow, subtitle, children, style, testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.xs,
    ...(shadow.card as object),
  },
  eyebrow: { ...type.eyebrow, color: colors.halo, marginBottom: spacing.xs },
  title: { ...type.h3, color: colors.ink },
  subtitle: { ...type.small, color: colors.inkMuted },
  body: { marginTop: spacing.md, gap: spacing.sm },
});
