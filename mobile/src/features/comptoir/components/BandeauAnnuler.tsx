import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme";

import { revertActionLabel, type RevertableLoyaltyType } from "../revertRules";

/**
 * Bandeau d'annulation du dernier crédit. Il flotte au-dessus du viseur sans
 * bloquer l'enchaînement des scans, et disparaît de lui-même à la fin de la
 * fenêtre — c'est le serveur qui fait foi, ce décompte n'est qu'indicatif.
 */
export function BandeauAnnuler({
  loyaltyType,
  secondesRestantes,
  enCours,
  onAnnuler,
}: {
  loyaltyType: RevertableLoyaltyType;
  secondesRestantes: number;
  enCours: boolean;
  onAnnuler: () => void;
}) {
  const minutes = Math.floor(secondesRestantes / 60);
  const secondes = secondesRestantes % 60;
  const reste = `${minutes}:${String(secondes).padStart(2, "0")}`;

  return (
    <Pressable
      testID="bandeau-annuler"
      accessibilityRole="button"
      accessibilityLabel={`${revertActionLabel(loyaltyType)}. Encore ${reste} pour le faire.`}
      accessibilityState={{ disabled: enCours, busy: enCours }}
      disabled={enCours}
      onPress={onAnnuler}
      style={({ pressed }) => [styles.bandeau, pressed && styles.presse]}
    >
      {enCours ? (
        <ActivityIndicator color={colors.calcaire} />
      ) : (
        <View style={styles.contenu}>
          <Text style={styles.libelle}>{revertActionLabel(loyaltyType)}</Text>
          <Text style={styles.compte}>{reste}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Confirmation transitoire (« Tampon annulé »), ou refus du serveur. */
export function NoteAnnulation({ texte }: { texte: string }) {
  return (
    <View style={styles.note} testID="note-annulation" accessibilityLiveRegion="polite">
      <Text style={styles.noteTexte}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    minHeight: 52,
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(243,240,233,0.35)",
    backgroundColor: "rgba(14,15,17,0.72)",
  },
  presse: { opacity: 0.7 },
  contenu: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  libelle: { ...type.bodyStrong, color: colors.calcaire },
  compte: { ...type.small, color: colors.galet, fontVariant: ["tabular-nums"] },
  note: {
    minHeight: 52,
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.calcaire,
  },
  noteTexte: { ...type.bodyStrong, color: colors.onyx, textAlign: "center" },
});
