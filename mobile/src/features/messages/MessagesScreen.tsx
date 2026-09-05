import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { fetchSegmentSummary } from "@/features/clients/loadClientsBase";
import type { SegmentSummary } from "@/features/clients/contracts";
import { colors, MIN_TOUCH_TARGET, radius, spacing, type } from "@/theme";

import {
  AUDIENCE_KEYS,
  audienceLabel,
  audienceSize,
  sendResultMessage,
  validateMessage,
  type AudienceKey,
  type MessageErrors,
  type ResultMessage,
} from "./model";
import { sendMessage } from "./sendMessage";

/**
 * Onglet Messages : écrire à un groupe de clients, sur leur téléphone. Mêmes
 * audiences, mêmes règles et même confirmation que le tableau de bord.
 */
export function MessagesScreen() {
  const [summary, setSummary] = useState<SegmentSummary | null>(null);
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<MessageErrors>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSegmentSummary()
      .then((s) => {
        if (alive) setSummary(s);
      })
      .catch(() => {
        // Sans résumé, le formulaire reste utilisable : les tailles sont simplement absentes.
      });
    return () => {
      alive = false;
    };
  }, []);

  const size = audienceSize(summary, audience);

  const submit = async () => {
    setResult(null);
    setFailure(null);
    const validated = validateMessage({ title, body });
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const res = await sendMessage({ ...validated.value, audience });
      setResult(sendResultMessage(res));
      setTitle("");
      setBody("");
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : "L'envoi a échoué. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen testID="ecran-messages" scroll>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MESSAGES</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Relancer vos clients
        </Text>
        <Text style={styles.description}>
          {"Une offre, une nouveauté, un rappel : le message s'affiche sur le téléphone de vos clients, sans SMS ni frais."}
        </Text>
      </View>

      <Card title="À qui ?" subtitle={summary ? reachableLabel(summary) : undefined}>
        <View style={styles.audiences} accessibilityRole="radiogroup">
          {AUDIENCE_KEYS.map((key) => {
            const n = audienceSize(summary, key);
            const selected = key === audience;
            return (
              <Pressable
                key={key}
                testID={`audience-${key}`}
                accessibilityRole="radio"
                accessibilityLabel={audienceLabel(key)}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => setAudience(key)}
                style={({ pressed }) => [styles.audience, selected && styles.audienceSelected, pressed && styles.pressed]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.audienceLabel, selected && styles.audienceLabelSelected]}>{audienceLabel(key)}</Text>
                {n !== null ? <Text style={styles.audienceCount}>{sizeLabel(n)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {size === 0 ? (
          <Text style={styles.warning} accessibilityLiveRegion="polite">
            {"Personne dans ce groupe pour l'instant."}
          </Text>
        ) : null}
      </Card>

      <Card title="Votre message">
        <Field
          testID="champ-titre"
          label="Titre"
          placeholder="Ex. Offre du week-end"
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
          }}
          error={errors.title}
          returnKeyType="next"
        />
        <Field
          testID="champ-message"
          label="Message"
          placeholder="Ce que vos clients liront sur leur téléphone"
          value={body}
          onChangeText={(v) => {
            setBody(v);
            if (errors.body) setErrors((e) => ({ ...e, body: undefined }));
          }}
          error={errors.body}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          inputStyle={styles.multiline}
        />
        <Button
          testID="bouton-envoyer"
          label="Envoyer à mes clients"
          loading={sending}
          onPress={() => void submit()}
          accessibilityHint="Envoie le message au groupe choisi"
        />
        {result ? (
          <Text
            testID="resultat-envoi"
            accessibilityLiveRegion="polite"
            style={[styles.result, result.tone === "warning" ? styles.resultWarning : styles.resultSuccess]}
          >
            {result.text}
          </Text>
        ) : null}
        {failure ? (
          <Text accessibilityLiveRegion="assertive" style={[styles.result, styles.resultError]}>
            {failure}
          </Text>
        ) : null}
      </Card>

      <Text style={styles.note}>
        Messages programmés, relances automatiques et historique se gèrent depuis le tableau de bord, sur ordinateur.
      </Text>
    </Screen>
  );
}

function sizeLabel(n: number): string {
  if (n === 0) return "Aucun client";
  return `${n} client${n > 1 ? "s" : ""}`;
}

function reachableLabel(summary: SegmentSummary): string {
  const n = summary.flags.joignable_push;
  if (n === 0) return "Aucun client n'a encore sa carte dans son téléphone.";
  return n === 1
    ? "1 client a sa carte dans son téléphone et peut recevoir vos messages."
    : `${n} clients ont leur carte dans leur téléphone et peuvent recevoir vos messages.`;
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  eyebrow: { ...type.eyebrow, color: colors.halo },
  title: { ...type.h1, color: colors.ink },
  description: { ...type.body, color: colors.inkMuted },
  audiences: { gap: spacing.xs },
  audience: {
    minHeight: MIN_TOUCH_TARGET + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  audienceSelected: { backgroundColor: colors.glowSoft, borderColor: colors.glow },
  pressed: { opacity: 0.8 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.galet,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.halo },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.halo },
  audienceLabel: { ...type.body, color: colors.ink, flex: 1 },
  audienceLabelSelected: { fontWeight: "600" },
  audienceCount: { ...type.small, color: colors.inkMuted },
  warning: { ...type.small, color: colors.error, marginTop: spacing.xs },
  multiline: { minHeight: 112, paddingTop: spacing.sm + 4 },
  result: { ...type.small, marginTop: spacing.xs },
  resultSuccess: { color: colors.halo },
  resultWarning: { color: colors.error },
  resultError: { color: colors.error },
  note: { ...type.caption, color: colors.inkMuted, textAlign: "center" },
});
