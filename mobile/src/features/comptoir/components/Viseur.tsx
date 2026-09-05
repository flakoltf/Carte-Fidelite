import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme";

/**
 * Viseur plein écran. La caméra reste montée pendant tout le passage sur
 * l'onglet : la rallumer entre deux clients coûterait une seconde à chaque fois.
 * C'est l'appelant qui décide d'ignorer ou non les lectures (`actif`).
 */
export function Viseur({
  actif,
  torche,
  onBasculerTorche,
  onCodeLu,
}: {
  actif: boolean;
  torche: boolean;
  onBasculerTorche: () => void;
  onCodeLu: (valeur: string) => void;
}) {
  const handleScan = (result: BarcodeScanningResult) => {
    if (!actif) return;
    const valeur = result?.data?.trim();
    if (valeur) onCodeLu(valeur);
  };

  return (
    <View style={styles.container} testID="viseur">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torche}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />

      {/* Cadre de visée : quatre coins, rien qui masque l'image. */}
      <View style={styles.cadre} pointerEvents="none">
        <View style={[styles.coin, styles.coinHautGauche]} />
        <View style={[styles.coin, styles.coinHautDroit]} />
        <View style={[styles.coin, styles.coinBasGauche]} />
        <View style={[styles.coin, styles.coinBasDroit]} />
      </View>

      <Text style={styles.consigne} pointerEvents="none">
        Présentez le QR code de la carte
      </Text>

      <Pressable
        testID="bouton-torche"
        accessibilityRole="button"
        accessibilityLabel={torche ? "Éteindre la lampe" : "Allumer la lampe"}
        accessibilityState={{ selected: torche }}
        onPress={onBasculerTorche}
        style={({ pressed }) => [styles.torche, torche && styles.torcheActive, pressed && styles.torchePressee]}
      >
        <Text style={[styles.torcheTexte, torche && styles.torcheTexteActif]}>
          {torche ? "Lampe allumée" : "Lampe"}
        </Text>
      </Pressable>
    </View>
  );
}

const TAILLE_COIN = 44;
const EPAISSEUR = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.onyx, justifyContent: "center", alignItems: "center" },
  cadre: {
    width: "72%",
    aspectRatio: 1,
    maxWidth: 320,
  },
  coin: { position: "absolute", width: TAILLE_COIN, height: TAILLE_COIN, borderColor: colors.glow },
  coinHautGauche: { top: 0, left: 0, borderTopWidth: EPAISSEUR, borderLeftWidth: EPAISSEUR, borderTopLeftRadius: 12 },
  coinHautDroit: { top: 0, right: 0, borderTopWidth: EPAISSEUR, borderRightWidth: EPAISSEUR, borderTopRightRadius: 12 },
  coinBasGauche: { bottom: 0, left: 0, borderBottomWidth: EPAISSEUR, borderLeftWidth: EPAISSEUR, borderBottomLeftRadius: 12 },
  coinBasDroit: { bottom: 0, right: 0, borderBottomWidth: EPAISSEUR, borderRightWidth: EPAISSEUR, borderBottomRightRadius: 12 },
  consigne: {
    ...type.body,
    position: "absolute",
    bottom: spacing.xxl + spacing.xl,
    color: colors.calcaire,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  torche: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    minHeight: 52,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(243,240,233,0.35)",
    backgroundColor: "rgba(14,15,17,0.55)",
  },
  torcheActive: { backgroundColor: colors.calcaire, borderColor: colors.calcaire },
  torchePressee: { opacity: 0.7 },
  torcheTexte: { ...type.bodyStrong, color: colors.calcaire },
  torcheTexteActif: { color: colors.onyx },
});
