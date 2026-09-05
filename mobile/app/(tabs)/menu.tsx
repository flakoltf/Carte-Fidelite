import { Alert, Linking, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth/AuthContext";
import { getConfig } from "@/lib/config";
import { colors, spacing, type } from "@/theme";

export default function MenuScreen() {
  const { merchant, signOut } = useAuth();
  const shopName = merchant?.shopName?.trim() || "Votre commerce";
  const dashboardUrl = `${getConfig().apiBaseUrl}/dashboard`;

  const confirmSignOut = () => {
    Alert.alert("Se déconnecter ?", "Vous devrez ressaisir votre mot de passe.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen scroll testID="ecran-menu">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>COMMERCE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {shopName}
        </Text>
        {merchant?.email ? <Text style={styles.email}>{merchant.email}</Text> : null}
      </View>

      <Card
        title="Réglages complets sur ordinateur"
        subtitle="Design de la carte, mécanique de fidélité, campagnes et statistiques se règlent dans le tableau de bord, sur un écran plus large."
      >
        <Button
          testID="bouton-dashboard"
          label="Ouvrir le tableau de bord"
          variant="secondary"
          accessibilityHint="Ouvre app.halocard.ch dans votre navigateur"
          onPress={() => void Linking.openURL(dashboardUrl)}
        />
        <Text style={styles.link}>{dashboardUrl.replace(/^https:\/\//, "")}</Text>
      </Card>

      <Card title="Compte">
        <Button
          testID="bouton-deconnexion"
          label="Se déconnecter"
          variant="ghost"
          onPress={confirmSignOut}
        />
      </Card>

      <Text style={styles.version}>HALO Comptoir — version 0.1.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  eyebrow: { ...type.eyebrow, color: colors.halo },
  title: { ...type.h1, color: colors.ink },
  email: { ...type.small, color: colors.inkMuted },
  link: { ...type.caption, color: colors.inkMuted, textAlign: "center" },
  version: { ...type.caption, color: colors.galet, textAlign: "center" },
});
