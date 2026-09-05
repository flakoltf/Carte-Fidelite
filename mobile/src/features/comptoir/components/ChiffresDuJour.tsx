import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme";

import type { ComptoirStats } from "../stats";

/**
 * Les chiffres du jour, posés au-dessus du viseur. Discrets : le geste
 * principal reste le scan — ces nombres se lisent entre deux clients.
 */
export function ChiffresDuJour({ stats, chargement }: { stats: ComptoirStats | null; chargement: boolean }) {
  const valeur = (n: number | undefined) => (chargement && stats === null ? "—" : String(n ?? 0));

  return (
    <View style={styles.rangee} testID="chiffres-du-jour" accessibilityRole="summary">
      <Chiffre valeur={valeur(stats?.scansToday)} libelle="scans aujourd'hui" testID="chiffre-scans" />
      <View style={styles.separateur} />
      <Chiffre valeur={valeur(stats?.activeCards)} libelle="cartes actives" testID="chiffre-cartes" />
    </View>
  );
}

function Chiffre({ valeur, libelle, testID }: { valeur: string; libelle: string; testID: string }) {
  return (
    <View style={styles.bloc} testID={testID} accessibilityLabel={`${valeur} ${libelle}`}>
      <Text style={styles.valeur}>{valeur}</Text>
      <Text style={styles.libelle}>{libelle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bloc: { alignItems: "center", minWidth: 96 },
  valeur: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: colors.calcaire },
  libelle: { ...type.caption, color: colors.galet, textAlign: "center" },
  separateur: { width: 1, height: 32, backgroundColor: "rgba(243,240,233,0.18)" },
});
