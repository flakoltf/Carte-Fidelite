import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { colors, spacing, type } from "@/theme";

/**
 * Écran d'attente d'un onglet : la coque et le ton définitifs, le métier arrive
 * aux missions suivantes. Mieux vaut un vide assumé qu'une fausse démo.
 */
export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  soon,
  testID,
}: {
  eyebrow: string;
  title: string;
  description: string;
  soon: string[];
  testID?: string;
}) {
  return (
    <Screen testID={testID} scroll>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <Card title="Bientôt disponible">
        {soon.map((item) => (
          <View key={item} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.item}>{item}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  eyebrow: { ...type.eyebrow, color: colors.halo },
  title: { ...type.h1, color: colors.ink },
  description: { ...type.body, color: colors.inkMuted },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  // Aligné sur la première ligne du texte, pas au milieu du paragraphe.
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.glow, marginTop: 9 },
  item: { ...type.body, color: colors.ink, flex: 1 },
});
