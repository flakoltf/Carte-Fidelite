import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

import { TabIcon } from "@/components/TabIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import { colors, MIN_TOUCH_TARGET, type } from "@/theme";

export default function TabsLayout() {
  const { status } = useAuth();

  // Garde de navigation : aucun onglet n'est atteignable sans session complète.
  if (status === "signed-out") return <Redirect href="/connexion" />;
  if (status === "mfa-required") return <Redirect href="/connexion/code" />;
  if (status === "loading") return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.halo,
        tabBarInactiveTintColor: colors.galet,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          // Chaque onglet garde une cible tactile confortable.
          minHeight: MIN_TOUCH_TARGET + 12,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...type.caption, fontWeight: "600" },
        tabBarItemStyle: Platform.select({ ios: { paddingVertical: 4 }, default: {} }),
      }}
    >
      <Tabs.Screen
        name="comptoir"
        options={{
          title: "Comptoir",
          tabBarIcon: ({ color }) => <TabIcon name="comptoir" color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <TabIcon name="clients" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <TabIcon name="messages" color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => <TabIcon name="menu" color={color} />,
        }}
      />
    </Tabs>
  );
}
