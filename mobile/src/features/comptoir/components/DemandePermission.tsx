import { Linking, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { colors, spacing, type } from "@/theme";

/**
 * Écran de permission caméra. On explique AVANT de demander : le commerçant
 * doit savoir pourquoi l'app veut sa caméra, sinon il refuse — et un refus
 * définitif se répare seulement dans les réglages du téléphone.
 */
export function DemandePermission({
  refuseeDefinitivement,
  onDemander,
}: {
  refuseeDefinitivement: boolean;
  onDemander: () => void;
}) {
  return (
    <View style={styles.ecran} testID="demande-permission">
      <Text accessibilityRole="header" style={styles.titre}>
        La caméra sert à lire les cartes
      </Text>
      <Text style={styles.texte}>
        Le QR code de la carte du client est lu ici même, sur votre téléphone. Aucune photo n&apos;est
        prise, rien n&apos;est enregistré : l&apos;image ne sert qu&apos;à reconnaître le code.
      </Text>

      {refuseeDefinitivement ? (
        <>
          <Text style={styles.texte}>
            L&apos;accès est actuellement refusé. Vous pouvez le rétablir dans les réglages du
            téléphone, à la rubrique HALO Comptoir.
          </Text>
          <Button
            testID="bouton-reglages"
            label="Ouvrir les réglages"
            onPress={() => void Linking.openSettings()}
          />
        </>
      ) : (
        <Button testID="bouton-autoriser" label="Autoriser la caméra" onPress={onDemander} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.onyx,
  },
  titre: { ...type.h2, color: colors.calcaire },
  texte: { ...type.body, color: colors.galet },
});
