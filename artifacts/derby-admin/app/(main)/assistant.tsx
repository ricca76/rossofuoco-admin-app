import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { REPLIT_API_BASE } from "@/constants/apiConfig";
import { useAuth } from "@/context/AuthContext";
import { useRequests } from "@/context/RequestsContext";
import { BottomTabBar } from "@/components/BottomTabBar";
import {
  sendPrinterMessage,
  reprintTicket,
  getPrinterGroups,
  type PrinterGroup,
} from "@/services/derbyApi";

// ── Safe speech-recognition loading ──────────────────────────────────────────
// expo-speech-recognition è un modulo nativo: non disponibile in Expo Go.
// L'import statico causerebbe crash immediato; usiamo require() protetto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ExpoSpeechRecognitionModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useSpeechRecognitionEvent: (event: string, handler: (e: any) => void) => void = () => {};

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule ?? null;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent ?? (() => {});
} catch {
  // Expo Go o build senza modulo nativo — speech disabilitato
}

const SPEECH_AVAILABLE = !!ExpoSpeechRecognitionModule;

const API_BASE = REPLIT_API_BASE;

interface AIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: string;
  status?: "ok" | "error";
  timestamp: number;
}

type AppState = "idle" | "listening" | "processing";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: mic button + speech hooks (native build only).
// Hooks are called unconditionally at top level — never conditionally.
// This component is only RENDERED when SPEECH_AVAILABLE is true.
// ─────────────────────────────────────────────────────────────────────────────
function MicController({
  appState,
  transcript,
  onTranscriptReady,
  onStateChange,
  theme,
  pulseAnim,
}: {
  appState: AppState;
  transcript: string;
  onTranscriptReady: (text: string) => void;
  onStateChange: (s: AppState) => void;
  theme: typeof colors.dark;
  pulseAnim: Animated.Value;
}) {
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then((r: { granted: boolean }) =>
      setHasMicPermission(r.granted)
    );
  }, []);

  // ── Speech hooks at top level ─────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (event.isFinal && text.trim()) {
      onTranscriptReady(text.trim());
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (appState === "listening") onStateChange("idle");
  });

  useSpeechRecognitionEvent("error", (event) => {
    onStateChange("idle");
    if (event.error !== "no-speech") {
      Alert.alert("Microfono", `Errore: ${event.error}`);
    }
  });

  const toggleListening = async () => {
    if (appState === "listening") {
      ExpoSpeechRecognitionModule.stop();
      onStateChange("idle");
      return;
    }
    if (!hasMicPermission) {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert("Microfono", "Permesso microfono necessario.");
        return;
      }
      setHasMicPermission(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStateChange("listening");
    ExpoSpeechRecognitionModule.start({
      lang: "it-IT",
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
    });
  };

  return (
    <View style={micStyles.micArea}>
      {appState === "processing" ? (
        <View style={[micStyles.micBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ActivityIndicator size={28} color={theme.primary} />
        </View>
      ) : (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              micStyles.micBtn,
              {
                backgroundColor: appState === "listening" ? theme.primary : theme.card,
                borderColor: appState === "listening" ? theme.primary : theme.border,
                shadowColor: theme.primary,
                shadowOpacity: appState === "listening" ? 0.4 : 0,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: appState === "listening" ? 8 : 0,
              },
            ]}
            onPress={toggleListening}
            activeOpacity={0.85}
          >
            <Feather
              name="mic"
              size={30}
              color={appState === "listening" ? "#fff" : theme.primary}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
      <Text style={[micStyles.micLabel, { color: theme.mutedForeground }]}>
        {appState === "idle" && "Tocca per parlare"}
        {appState === "listening" && "In ascolto... tocca per fermare"}
        {appState === "processing" && "Elaborazione..."}
      </Text>
      {appState === "listening" && transcript.length > 0 && (
        <View style={[micStyles.transcriptBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="edit-3" size={14} color={theme.mutedForeground} />
          <Text style={[micStyles.transcriptText, { color: theme.mutedForeground }]} numberOfLines={2}>
            {transcript}
          </Text>
        </View>
      )}
    </View>
  );
}

const micStyles = StyleSheet.create({
  micArea: { alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 10 },
  micBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  micLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  transcriptBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  transcriptText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: text input fallback (Expo Go).
// ─────────────────────────────────────────────────────────────────────────────
function TextInputController({
  appState,
  onSubmit,
  theme,
}: {
  appState: AppState;
  onSubmit: (text: string) => void;
  theme: typeof colors.dark;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim() && appState !== "processing") {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <View style={[textStyles.area, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
      <View style={[textStyles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          style={[textStyles.input, { color: theme.foreground }]}
          placeholder="Scrivi un comando..."
          placeholderTextColor={theme.mutedForeground}
          value={value}
          onChangeText={setValue}
          returnKeyType="send"
          editable={appState !== "processing"}
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          style={[textStyles.sendBtn, { backgroundColor: value.trim() && appState !== "processing" ? theme.primary : theme.border }]}
          onPress={submit}
          disabled={!value.trim() || appState === "processing"}
        >
          {appState === "processing"
            ? <ActivityIndicator size={16} color="#fff" />
            : <Feather name="send" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
      <Text style={[textStyles.hint, { color: theme.mutedForeground }]}>
        Il microfono è disponibile nel build nativo
      </Text>
    </View>
  );
}

const textStyles = StyleSheet.create({
  area: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", borderRadius: 24, borderWidth: 1, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 4 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { adminName, serverConfig } = useAuth();
  const { requests, refresh, approve, deny } = useRequests();

  const [appState, setAppState] = useState<AppState>("idle");
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [printerGroups, setPrinterGroups] = useState<PrinterGroup[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    getPrinterGroups().then(setPrinterGroups).catch(() => {});
  }, [serverConfig]);

  // Pulse animation
  useEffect(() => {
    if (appState === "listening") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [appState]);

  // ── Feedback message ──────────────────────────────────────────────────────
  const addFeedback = useCallback((text: string, status: "ok" | "error") => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString() + "_fb", role: "assistant", text, status, timestamp: Date.now() },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ── Execute POS action ────────────────────────────────────────────────────
  const executeAction = useCallback(
    async (action: string, params: Record<string, unknown>) => {
      switch (action) {
        case "navigate": {
          const screen = params.screen as string;
          if (screen) setTimeout(() => router.push(`/(main)/${screen}` as never), 400);
          break;
        }
        case "query_summary":
          setTimeout(() => router.push("/(main)/summary" as never), 400);
          break;
        case "query_requests":
          break;

        case "pos_approve": {
          const reqId = params.requestId as string;
          const desc = (params.description as string) ?? "questa richiesta";
          if (!reqId) break;
          Alert.alert("Conferma approvazione", `Approvare "${desc}"?`, [
            { text: "Annulla", style: "cancel" },
            {
              text: "Approva",
              onPress: async () => {
                try {
                  await approve(reqId, adminName ?? undefined, "Approvato tramite assistente");
                  await refresh();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  addFeedback(`✓ Richiesta "${desc}" approvata.`, "ok");
                } catch (err) {
                  addFeedback(`Errore: ${err instanceof Error ? err.message : "Errore"}`, "error");
                }
              },
            },
          ]);
          break;
        }

        case "pos_deny": {
          const reqId = params.requestId as string;
          const desc = (params.description as string) ?? "questa richiesta";
          if (!reqId) break;
          Alert.alert("Conferma rifiuto", `Rifiutare "${desc}"?`, [
            { text: "Annulla", style: "cancel" },
            {
              text: "Rifiuta",
              style: "destructive",
              onPress: async () => {
                try {
                  await deny(reqId, adminName ?? undefined);
                  await refresh();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  addFeedback(`✗ Richiesta "${desc}" rifiutata.`, "ok");
                } catch (err) {
                  addFeedback(`Errore: ${err instanceof Error ? err.message : "Errore"}`, "error");
                }
              },
            },
          ]);
          break;
        }

        case "pos_approve_all": {
          const ids = params.requestIds as string[] | undefined;
          const count = (params.count as number) ?? ids?.length ?? 0;
          if (!ids || ids.length === 0) { addFeedback("Nessuna richiesta in attesa.", "ok"); break; }
          Alert.alert("Conferma approvazione multipla", `Approvare tutte le ${count} richieste?`, [
            { text: "Annulla", style: "cancel" },
            {
              text: `Approva tutte (${count})`,
              onPress: async () => {
                let ok = 0; let fail = 0;
                for (const id of ids) {
                  try {
                    await approve(id, adminName ?? undefined, "Approvato tramite assistente");
                    ok++;
                  }
                  catch { fail++; }
                }
                await refresh();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                addFeedback(
                  fail === 0 ? `✓ Tutte le ${ok} richieste approvate.` : `✓ ${ok} approvate, ${fail} fallite.`,
                  fail === 0 ? "ok" : "error"
                );
              },
            },
          ]);
          break;
        }

        case "pos_send_message": {
          const msg = (params.message as string) ?? "";
          const pgId = params.pgId as string | null | undefined;
          if (!msg.trim()) break;
          try {
            await sendPrinterMessage(msg, pgId ? [pgId] : undefined, adminName ?? undefined);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addFeedback(`✓ Messaggio inviato${pgId ? ` (gruppo ${pgId})` : " a tutte le stampanti"}.`, "ok");
          } catch (err) {
            addFeedback(`Errore invio: ${err instanceof Error ? err.message : "Errore"}`, "error");
          }
          break;
        }

        case "pos_reprint": {
          const ticketId = params.ticketId as string;
          if (!ticketId) break;
          try {
            const requestedPgId = params.pgId as string | undefined;
            const pgId =
              requestedPgId ??
              (printerGroups.length === 1 ? printerGroups[0].pgId : undefined);
            await reprintTicket(ticketId, pgId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            addFeedback(`✓ Scontrino ${ticketId} inviato alla stampante.`, "ok");
          } catch (err) {
            addFeedback(`Errore ristampa: ${err instanceof Error ? err.message : "Errore"}`, "error");
          }
          break;
        }

        default:
          break;
      }
    },
    [adminName, refresh, approve, deny, addFeedback, printerGroups]
  );

  // ── Send to Claude ────────────────────────────────────────────────────────
  const handleTranscriptReady = useCallback(
    async (text: string) => {
      setAppState("processing");
      setTranscript("");

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", text, timestamp: Date.now() },
      ]);

      try {
        const pending = requests.filter((r) => r.status === "pending");
        const context = {
          adminName: adminName ?? "Amministratore",
          pendingRequestsCount: pending.length,
          pendingRequests: pending.map((r) => ({
            id: r.id,
            type: r.type,
            description: r.description,
            operator: r.operatorName,
            tableNum: r.tableNum,
            amount:
              (r.payload?.amount as number | undefined) ??
              (r.payload?.total as number | undefined) ??
              (r.payload?.price as number | undefined) ?? null,
          })),
          printerGroups: printerGroups.map((pg) => ({ id: pg.pgId, name: pg.pgName })),
          serverIp: serverConfig?.ip ?? null,
          currentTime: new Date().toLocaleTimeString("it-IT"),
          currentDate: new Date().toLocaleDateString("it-IT"),
        };

        const response = await fetch(`${API_BASE}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, context, conversationId: conversationId ?? undefined }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as {
          ok: boolean; conversationId: number; action: string;
          params: Record<string, unknown>; reply: string; error?: string;
        };
        if (!data.ok) throw new Error(data.error ?? "Errore AI");

        if (!conversationId) setConversationId(data.conversationId);

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            text: data.reply,
            action: data.action,
            timestamp: Date.now(),
          },
        ]);

        if (data.action && data.action !== "none") {
          await executeAction(data.action, data.params);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAppState("idle");
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            text: `Errore: ${err instanceof Error ? err.message : "Errore"}`,
            status: "error",
            timestamp: Date.now(),
          },
        ]);
        setAppState("idle");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [conversationId, adminName, requests, printerGroups, serverConfig, executeAction]
  );

  const clearConversation = () => {
    setMessages([]); setConversationId(null); setTranscript("");
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>Assistente POS</Text>
          <Text style={[styles.headerSub, { color: theme.mutedForeground }]}>
            {pendingCount > 0
              ? `${pendingCount} richiesta${pendingCount !== 1 ? "e" : ""} in attesa`
              : "Nessuna richiesta in attesa"}
          </Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearConversation} style={styles.clearBtn}>
            <Feather name="trash-2" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "18" }]}>
              <Feather name={SPEECH_AVAILABLE ? "mic" : "message-square"} size={36} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
              {SPEECH_AVAILABLE ? "Comanda il POS con la voce" : "Comanda il POS"}
            </Text>
            <Text style={[styles.emptyHint, { color: theme.mutedForeground }]}>
              {SPEECH_AVAILABLE
                ? "Approva richieste, invia messaggi alle stampanti, ristampa scontrini e molto altro."
                : "Scrivi un comando qui sotto. Il microfono è disponibile nel build nativo dell'app."}
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestion, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleTranscriptReady(s)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.suggestionText, { color: theme.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} theme={theme} />)
        )}
      </ScrollView>

      {/* Input: mic (native) or text (Expo Go) */}
      {SPEECH_AVAILABLE ? (
        <MicController
          appState={appState}
          transcript={transcript}
          onTranscriptReady={handleTranscriptReady}
          onStateChange={setAppState}
          theme={theme}
          pulseAnim={pulseAnim}
        />
      ) : (
        <TextInputController
          appState={appState}
          onSubmit={handleTranscriptReady}
          theme={theme}
        />
      )}

      <BottomTabBar />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ message, theme }: { message: AIMessage; theme: typeof colors.dark }) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isOk = message.status === "ok";

  const bubbleBg = isUser ? theme.primary : isError ? theme.destructive + "18" : isOk ? theme.success + "18" : theme.card;
  const bubbleBorder = isUser ? theme.primary : isError ? theme.destructive + "60" : isOk ? theme.success + "60" : theme.border;
  const textColor = isUser ? "#fff" : isError ? theme.destructive : theme.foreground;

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: isError ? theme.destructive + "20" : isOk ? theme.success + "20" : theme.primary + "20" }]}>
          <Feather
            name={isError ? "alert-circle" : isOk ? "check-circle" : "cpu"}
            size={14}
            color={isError ? theme.destructive : isOk ? theme.success : theme.primary}
          />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]}>
        <Text style={[styles.bubbleText, { color: textColor }]}>{message.text}</Text>
        {message.action && message.action !== "none" && !isOk && !isError && (
          <View style={[styles.actionBadge, { backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.primary + "18" }]}>
            <Feather name="zap" size={11} color={isUser ? "#fff" : theme.primary} />
            <Text style={[styles.actionBadgeText, { color: isUser ? "#fff" : theme.primary }]}>
              {actionLabel(message.action)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case "navigate": return "Navigazione";
    case "pos_approve": return "Approva richiesta";
    case "pos_deny": return "Rifiuta richiesta";
    case "pos_approve_all": return "Approva tutte";
    case "pos_send_message": return "Messaggio stampante";
    case "pos_reprint": return "Ristampa scontrino";
    case "query_summary": return "Riepilogo";
    case "query_requests": return "Stato richieste";
    default: return action;
  }
}

const SUGGESTIONS = [
  "Quante richieste ho in attesa?",
  "Approva tutte le richieste",
  "Invia messaggio alla cucina: pausa 10 minuti",
  "Ristampa l'ultimo scontrino",
  "Mostrami il riepilogo di oggi",
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  clearBtn: { padding: 8 },
  messagesContent: { padding: 16, gap: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: "center", paddingTop: 40, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  suggestions: { width: "100%", gap: 8, marginTop: 16 },
  suggestion: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  suggestionText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, gap: 6 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  actionBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start" },
  actionBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
