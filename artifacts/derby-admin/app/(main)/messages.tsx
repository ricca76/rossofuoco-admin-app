import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar } from "@/components/BottomTabBar";
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import {
  PrinterGroup,
  getPrinterGroups,
  sendPrinterMessage,
} from "@/services/derbyApi";

const QUICK_MESSAGES = [
  "Attenzione: chiusura imminente",
  "Pausa 15 minuti",
  "Servizio rallentato",
  "Terminato ingrediente",
  "Urgente: venire in cassa",
];

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { adminName } = useAuth();

  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  useEffect(() => {
    getPrinterGroups()
      .then((g) => setGroups(g))
      .catch(() => {})
      .finally(() => setLoadingGroups(false));
  }, []);

  const toggleGroup = (pgId: string) => {
    Haptics.selectionAsync();
    setSelectedGroupIds((prev) =>
      prev.includes(pgId) ? prev.filter((id) => id !== pgId) : [...prev, pgId]
    );
  };

  const selectAll = () => {
    Haptics.selectionAsync();
    if (selectedGroupIds.length === groups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groups.map((g) => g.pgId));
    }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      Alert.alert("Messaggio vuoto", "Scrivi un messaggio prima di inviare.");
      return;
    }
    setSending(true);
    try {
      const pgIds =
        selectedGroupIds.length > 0 ? selectedGroupIds : undefined;
      await sendPrinterMessage(text, pgIds, adminName ?? "Admin");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore invio messaggio";
      Alert.alert("Errore invio", msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding + 8, paddingBottom: 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Text style={[styles.headerTitle, { color: theme.foreground }]}>
          Messaggi Stampanti
        </Text>
        <Text
          style={[styles.headerSubtitle, { color: theme.mutedForeground }]}
        >
          Invia un messaggio alle stampanti del locale
        </Text>

        {/* Destination */}
        <Text
          style={[styles.sectionLabel, { color: theme.mutedForeground }]}
        >
          DESTINATARIO
        </Text>
        <View
          style={[
            styles.groupsCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {loadingGroups ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text
                style={[
                  styles.loadingText,
                  { color: theme.mutedForeground },
                ]}
              >
                Caricamento stampanti...
              </Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.loadingRow}>
              <Feather
                name="printer"
                size={16}
                color={theme.mutedForeground}
              />
              <Text
                style={[
                  styles.loadingText,
                  { color: theme.mutedForeground },
                ]}
              >
                Tutte le stampanti configurate
              </Text>
            </View>
          ) : (
            <>
              {/* Tutti */}
              <TouchableOpacity
                style={[
                  styles.groupRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={selectAll}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor:
                        selectedGroupIds.length === groups.length
                          ? theme.primary
                          : theme.border,
                      backgroundColor:
                        selectedGroupIds.length === groups.length
                          ? theme.primary
                          : "transparent",
                    },
                  ]}
                >
                  {selectedGroupIds.length === groups.length && (
                    <Feather name="check" size={12} color="#fff" />
                  )}
                </View>
                <Text
                  style={[styles.groupName, { color: theme.foreground }]}
                >
                  Tutte le stampanti
                </Text>
              </TouchableOpacity>

              {groups.map((g, idx) => {
                const isSelected = selectedGroupIds.includes(g.pgId);
                const isLast = idx === groups.length - 1;
                return (
                  <TouchableOpacity
                    key={g.pgId}
                    style={[
                      styles.groupRow,
                      !isLast && {
                        borderBottomColor: theme.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                    onPress={() => toggleGroup(g.pgId)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected
                            ? theme.primary
                            : theme.border,
                          backgroundColor: isSelected
                            ? theme.primary
                            : "transparent",
                        },
                      ]}
                    >
                      {isSelected && (
                        <Feather name="check" size={12} color="#fff" />
                      )}
                    </View>
                    <Feather
                      name="printer"
                      size={15}
                      color={
                        isSelected ? theme.primary : theme.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        styles.groupName,
                        {
                          color: isSelected
                            ? theme.foreground
                            : theme.mutedForeground,
                        },
                      ]}
                    >
                      {g.pgName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>

        {/* Quick messages */}
        <Text
          style={[styles.sectionLabel, { color: theme.mutedForeground }]}
        >
          MESSAGGI RAPIDI
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickList}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_MESSAGES.map((qm) => (
            <TouchableOpacity
              key={qm}
              style={[
                styles.quickChip,
                {
                  backgroundColor:
                    message === qm
                      ? theme.primary + "20"
                      : theme.card,
                  borderColor:
                    message === qm ? theme.primary : theme.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setMessage(qm);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.quickChipText,
                  {
                    color:
                      message === qm ? theme.primary : theme.foreground,
                  },
                ]}
              >
                {qm}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Message input */}
        <Text
          style={[styles.sectionLabel, { color: theme.mutedForeground }]}
        >
          MESSAGGIO
        </Text>
        <View
          style={[
            styles.inputBox,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: theme.foreground }]}
            placeholder="Scrivi un messaggio per le stampanti..."
            placeholderTextColor={theme.mutedForeground}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {message.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setMessage("")}
            >
              <Feather
                name="x-circle"
                size={16}
                color={theme.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: sent
                ? theme.success
                : theme.primary,
              opacity: sending ? 0.7 : 1,
            },
          ]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : sent ? (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>Inviato!</Text>
            </>
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>
                {selectedGroupIds.length === 0
                  ? "Invia a tutte le stampanti"
                  : `Invia a ${selectedGroupIds.length} stampant${selectedGroupIds.length === 1 ? "e" : "i"}`}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sender info */}
        <Text
          style={[styles.senderNote, { color: theme.mutedForeground }]}
        >
          Mittente: {adminName ?? "Admin"}
        </Text>
      </KeyboardAwareScrollView>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 8 },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 4,
    marginTop: 8,
  },
  groupsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  quickList: {
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 120,
  },
  textInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 80,
  },
  clearBtn: {
    alignSelf: "flex-end",
    padding: 4,
    marginTop: 4,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  senderNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 4,
  },
});
