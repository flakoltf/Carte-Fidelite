import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";

import { FocusedStatusBar } from "@/components/FocusedStatusBar";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors, radius, spacing, type } from "@/theme";

import { BandeauAnnuler, NoteAnnulation } from "./components/BandeauAnnuler";
import { ChiffresDuJour } from "./components/ChiffresDuJour";
import { DemandePermission } from "./components/DemandePermission";
import { EncaissementRecompense } from "./components/EncaissementRecompense";
import { PaveMontant } from "./components/PaveMontant";
import { ResultatPleinEcran } from "./components/ResultatPleinEcran";
import { Viseur } from "./components/Viseur";
import { revertSecondsLeft, type RevertableLoyaltyType } from "./revertRules";
import { submitRevert, submitScan } from "./scanApi";
import type { ScanOutcome, ScanOutcomeKind } from "./scanContract";
import { useCameraActive } from "./useCameraActive";
import { useComptoirStats } from "./useComptoirStats";

// Un crédit disparaît tout seul : zéro tap entre deux clients (le web fait de
// même, SCAN_CONTINU_MS). Un doublon s'efface aussi, un peu plus lentement.
// Tout le reste attend un geste : récompense à offrir, carte inconnue, refus.
const FERMETURE_AUTO_MS: Partial<Record<ScanOutcomeKind, number>> = {
  credit: 1500,
  cooldown: 2500,
};

// Le même QR reste devant l'objectif après un crédit : on ignore une relecture
// immédiate pour ne pas afficher un « déjà scanné » à chaque passage. Pur
// confort d'affichage — le serveur reste seul juge du cooldown.
const RELECTURE_IGNOREE_MS = 3000;

interface CreditAnnulable {
  cardId: string;
  loyaltyType: RevertableLoyaltyType;
  at: Date;
}

export function ComptoirScreen() {
  const { merchant } = useAuth();
  const [permission, demanderPermission] = useCameraPermissions();
  const { stats, chargement, rafraichir } = useComptoirStats(merchant?.id);
  // Caméra allumée SEULEMENT onglet visible + app au premier plan (A1).
  const cameraActive = useCameraActive();

  const [enCoursDeScan, setEnCoursDeScan] = useState(false);
  const [resultat, setResultat] = useState<ScanOutcome | null>(null);
  const [torche, setTorche] = useState(false);

  const [annulable, setAnnulable] = useState<CreditAnnulable | null>(null);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const [noteAnnulation, setNoteAnnulation] = useState<string | null>(null);

  // Pavé CHF (programmes amount_points) : envoi en vol + échec du dernier envoi.
  const [montantEnCours, setMontantEnCours] = useState(false);
  const [montantErreur, setMontantErreur] = useState<string | null>(null);

  // Redemande un rendu chaque seconde pour le décompte d'annulation.
  const [, battement] = useReducer((n: number) => n + 1, 0);

  // Garde synchrone : la caméra peut livrer plusieurs lectures avant que l'état
  // React ne se propage.
  const occupe = useRef(false);
  const derniereLecture = useRef<{ valeur: string; at: number } | null>(null);

  // Post-traitement COMMUN d'un résultat de scan (viseur ou pavé CHF) : le
  // bandeau d'annulation vise toujours le DERNIER crédit, jamais un client
  // précédent, et chaque résultat a UN retour haptique (D11) : crédit = impact
  // léger (le geste ordinaire, pavé CHF ouvert compris), récompense = succès
  // marqué, doublon = avertissement, refus = erreur.
  const appliquerResultat = useCallback(
    (outcome: ScanOutcome) => {
      setNoteAnnulation(null);
      setAnnulable(outcome.revert ? { ...outcome.revert, at: new Date() } : null);
      setResultat(outcome);

      if (outcome.kind === "credit" || outcome.kind === "amount-required") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (outcome.kind === "credit") void rafraichir();
      } else if (outcome.kind === "reward") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void rafraichir();
      } else if (outcome.kind === "cooldown") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [rafraichir],
  );

  const traiterCode = useCallback(
    async (valeur: string) => {
      const maintenant = Date.now();
      const precedente = derniereLecture.current;
      if (occupe.current) return;
      if (precedente && precedente.valeur === valeur && maintenant - precedente.at < RELECTURE_IGNOREE_MS) {
        return;
      }
      occupe.current = true;
      derniereLecture.current = { valeur, at: maintenant };
      setEnCoursDeScan(true);

      const outcome = await submitScan(valeur);
      setEnCoursDeScan(false);
      appliquerResultat(outcome);
    },
    [appliquerResultat],
  );

  // Pavé CHF : renvoie le MÊME scan avec le montant tapé. Réseau coupé → le
  // pavé reste ouvert, montant conservé, « Réessayer » — jamais d'impasse.
  const crediterMontant = useCallback(
    async (montantChf: number) => {
      if (!resultat || montantEnCours) return;
      setMontantEnCours(true);
      const outcome = await submitScan(resultat.cardId, undefined, montantChf);
      setMontantEnCours(false);
      if (outcome.kind === "offline") {
        setMontantErreur("Pas de réseau — le crédit n'a pas été enregistré.");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setMontantErreur(null);
      appliquerResultat(outcome);
    },
    [resultat, montantEnCours, appliquerResultat],
  );

  const fermerResultat = useCallback(() => {
    setResultat(null);
    setMontantErreur(null);
    // La lecture suivante redevient possible immédiatement (hors même QR).
    occupe.current = false;
  }, []);

  // Android : le bouton retour matériel ferme le résultat, jamais l'app (A4).
  // Pendant un crédit au montant en vol, il ne ferme rien : on ne quitte jamais
  // un envoi sans voir son verdict (l'encaissement a sa propre garde).
  useEffect(() => {
    if (!resultat) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!montantEnCours) fermerResultat();
      return true;
    });
    return () => subscription.remove();
  }, [resultat, montantEnCours, fermerResultat]);

  // Fermeture automatique des états qui n'appellent aucune décision.
  useEffect(() => {
    if (!resultat) return;
    const delai = FERMETURE_AUTO_MS[resultat.kind];
    if (!delai) return;
    const id = setTimeout(fermerResultat, delai);
    return () => clearTimeout(id);
  }, [resultat, fermerResultat]);

  // Décompte de la fenêtre d'annulation. Le reste se CALCULE au rendu (pas de
  // valeur dupliquée dans un état) ; le minuteur ne sert qu'à redemander un
  // rendu chaque seconde, et s'arrête de lui-même à l'expiration. Affichage
  // seul : c'est la RPC `scan_revert` qui accepte ou refuse.
  useEffect(() => {
    if (!annulable) return;
    const id = setInterval(() => {
      if (revertSecondsLeft(annulable.at, new Date()) <= 0) clearInterval(id);
      battement();
    }, 1000);
    return () => clearInterval(id);
  }, [annulable]);

  // La confirmation d'annulation ne s'installe jamais à l'écran.
  useEffect(() => {
    if (!noteAnnulation) return;
    const id = setTimeout(() => setNoteAnnulation(null), 3000);
    return () => clearTimeout(id);
  }, [noteAnnulation]);

  const annuler = useCallback(async () => {
    if (!annulable || annulationEnCours) return;
    setAnnulationEnCours(true);
    const resultatAnnulation = await submitRevert(annulable.cardId, annulable.loyaltyType);
    setNoteAnnulation(resultatAnnulation.message);
    setAnnulable(null);
    setAnnulationEnCours(false);
    if (resultatAnnulation.ok) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void rafraichir();
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [annulable, annulationEnCours, rafraichir]);

  const secondesRestantes = annulable ? revertSecondsLeft(annulable.at, new Date()) : 0;

  // Permission caméra : on attend la réponse du système avant de décider.
  if (!permission) {
    return (
      <View style={styles.attente} testID="ecran-comptoir">
        <FocusedStatusBar style="light" />
        <ActivityIndicator color={colors.glow} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.racine} edges={["top", "left", "right"]} testID="ecran-comptoir">
        <FocusedStatusBar style="light" />
        <DemandePermission
          refuseeDefinitivement={!permission.canAskAgain}
          onDemander={() => void demanderPermission()}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.racine} testID="ecran-comptoir">
      <FocusedStatusBar style="light" />
      <SafeAreaView edges={["top", "left", "right"]}>
        <ChiffresDuJour stats={stats} chargement={chargement} />
      </SafeAreaView>

      <View style={styles.zoneCamera}>
        {cameraActive ? (
          <Viseur
            actif={!enCoursDeScan && resultat === null}
            torche={torche}
            onBasculerTorche={() => setTorche((t) => !t)}
            onCodeLu={(valeur) => void traiterCode(valeur)}
          />
        ) : (
          // Onglet quitté ou app en arrière-plan : la caméra est DÉMONTÉE
          // (pas seulement masquée) — aucune capture hors écran.
          <View style={styles.pause} testID="camera-en-pause">
            <Text style={styles.pauseTexte}>Caméra en pause</Text>
          </View>
        )}

        <View style={styles.surcouche} pointerEvents="box-none">
          {noteAnnulation ? (
            <NoteAnnulation texte={noteAnnulation} />
          ) : annulable && secondesRestantes > 0 ? (
            <BandeauAnnuler
              loyaltyType={annulable.loyaltyType}
              secondesRestantes={secondesRestantes}
              enCours={annulationEnCours}
              onAnnuler={() => void annuler()}
            />
          ) : null}
        </View>

        {enCoursDeScan ? (
          <View style={styles.verification} pointerEvents="none" testID="verification">
            <ActivityIndicator color={colors.calcaire} />
            <Text style={styles.verificationTexte}>Vérification…</Text>
          </View>
        ) : null}
      </View>

      {/* Trois plein-écrans possibles : pavé CHF (crédit au montant),
          encaissement (récompense atteinte ET encaissable), résultat simple. */}
      {resultat?.kind === "amount-required" ? (
        <PaveMontant
          customerName={resultat.customerName}
          enCours={montantEnCours}
          erreur={montantErreur}
          onCrediter={(montantChf) => void crediterMontant(montantChf)}
          onFermer={fermerResultat}
        />
      ) : resultat?.kind === "reward" && resultat.redeem ? (
        <EncaissementRecompense outcome={resultat} onFermer={fermerResultat} onEncaisse={() => void rafraichir()} />
      ) : resultat ? (
        <ResultatPleinEcran outcome={resultat} onFermer={fermerResultat} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: colors.onyx },
  attente: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.onyx },
  zoneCamera: { flex: 1, overflow: "hidden" },
  pause: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.onyx },
  pauseTexte: { ...type.small, color: colors.galet },
  surcouche: { position: "absolute", top: spacing.md, left: 0, right: 0, alignItems: "center" },
  verification: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: "rgba(14,15,17,0.78)",
  },
  verificationTexte: { ...type.bodyStrong, color: colors.calcaire },
});
