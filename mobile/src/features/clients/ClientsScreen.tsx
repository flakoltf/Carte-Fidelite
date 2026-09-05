import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { colors, MIN_TOUCH_TARGET, radius, spacing, type } from "@/theme";

import { ClientSheet } from "./ClientSheet";
import { STAGE_LABELS, type SegmentSummary } from "./contracts";
import { filterClientRows, formatLastVisit, visitsLabel, type ClientRow, type StageFilter } from "./model";
import { LEGEND_ORDER, STAGE_STYLE } from "./stageStyle";
import { useClientsBase } from "./useClientsBase";

const FILTERS: StageFilter[] = ["all", ...LEGEND_ORDER];
const NO_ROWS: ClientRow[] = [];

/**
 * Onglet Clients : la base telle que le serveur la classe (segments), avec
 * recherche par nom, filtre par segment et fiche simple au tap.
 */
export function ClientsScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { state, refreshing, refresh, retry } = useClientsBase();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [selected, setSelected] = useState<ClientRow | null>(null);

  const rows = useMemo(() => (state.status === "ready" ? state.base.rows : NO_ROWS), [state]);
  const summary = state.status === "ready" ? state.base.summary : null;
  const filtered = useMemo(() => filterClientRows(rows, query, stage), [rows, query, stage]);

  return (
    <Screen testID="ecran-clients" contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CLIENTS</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Votre clientèle
        </Text>
        {summary ? <Text style={styles.subtitle}>{countLabel(summary.total)}</Text> : null}
      </View>

      {state.status === "ready" ? (
        <>
          <Field
            testID="recherche-clients"
            label="Rechercher"
            placeholder="Nom du client"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            {FILTERS.map((key) => (
              <Chip
                key={key}
                filter={key}
                summary={summary}
                selected={stage === key}
                onPress={() => setStage(key)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {state.status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.halo} />
          <Text style={styles.muted}>Chargement de vos clients…</Text>
        </View>
      ) : state.status === "error" ? (
        <Card title="Impossible d'afficher vos clients" subtitle={state.message}>
          <Button label="Réessayer" variant="secondary" onPress={() => void retry()} />
        </Card>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(row) => row.id}
          style={styles.list}
          contentContainerStyle={filtered.length === 0 ? styles.listEmpty : styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.halo} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ClientLine row={item} now={now} onPress={() => setSelected(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>
                {rows.length === 0 ? "Vos clients apparaîtront ici dès leur première carte." : "Aucun client ne correspond à votre recherche."}
              </Text>
              {rows.length === 0 ? (
                <Text style={styles.muted}>Affichez votre QR code en caisse : chaque carte ajoutée crée un client.</Text>
              ) : null}
            </View>
          }
        />
      )}

      <ClientSheet client={selected} now={now} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function countLabel(total: number): string {
  if (total === 0) return "Aucun client pour l'instant";
  return `${total} client${total > 1 ? "s" : ""}`;
}

function Chip({
  filter,
  summary,
  selected,
  onPress,
}: {
  filter: StageFilter;
  summary: SegmentSummary | null;
  selected: boolean;
  onPress: () => void;
}) {
  const label = filter === "all" ? "Tous" : STAGE_STYLE[filter].label;
  const count = summary ? (filter === "all" ? summary.total : summary.stages[filter].count) : null;
  const dot = filter === "all" ? null : STAGE_STYLE[filter].color;
  return (
    <Pressable
      testID={`segment-${filter}`}
      accessibilityRole="button"
      accessibilityLabel={filter === "all" ? "Tous les clients" : STAGE_LABELS[filter]}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
        {count !== null ? ` · ${count}` : ""}
      </Text>
    </Pressable>
  );
}

function ClientLine({ row, now, onPress }: { row: ClientRow; now: () => Date; onPress: () => void }) {
  const style = STAGE_STYLE[row.stage];
  return (
    <Pressable
      testID={`client-${row.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${STAGE_LABELS[row.stage]}, ${formatLastVisit(row.lastScan, now())}, ${visitsLabel(row.visits)}`}
      accessibilityHint="Ouvre la fiche du client"
      onPress={onPress}
      style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
    >
      <View style={[styles.avatar, { backgroundColor: style.color }]}>
        <Text style={styles.avatarText}>{row.initials}</Text>
      </View>
      <View style={styles.lineBody}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{formatLastVisit(row.lastScan, now())}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{visitsLabel(row.visits)}</Text>
        </View>
      </View>
      <View style={[styles.tag, { borderColor: style.color }]}>
        <Text style={[styles.tagText, { color: style.color }]}>{style.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: 0 },
  header: { gap: spacing.xs },
  eyebrow: { ...type.eyebrow, color: colors.halo },
  title: { ...type.h1, color: colors.ink },
  subtitle: { ...type.small, color: colors.inkMuted },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.halo, borderColor: colors.halo },
  chipPressed: { opacity: 0.8 },
  chipLabel: { ...type.small, fontWeight: "600", color: colors.ink },
  chipLabelSelected: { color: colors.white },
  dot: { width: 8, height: 8, borderRadius: 4 },
  list: { flex: 1, marginHorizontal: -spacing.lg },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  listEmpty: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  separator: { height: 1, backgroundColor: colors.line, marginLeft: spacing.lg + 44 + spacing.md },
  line: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  linePressed: { backgroundColor: "rgba(13,107,94,0.06)" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { ...type.bodyStrong, color: colors.white },
  lineBody: { flex: 1, gap: 2 },
  name: { ...type.bodyStrong, color: colors.ink },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { ...type.small, color: colors.inkMuted },
  metaDot: { ...type.small, color: colors.galet },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tagText: { ...type.caption, fontWeight: "600" },
  center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  muted: { ...type.small, color: colors.inkMuted, textAlign: "center" },
  emptyTitle: { ...type.body, color: colors.ink, textAlign: "center" },
});
