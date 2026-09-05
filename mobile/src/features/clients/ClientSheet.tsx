import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { colors, radius, spacing, type } from "@/theme";

import { STAGE_LABELS } from "./contracts";
import { formatLastVisit, visitsLabel, type ClientRow } from "./model";
import { STAGE_STYLE } from "./stageStyle";

/**
 * Fiche client SIMPLE : les mêmes informations que la ligne, en grand. La fiche
 * complète (coordonnées, modification, suppression) reste sur le tableau de bord.
 */
export function ClientSheet({
  client,
  now,
  onClose,
}: {
  client: ClientRow | null;
  now: () => Date;
  onClose: () => void;
}) {
  return (
    <Modal visible={client !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer la fiche" />
      {client ? (
        <View testID="fiche-client" style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={[styles.avatar, { backgroundColor: STAGE_STYLE[client.stage].color }]}>
            <Text style={styles.avatarText}>{client.initials}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.name}>
            {client.name}
          </Text>

          <View style={styles.rows}>
            <Row label="Segment" value={STAGE_LABELS[client.stage]} />
            <Row label="Dernier passage" value={formatLastVisit(client.lastScan, now())} />
            <Row label="Visites" value={visitsLabel(client.visits)} />
          </View>

          <Text style={styles.note}>
            Coordonnées, modification et suppression se font depuis le tableau de bord, sur ordinateur.
          </Text>
          <Button label="Fermer" variant="secondary" onPress={onClose} />
        </View>
      ) : null}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(14,15,17,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarText: { ...type.h2, color: colors.white },
  name: { ...type.h1, color: colors.ink, textAlign: "center" },
  rows: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { ...type.small, color: colors.inkMuted },
  rowValue: { ...type.bodyStrong, color: colors.ink },
  note: { ...type.caption, color: colors.inkMuted, textAlign: "center" },
});
