import { useEffect, useMemo } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { createSupabaseAuthGateway } from "@/lib/auth/supabaseGateway";
import { startSessionAutoRefresh } from "@/lib/supabase";
import { colors } from "@/theme";

export default function RootLayout() {
  // Une seule instance de passerelle pour toute la vie de l'app.
  const gateway = useMemo(() => createSupabaseAuthGateway(), []);

  useEffect(() => startSessionAutoRefresh(), []);

  return (
    <SafeAreaProvider>
      <AuthProvider gateway={gateway}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.calcaire },
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
