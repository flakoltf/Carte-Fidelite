import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { HaloMark } from "@/components/HaloMark";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth/AuthContext";
import { isValidTotpCode } from "@/lib/authFlow";
import { colors, spacing, type } from "@/theme";

/** Second facteur : le compte a la double authentification activée. */
export default function CodeScreen() {
  const { status, pendingEmail, verifyTotp, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "signed-in") return <Redirect href="/(tabs)/comptoir" />;
  if (status === "signed-out") return <Redirect href="/connexion" />;

  const submit = async () => {
    if (!isValidTotpCode(code)) {
      setError("Entrez le code à six chiffres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Code incorrect. Réessayez.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tone="dark" scroll contentStyle={styles.content} testID="ecran-code">
      <View style={styles.brand}>
        <HaloMark size={48} />
        <Text accessibilityRole="header" style={styles.title}>
          Vérification en deux étapes
        </Text>
        <Text style={styles.subtitle}>
          Entrez le code affiché par votre application d&apos;authentification
          {pendingEmail ? ` pour ${pendingEmail}` : ""}.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          testID="champ-code"
          tone="dark"
          label="Code à six chiffres"
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          placeholder="123456"
          editable={!busy}
          error={error}
          inputStyle={styles.codeInput}
        />
        <Button testID="bouton-verifier" label="Vérifier" onPress={submit} loading={busy} />
        <Button
          testID="bouton-annuler"
          label="Annuler et se déconnecter"
          variant="ghost"
          onPress={() => void signOut()}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", gap: spacing.xl, paddingVertical: spacing.xl },
  brand: { alignItems: "center", gap: spacing.md },
  title: { ...type.h2, color: colors.calcaire, textAlign: "center" },
  subtitle: { ...type.small, color: colors.galet, textAlign: "center" },
  form: { gap: spacing.md },
  codeInput: { textAlign: "center", fontSize: 24, letterSpacing: 8 },
});
