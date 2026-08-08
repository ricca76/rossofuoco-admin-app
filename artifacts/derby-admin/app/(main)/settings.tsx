import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTip } from "@/context/TipContext";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { signOut, adminName } = useAuth();
  const { config: tipConfig, updateConfig: updateTipConfig } = useTip();

  const handleToggleCassaMode = async () => {
    const next = tipConfig.cassaMode === "condiviso" ? "singolo" : "condiviso";
    Haptics.selectionAsync();
    await updateTipConfig({ cassaMode: next });
  };

  const handleSignOut = async () => {
    Alert.alert("Disconnetti", "Vuoi disconnetterti dall'account admin?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Disconnetti",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 24);
  const isCondiviso = tipConfig.cassaMode === "condiviso";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── ACCOUNT ── */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        ACCOUNT
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.accountRow}>
          <View style={[styles.avatar, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="user" size={20} color={theme.primary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={[styles.accountName, { color: theme.foreground }]}>
              {adminName ?? "Amministratore"}
            </Text>
            <Text style={[styles.accountRole, { color: theme.mutedForeground }]}>
              Amministratore · Rosso Fuoco
            </Text>
          </View>
        </View>
      </View>

      {/* ── MODALITÀ INCASSO ── */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        MODALITÀ INCASSO
      </Text>

      <TouchableOpacity
        style={[
          styles.card,
          styles.modeCard,
          {
            backgroundColor: theme.card,
            borderColor: isCondiviso ? theme.primary + "60" : theme.border,
          },
        ]}
        onPress={handleToggleCassaMode}
        activeOpacity={0.85}
      >
        <View style={[
          styles.modeBadge,
          { backgroundColor: isCondiviso ? theme.primary : theme.muted },
        ]}>
          <Feather
            name={isCondiviso ? "users" : "user"}
            size={18}
            color={isCondiviso ? "#fff" : theme.mutedForeground}
          />
        </View>
        <View style={styles.modeCardInfo}>
          <Text style={[styles.modeCardTitle, { color: theme.foreground }]}>
            {isCondiviso ? "Incasso condiviso" : "Incasso singolo"}
          </Text>
          <Text style={[styles.modeCardSub, { color: theme.mutedForeground }]}>
            {isCondiviso
              ? "Solo il manager chiude i conti · Cassa abilitata"
              : "Ogni cameriere chiude i propri conti · Cassa disabilitata"}
          </Text>
        </View>
        <View style={[
          styles.modeSwitch,
          { backgroundColor: isCondiviso ? theme.primary : theme.muted },
        ]}>
          <View style={[
            styles.modeSwitchThumb,
            { transform: [{ translateX: isCondiviso ? 16 : 0 }] },
          ]} />
        </View>
      </TouchableOpacity>

      <Text style={[styles.hint, { color: theme.mutedForeground }]}>
        {isCondiviso
          ? "Modalità fine settimana o alta stagione — il tab Cassa è visibile nella barra."
          : "Modalità standard — il tab Cassa è nascosto. Attivalo nei periodi ad alto afflusso."}
      </Text>

      {/* ── SESSIONE ── */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        SESSIONE
      </Text>
      <TouchableOpacity
        style={[styles.card, styles.signOutBtn, { backgroundColor: theme.card, borderColor: theme.destructive + "40" }]}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={18} color={theme.destructive} />
        <Text style={[styles.signOutText, { color: theme.destructive }]}>
          Disconnetti account
        </Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: theme.mutedForeground }]}>
        Rosso Admin · Rosso Fuoco Console
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 2,
    marginLeft: 4,
    marginTop: 6,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  accountInfo: { gap: 2 },
  accountName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  accountRole: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    overflow: "visible",
  },
  modeBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modeCardInfo: { flex: 1, gap: 3 },
  modeCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modeCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  modeSwitch: {
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  modeSwitchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
    marginTop: -4,
    lineHeight: 17,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 12,
  },
});
