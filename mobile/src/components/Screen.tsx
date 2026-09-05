import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme";

export interface ScreenProps {
  children: React.ReactNode;
  /** Contenu défilant + clavier qui pousse la vue (formulaires). */
  scroll?: boolean;
  /** Fond sombre (connexion) plutôt que calcaire. */
  tone?: "light" | "dark";
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Coque commune : zones sûres (encoche, barre d'accueil), fond de marque et
 * clavier qui ne recouvre jamais le champ actif.
 */
export function Screen({
  children,
  scroll = false,
  tone = "light",
  edges = ["top", "left", "right"],
  contentStyle,
  testID,
}: ScreenProps) {
  const background = tone === "dark" ? colors.onyx : colors.calcaire;

  return (
    <SafeAreaView testID={testID} edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
});
