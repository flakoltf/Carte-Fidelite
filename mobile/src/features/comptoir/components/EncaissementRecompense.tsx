import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, type } from "@/theme";

import type { RedeemableTier, ScanOutcome } from "../scanContract";
import { submitRedeem, type RedeemResult } from "../scanApi";

// « Récompense atteinte » quand elle PEUT s'encaisser depuis l'app : même fond
// doré que l'état informatif, plus le geste — un bouton OFFRIR (tampons,
// amount_points) ou un bouton par palier validable (carte à points), exactement
// le contrat du web (RedeemFullScreen → POST /api/scan/redeem). La confirmation
// est EXPLICITE : rien ne part sans un appui sur un bouton ; toucher à côté
// referme l'écran sans encaisser.
//
// La décision (carte pleine, palier atteint, déjà offert) reste au serveur :
// chaque refus s'affiche avec son message et le bouton redevient un « Réessayer »
// — jamais d'impasse, y compris hors ligne (« rien n'a été encaissé »).

type Phase = "pret" | "encours" | "fait";

// Même rythme que la fermeture automatique d'un crédit (ComptoirScreen) : le
// commerçant voit la confirmation, puis le viseur revient tout seul.
const FERMETURE_FAIT_MS = 1500;

export function EncaissementRecompense({
  outcome,
  onFermer,
  onEncaisse,
  encaisser,
}: {
  outcome: ScanOutcome;
  onFermer: () => void;
  /** Après CHAQUE encaissement réussi — rafraîchit les chiffres du jour. */
  onEncaisse?: () => void;
  /** Injectable pour les tests ; défaut : POST /api/scan/redeem. */
  encaisser?: (tierThreshold?: number) => Promise<RedeemResult>;
}) {
  const plan = outcome.redeem;
  const [phase, setPhase] = useState<Phase>("pret");
  const [erreur, setErreur] = useState<string | null>(null);
  const [titreFait, setTitreFait] = useState("Récompense offerte");
  const [noteValidee, setNoteValidee] = useState<string | null>(null);
  const [paliersRestants, setPaliersRestants] = useState<RedeemableTier[]>(
    plan?.mode === "tiers" ? plan.tiers : [],
  );
  const run = useRef(encaisser ?? ((t?: number) => submitRedeem(outcome.cardId, t)));

  // Succès final : confirmation à l'écran, puis retour au viseur tout seul.
  useEffect(() => {
    if (phase !== "fait") return;
    const id = setTimeout(onFermer, FERMETURE_FAIT_MS);
    return () => clearTimeout(id);
  }, [phase, onFermer]);

  // Android : pendant l'appel serveur, le bouton retour ne ferme pas l'écran
  // (on ne quitte jamais un encaissement en vol sans voir son verdict).
  useEffect(() => {
    if (phase !== "encours") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [phase]);

  const offrir = useCallback(
    async (palier?: RedeemableTier) => {
      if (phase === "encours") return;
      setPhase("encours");
      setErreur(null);
      const res = await run.current(palier?.threshold);
      if (!res.ok) {
        // Refus serveur ou réseau coupé : message + « Réessayer », jamais d'impasse.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErreur(res.message);
        setPhase("pret");
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onEncaisse?.();
      if (palier && !res.cycleReset) {
        // Palier intermédiaire (carte à points) : on reste sur l'écran pour
        // enchaîner un autre palier ou terminer — comme au comptoir web.
        setPaliersRestants((prev) => prev.filter((t) => t.threshold !== palier.threshold));
        setNoteValidee(res.tierReward ?? palier.reward);
        setPhase("pret");
        return;
      }
      setTitreFait(palier && res.cycleReset ? "Carte remise à zéro" : "Récompense offerte");
      setPhase("fait");
    },
    [phase, onEncaisse],
  );

  const fait = phase === "fait";
  const enCours = phase === "encours";
  const titre = fait ? titreFait : outcome.title;

  return (
    <Pressable
      testID="encaissement-recompense"
      accessibilityRole="button"
      accessibilityLabel={
        fait ? `${titre}. Toucher pour continuer.` : `${titre}. Toucher à côté des boutons pour continuer sans encaisser.`
      }
      accessibilityLiveRegion="assertive"
      onPress={() => {
        if (!enCours) onFermer();
      }}
      style={styles.plein}
    >
      {/* Même règle que ResultatPleinEcran : la barre de statut suit le fond doré. */}
      <StatusBar style="dark" />
      <View style={styles.contenu}>
        <View style={styles.pastille}>
          <Text style={styles.signe} accessibilityElementsHidden maxFontSizeMultiplier={1.2}>
            {fait ? "✓" : "★"}
          </Text>
        </View>

        <Text testID="resultat-titre" style={styles.titre} maxFontSizeMultiplier={1.3}>
          {titre}
        </Text>

        {!fait && outcome.detail ? (
          <Text testID="resultat-detail" style={styles.detail} maxFontSizeMultiplier={1.3}>
            {outcome.detail}
          </Text>
        ) : null}

        {!fait && outcome.customerName ? (
          <Text style={styles.client} maxFontSizeMultiplier={1.6}>
            {outcome.customerName}
          </Text>
        ) : null}

        {!fait && plan?.mode === "single" && plan.rewardLabel ? (
          <Text testID="recompense-libelle" style={styles.message} maxFontSizeMultiplier={1.6}>
            {plan.rewardLabel}
          </Text>
        ) : null}
      </View>

      {!fait && plan?.mode === "single" ? (
        <View style={styles.zoneBoutons}>
          <Pressable
            testID="bouton-offrir"
            accessibilityRole="button"
            accessibilityLabel="Offrir : valider la récompense"
            accessibilityState={{ disabled: enCours, busy: enCours }}
            disabled={enCours}
            onPress={() => void offrir()}
            style={({ pressed }) => [styles.boutonOffrir, pressed && styles.boutonPresse]}
          >
            {enCours ? <ActivityIndicator color={colors.white} /> : null}
            <Text style={styles.boutonTexte} maxFontSizeMultiplier={1.4}>
              {enCours ? "Encaissement…" : erreur ? "Réessayer" : "OFFRIR · valider la récompense"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!fait && plan?.mode === "tiers" ? (
        <View style={styles.zoneBoutons}>
          <Text style={styles.consigne} maxFontSizeMultiplier={1.6}>
            {noteValidee
              ? `Validé : ${noteValidee}. Encore un palier, ou touchez à côté pour terminer.`
              : "Choisissez le palier à valider."}
          </Text>
          {paliersRestants.length > 0 ? (
            paliersRestants.map((t) => (
              <Pressable
                key={t.threshold}
                testID={`bouton-palier-${t.threshold}`}
                accessibilityRole="button"
                accessibilityLabel={`Valider : ${t.reward}, ${t.threshold} points${
                  plan.maxThreshold !== null && t.threshold === plan.maxThreshold ? ", remet la carte à zéro" : ""
                }`}
                accessibilityState={{ disabled: enCours, busy: enCours }}
                disabled={enCours}
                onPress={() => void offrir(t)}
                style={({ pressed }) => [styles.boutonPalier, pressed && styles.boutonPresse]}
              >
                <Text style={styles.boutonTexte} maxFontSizeMultiplier={1.4}>
                  {t.reward}
                </Text>
                <Text style={styles.boutonSousTexte} maxFontSizeMultiplier={1.4}>
                  {t.threshold} points
                  {plan.maxThreshold !== null && t.threshold === plan.maxThreshold ? " · remet la carte à zéro" : ""}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.consigne} maxFontSizeMultiplier={1.6}>
              Tous les paliers disponibles ont été validés.
            </Text>
          )}
        </View>
      ) : null}

      {!fait && erreur ? (
        <Text testID="erreur-encaissement" accessibilityRole="alert" style={styles.erreur} maxFontSizeMultiplier={1.6}>
          {erreur}
        </Text>
      ) : null}

      <Text style={styles.reprendre} maxFontSizeMultiplier={1.6}>
        {fait ? "Toucher pour continuer" : "Toucher à côté pour continuer sans encaisser"}
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
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.warning,
  },
  contenu: { alignItems: "center", gap: spacing.sm },
  pastille: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.onyx,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  signe: { fontSize: 48, lineHeight: 56, fontWeight: "700", color: colors.onyx },
  titre: { fontSize: 44, lineHeight: 50, fontWeight: "800", textAlign: "center", color: colors.onyx },
  detail: { fontSize: 32, lineHeight: 38, fontWeight: "600", textAlign: "center", opacity: 0.95, color: colors.onyx },
  client: { ...type.body, textAlign: "center", opacity: 0.9, color: colors.onyx },
  message: { ...type.bodyStrong, textAlign: "center", opacity: 0.95, color: colors.onyx },
  consigne: { ...type.body, textAlign: "center", opacity: 0.85, color: colors.onyx, paddingHorizontal: spacing.md },
  zoneBoutons: { alignSelf: "stretch", gap: spacing.sm, alignItems: "stretch" },
  boutonOffrir: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.onyx,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  boutonPalier: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.onyx,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  boutonPresse: { opacity: 0.85 },
  boutonTexte: { ...type.bodyStrong, color: colors.white, textAlign: "center" },
  boutonSousTexte: { ...type.small, color: colors.white, opacity: 0.8, textAlign: "center" },
  erreur: { ...type.bodyStrong, color: colors.error, textAlign: "center", paddingHorizontal: spacing.md },
  reprendre: { ...type.small, opacity: 0.75, textAlign: "center", color: colors.onyx },
});
