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
      <Text style={styles.valeur} maxFontSizeMultiplier={1.5}>
        {valeur}
      </Text>
      <Text style={styles.libelle} numberOfLines={2} maxFontSizeMultiplier={1.6}>
        {libelle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  // flex + minWidth 0 : en police agrandie les deux blocs se partagent la
  // largeur et le libellé passe sur deux lignes au lieu de sortir de l'écran.
  bloc: { flex: 1, minWidth: 0, maxWidth: 200, alignItems: "center" },
  valeur: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: colors.calcaire },
  libelle: { ...type.caption, color: colors.galet, textAlign: "center" },
  separateur: { width: 1, height: 32, backgroundColor: "rgba(243,240,233,0.18)" },
});
