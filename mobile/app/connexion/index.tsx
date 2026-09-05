import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { HaloMark } from "@/components/HaloMark";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth/AuthContext";
import { isValidEmail } from "@/lib/authFlow";
import { colors, spacing, type } from "@/theme";

export default function ConnexionScreen() {
  const { status, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "signed-in") return <Redirect href="/(tabs)/comptoir" />;
  if (status === "mfa-required") return <Redirect href="/connexion/code" />;

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError("Entrez une adresse e-mail valide.");
      return;
    }
    if (password.length === 0) {
      setError("Entrez votre mot de passe.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tone="dark" scroll contentStyle={styles.content} testID="ecran-connexion">
      <View style={styles.brand}>
        <HaloMark size={56} />
        <Text style={styles.wordmark}>HALO</Text>
        <Text style={styles.tagline}>Le comptoir, dans votre poche.</Text>
      </View>

      <View style={styles.form}>
        <Field
          testID="champ-email"
          tone="dark"
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          placeholder="vous@votrecommerce.ch"
          returnKeyType="next"
          editable={!busy}
        />
        <Field
          testID="champ-mot-de-passe"
          tone="dark"
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
          error={error}
        />
        <Button testID="bouton-connexion" label="Se connecter" onPress={submit} loading={busy} />
      </View>

      <Text style={styles.footnote}>
        Un compte HALO est créé par nos soins. Mot de passe oublié ? Écrivez-nous à
        contact@halocard.ch.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", gap: spacing.xl, paddingVertical: spacing.xl },
  brand: { alignItems: "center", gap: spacing.md },
  wordmark: { ...type.h1, color: colors.calcaire, letterSpacing: 6 },
  tagline: { ...type.body, color: colors.galet, textAlign: "center" },
  form: { gap: spacing.md },
  footnote: { ...type.caption, color: colors.galet, textAlign: "center" },
});
