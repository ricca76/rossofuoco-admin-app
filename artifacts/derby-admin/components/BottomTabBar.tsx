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

const TABS = [
  {
    href: "/(main)/requests" as const,
    icon: "bell" as const,
    label: "Richieste",
  },
  {
    href: "/(main)/history" as const,
    icon: "clock" as const,
    label: "Storico",
  },
  {
    href: "/(main)/receipts" as const,
    icon: "file-text" as const,
    label: "Scontrini",
  },
  {
    href: "/(main)/messages" as const,
    icon: "printer" as const,
    label: "Messaggi",
  },
] as const;

export function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const pathname = usePathname();

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
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href);
        return (
          <TouchableOpacity
            key={tab.href}
            style={styles.tab}
            onPress={() => {
              if (!isActive) {
                router.replace(tab.href);
              }
            }}
            activeOpacity={0.7}
          >
            <Feather
              name={tab.icon}
              size={22}
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
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
