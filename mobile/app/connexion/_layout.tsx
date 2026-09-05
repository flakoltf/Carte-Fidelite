import { Stack } from "expo-router";

import { colors } from "@/theme";

export default function ConnexionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.onyx },
      }}
    />
  );
}
