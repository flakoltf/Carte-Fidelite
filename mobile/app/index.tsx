import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { HaloMark } from "@/components/HaloMark";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors, spacing } from "@/theme";

/** Aiguillage : on n'affiche jamais un écran métier avant de savoir qui est là. */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <HaloMark size={64} />
        <ActivityIndicator color={colors.glow} />
      </View>
    );
  }

  if (status === "signed-in") return <Redirect href="/(tabs)/comptoir" />;
  if (status === "mfa-required") return <Redirect href="/connexion/code" />;
  return <Redirect href="/connexion" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    backgroundColor: colors.onyx,
  },
});
