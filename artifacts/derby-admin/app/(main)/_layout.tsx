import { Stack } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
import { RequestsProvider } from "@/context/RequestsContext";

export default function MainLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  return (
    <RequestsProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: {
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
          },
          headerBackTitle: "Indietro",
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="requests" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ headerShown: false }} />
        <Stack.Screen name="receipts" options={{ headerShown: false }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen
          name="request/[id]"
          options={{
            title: "Dettaglio Richiesta",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="receipt/[id]"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Impostazioni",
            presentation: "modal",
          }}
        />
      </Stack>
    </RequestsProvider>
  );
}
