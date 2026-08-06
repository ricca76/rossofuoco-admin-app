import { Feather } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useTip } from "@/context/TipContext";

const ALL_TABS = [
  { href: "/(main)/requests" as const, icon: "bell" as const, label: "Richieste", cassaOnly: false },
  { href: "/(main)/history" as const, icon: "clock" as const, label: "Storico", cassaOnly: false },
  { href: "/(main)/receipts" as const, icon: "file-text" as const, label: "Scontrini", cassaOnly: false },
  { href: "/(main)/cassa" as const, icon: "dollar-sign" as const, label: "Cassa", cassaOnly: true },
  { href: "/(main)/summary" as const, icon: "bar-chart-2" as const, label: "Riepilogo", cassaOnly: false },
  { href: "/(main)/messages" as const, icon: "printer" as const, label: "Messaggi", cassaOnly: false },
] as const;

export function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const pathname = usePathname();
  const { config } = useTip();

  const tabs = ALL_TABS.filter(
    (t) => !t.cassaOnly || config.cassaMode === "condiviso"
  );

  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          paddingBottom: bottomPad,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href);
        return (
          <TouchableOpacity
            key={tab.href}
            style={styles.tab}
            onPress={() => {
              if (!isActive) {
                router.replace(tab.href as never);
              }
            }}
            activeOpacity={0.7}
          >
            <Feather
              name={tab.icon}
              size={20}
              color={isActive ? theme.primary : theme.mutedForeground}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? theme.primary : theme.mutedForeground,
                  fontFamily: isActive
                    ? "Inter_600SemiBold"
                    : "Inter_400Regular",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
