import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { colors, radius, spacing, type } from "@/theme";

import {
  LIGNES_PAVE,
  afficherChf,
  appliquerTouche,
  montantValide,
  saisieVersChf,
  type ToucheMontant,
} from "../montantRules";

// Pavé numérique CHF — programmes `amount_points`. S'affiche quand le serveur
// répond « montant en CHF requis » (400) au scan : on tape le montant de
// l'achat, on RELIT le montant sur le bouton d'envoi (« Créditer CHF 12.50 »),
// et le serveur crédite les points au prorata. Les bornes du pavé
// (montantRules.ts) sont le miroir des bornes serveur ; le serveur revalide.

const LIBELLE_TOUCHE: Record<string, string> = { ",": "virgule", back: "effacer" };

export function PaveMontant({
  customerName,
  enCours,
  erreur,
  onCrediter,
  onFermer,
}: {
  customerName: string | null;
  /** Appel serveur en vol : touches et boutons gelés, indicateur visible. */
  enCours: boolean;
  /** Échec du DERNIER envoi (réseau coupé…) : le montant tapé est conservé. */
  erreur: string | null;
  onCrediter: (montantChf: number) => void;
  onFermer: () => void;
}) {
  const [saisie, setSaisie] = useState("");
  const montant = saisieVersChf(saisie);
  const valide = montantValide(montant);

  return (
    <View style={styles.plein} testID="pave-montant">
      <StatusBar style="light" />
      <View style={styles.entete}>
        <Text style={styles.titre} maxFontSizeMultiplier={1.3}>
          Crédit au montant
        </Text>
        {customerName ? (
          <Text style={styles.client} maxFontSizeMultiplier={1.6}>
            {customerName}
          </Text>
        ) : null}
        <Text
          testID="montant-affiche"
          style={styles.montant}
          maxFontSizeMultiplier={1.2}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Montant saisi : ${afficherChf(montant)}`}
        >
          {afficherChf(montant)}
        </Text>
        <Text style={styles.consigne} maxFontSizeMultiplier={1.6}>
          {"Tapez le montant de l'achat — les points suivent."}
        </Text>
      </View>

      <View style={styles.pave} accessibilityRole="none">
        {LIGNES_PAVE.map((ligne, i) => (
          <View key={i} style={styles.ligne}>
            {ligne.map((touche) => (
              <Touche
                key={touche}
                touche={touche}
                desactive={enCours}
                onPress={() => setSaisie((s) => appliquerTouche(s, touche))}
              />
            ))}
          </View>
        ))}
      </View>

      {erreur ? (
        <Text testID="erreur-montant" accessibilityRole="alert" style={styles.erreur} maxFontSizeMultiplier={1.6}>
          {erreur}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          testID="bouton-crediter"
          accessibilityRole="button"
          accessibilityLabel={valide ? `Créditer ${afficherChf(montant)}` : "Créditer — tapez d'abord un montant"}
          accessibilityState={{ disabled: !valide || enCours, busy: enCours }}
          disabled={!valide || enCours}
          onPress={() => onCrediter(montant)}
          style={({ pressed }) => [styles.crediter, (!valide || enCours) && styles.crediterInactif, pressed && styles.presse]}
        >
          {enCours ? <ActivityIndicator color={colors.white} /> : null}
          <Text style={styles.crediterTexte} maxFontSizeMultiplier={1.4}>
            {enCours ? "Crédit en cours…" : erreur ? `Réessayer · ${afficherChf(montant)}` : `Créditer ${afficherChf(montant)}`}
          </Text>
        </Pressable>

        <Pressable
          testID="bouton-annuler-montant"
          accessibilityRole="button"
          accessibilityLabel="Annuler et revenir au viseur"
          disabled={enCours}
          onPress={onFermer}
          style={({ pressed }) => [styles.annuler, pressed && styles.presse]}
        >
          <Text style={styles.annulerTexte} maxFontSizeMultiplier={1.6}>
            Annuler
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Touche({
  touche,
  desactive,
  onPress,
}: {
  touche: ToucheMontant;
  desactive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`touche-${touche === "," ? "virgule" : touche}`}
      accessibilityRole="button"
      accessibilityLabel={LIBELLE_TOUCHE[touche] ?? touche}
      disabled={desactive}
      onPress={onPress}
      style={({ pressed }) => [styles.touche, pressed && styles.presse]}
    >
      <Text style={styles.toucheTexte} maxFontSizeMultiplier={1.3}>
        {touche === "back" ? "⌫" : touche}
      </Text>
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
    backgroundColor: colors.onyx,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  entete: { alignItems: "center", gap: spacing.xs },
  titre: { ...type.h2, color: colors.calcaire },
  client: { ...type.body, color: colors.galet },
  // Volontairement énorme : le montant se RELIT à bout de bras avant l'envoi.
  montant: { fontSize: 52, lineHeight: 60, fontWeight: "800", color: colors.white, marginTop: spacing.sm },
  consigne: { ...type.small, color: colors.galet, textAlign: "center" },
  pave: { gap: spacing.sm, alignSelf: "center" },
  ligne: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  touche: {
    width: 84,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.onyxLight,
    alignItems: "center",
    justifyContent: "center",
  },
  toucheTexte: { fontSize: 26, lineHeight: 32, fontWeight: "600", color: colors.calcaire },
  erreur: { ...type.bodyStrong, color: colors.error, textAlign: "center", paddingHorizontal: spacing.md },
  actions: { alignSelf: "stretch", gap: spacing.sm, alignItems: "stretch" },
  crediter: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.halo,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  crediterInactif: { opacity: 0.5 },
  crediterTexte: { ...type.bodyStrong, color: colors.white },
  annuler: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  annulerTexte: { ...type.body, color: colors.galet },
  presse: { opacity: 0.85 },
});
