import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme";

import type { ScanOutcome, ScanOutcomeKind } from "../scanContract";

// Une couleur par famille de résultat : le commerçant doit comprendre à un
// mètre, sans lire. Vert = crédité, or = récompense, rouge = refus, sombre =
// « rien de grave, recommencez ».
const PALETTE: Record<ScanOutcomeKind, { fond: string; texte: string; signe: string }> = {
  credit: { fond: colors.halo, texte: colors.white, signe: "✓" },
  reward: { fond: colors.warning, texte: colors.onyx, signe: "★" },
  cooldown: { fond: colors.onyxLight, texte: colors.calcaire, signe: "=" },
  "unknown-card": { fond: colors.error, texte: colors.white, signe: "!" },
  offline: { fond: colors.onyxLight, texte: colors.calcaire, signe: "!" },
  "amount-required": { fond: colors.info, texte: colors.white, signe: "?" },
  refused: { fond: colors.error, texte: colors.white, signe: "!" },
};

const SOUS_TITRE: Partial<Record<ScanOutcomeKind, string>> = {
  reward: "Offrez la récompense au client.",
};

export function ResultatPleinEcran({
  outcome,
  onFermer,
}: {
  outcome: ScanOutcome;
  onFermer: () => void;
}) {
  const palette = PALETTE[outcome.kind];
  const sousTitre = outcome.message ?? SOUS_TITRE[outcome.kind] ?? null;

  return (
    <Pressable
      testID="resultat-scan"
      accessibilityRole="button"
      accessibilityLabel={`${outcome.title}. Toucher pour scanner la carte suivante.`}
      accessibilityLiveRegion="assertive"
      onPress={onFermer}
      style={[styles.plein, { backgroundColor: palette.fond }]}
    >
      <View style={styles.contenu}>
        <View style={[styles.pastille, { borderColor: palette.texte }]}>
          <Text style={[styles.signe, { color: palette.texte }]} accessibilityElementsHidden>
            {palette.signe}
          </Text>
        </View>

        <Text testID="resultat-titre" style={[styles.titre, { color: palette.texte }]}>
          {outcome.title}
        </Text>

        {outcome.detail ? (
          <Text testID="resultat-detail" style={[styles.detail, { color: palette.texte }]}>
            {outcome.detail}
          </Text>
        ) : null}

        {outcome.customerName ? (
          <Text style={[styles.client, { color: palette.texte }]}>{outcome.customerName}</Text>
        ) : null}

        {sousTitre ? (
          <Text testID="resultat-message" style={[styles.message, { color: palette.texte }]}>
            {sousTitre}
          </Text>
        ) : null}
      </View>

      <View style={[styles.reprendre, { borderColor: palette.texte }]}>
        <Text style={[styles.reprendreTexte, { color: palette.texte }]}>Scanner la carte suivante</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plein: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.xl,
  },
  contenu: { alignItems: "center", gap: spacing.sm },
  pastille: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  signe: { fontSize: 48, lineHeight: 56, fontWeight: "700" },
  // Volontairement énorme : lisible à bout de bras, au comptoir, en pleine rush.
  titre: { fontSize: 44, lineHeight: 50, fontWeight: "800", textAlign: "center" },
  detail: { fontSize: 32, lineHeight: 38, fontWeight: "600", textAlign: "center", opacity: 0.95 },
  client: { ...type.body, textAlign: "center", opacity: 0.9 },
  message: { ...type.body, textAlign: "center", opacity: 0.95, paddingHorizontal: spacing.md },
  reprendre: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    opacity: 0.85,
  },
  reprendreTexte: { ...type.bodyStrong },
});
