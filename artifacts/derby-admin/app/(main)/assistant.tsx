import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useRequests } from "@/context/RequestsContext";
import { BottomTabBar } from "@/components/BottomTabBar";

const API_BASE = (() => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return "";
  }
  return "";
})();

interface AIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: string;
  params?: Record<string, unknown>;
  timestamp: number;
}

type AppState = "idle" | "listening" | "processing" | "speaking";

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { adminName, serverConfig } = useAuth();
  const { requests } = useRequests();

  const [appState, setAppState] = useState<AppState>("idle");
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Pulse animation while listening ──────────────────────────────────────
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

  // ── Speech recognition events ─────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    setTranscript(text);
    if (event.isFinal && text.trim()) {
      handleTranscriptReady(text.trim());
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (appState === "listening") {
      setAppState("idle");
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setAppState("idle");
    if (event.error !== "no-speech") {
      Alert.alert("Microfono", `Errore: ${event.error}`);
    }
  });

  // ── Request mic permission ────────────────────────────────────────────────
  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then((result) => {
      setHasMicPermission(result.granted);
    });
  }, []);

  // ── Send to Claude ────────────────────────────────────────────────────────
  const handleTranscriptReady = useCallback(
    async (text: string) => {
      setAppState("processing");
      setTranscript("");

      const userMsg: AIMessage = {
        id: Date.now().toString(),
        role: "user",
        text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const context = {
          adminName: adminName ?? "Amministratore",
          pendingRequestsCount: requests.filter((r) => r.status === "pending").length,
          pendingRequests: requests
            .filter((r) => r.status === "pending")
            .slice(0, 5)
            .map((r) => ({ id: r.id, type: r.type, description: r.description, operator: r.operatorName })),
          serverIp: serverConfig?.ip ?? null,
          currentTime: new Date().toLocaleTimeString("it-IT"),
        };

        const response = await fetch(`${API_BASE}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            context,
            conversationId: conversationId ?? undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as {
          ok: boolean;
          conversationId: number;
          action: string;
          params: Record<string, unknown>;
          reply: string;
          error?: string;
        };

        if (!data.ok) throw new Error(data.error ?? "Errore AI");

        if (!conversationId) setConversationId(data.conversationId);

        const assistantMsg: AIMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: data.reply,
          action: data.action,
          params: data.params,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Execute action
        if (data.action && data.action !== "none") {
          await executeAction(data.action, data.params);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAppState("idle");
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore";
        const errMsg: AIMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: `Non riesco a elaborare il comando. ${msg}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setAppState("idle");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [conversationId, adminName, requests, serverConfig]
  );

  // ── Execute action ────────────────────────────────────────────────────────
  const executeAction = async (action: string, params: Record<string, unknown>) => {
    switch (action) {
      case "navigate":
        const screen = params.screen as string;
        if (screen) {
          setTimeout(() => router.push(`/(main)/${screen}` as never), 400);
        }
        break;
      case "approve_request":
      case "deny_request":
        const reqId = params.requestId as string;
        if (reqId) {
          setTimeout(() => router.push(`/(main)/request/${reqId}` as never), 400);
        }
        break;
      default:
        break;
    }
  };

  // ── Start / Stop listening ────────────────────────────────────────────────
  const toggleListening = async () => {
    if (appState === "listening") {
      ExpoSpeechRecognitionModule.stop();
      setAppState("idle");
      return;
    }

    if (!hasMicPermission) {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert("Microfono", "Permesso microfono necessario per usare l'assistente.");
        return;
      }
      setHasMicPermission(true);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAppState("listening");
    setTranscript("");

    ExpoSpeechRecognitionModule.start({
      lang: "it-IT",
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
    });
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setTranscript("");
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>
            Assistente vocale
          </Text>
          <Text style={[styles.headerSub, { color: theme.mutedForeground }]}>
            {pendingCount > 0
              ? `${pendingCount} richiesta${pendingCount > 1 ? "e" : ""} in attesa`
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
              <Feather name="mic" size={36} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
              Cosa posso fare per te?
            </Text>
            <Text style={[styles.emptyHint, { color: theme.mutedForeground }]}>
              Tocca il microfono e parla in italiano.{"\n"}Puoi chiedermi di navigare, gestire richieste, inviare messaggi e molto altro.
            </Text>

            {/* Suggestions */}
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
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} theme={theme} />
          ))
        )}
      </ScrollView>

      {/* Live transcript */}
      {(appState === "listening" && transcript.length > 0) && (
        <View style={[styles.transcriptBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="edit-3" size={14} color={theme.mutedForeground} />
          <Text style={[styles.transcriptText, { color: theme.mutedForeground }]} numberOfLines={2}>
            {transcript}
          </Text>
        </View>
      )}

      {/* Mic button area */}
      <View style={[styles.micArea, { paddingBottom: 16 }]}>
        {appState === "processing" ? (
          <View style={[styles.micBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ActivityIndicator size={28} color={theme.primary} />
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.micBtn,
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
                name={appState === "listening" ? "mic" : "mic"}
                size={30}
                color={appState === "listening" ? "#fff" : theme.primary}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        <Text style={[styles.micLabel, { color: theme.mutedForeground }]}>
          {appState === "idle" && "Tocca per parlare"}
          {appState === "listening" && "In ascolto... tocca per fermare"}
          {appState === "processing" && "Elaborazione..."}
        </Text>
      </View>

      <BottomTabBar />
    </View>
  );
}

function MessageBubble({
  message,
  theme,
}: {
  message: AIMessage;
  theme: typeof colors.dark;
}) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="cpu" size={14} color={theme.primary} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: theme.primary }]
            : [styles.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }],
        ]}
      >
        <Text style={[styles.bubbleText, { color: isUser ? "#fff" : theme.foreground }]}>
          {message.text}
        </Text>
        {message.action && message.action !== "none" && (
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
    case "approve_request": return "Apre richiesta";
    case "deny_request": return "Apre richiesta";
    case "send_message": return "Invia messaggio";
    case "query_summary": return "Riepilogo";
    case "query_requests": return "Richieste";
    default: return action;
  }
}

const SUGGESTIONS = [
  "Quante richieste ho in attesa?",
  "Vai alle richieste",
  "Mostrami il riepilogo di oggi",
  "Invia messaggio alla cucina: pausa 10 minuti",
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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

  transcriptBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  transcriptText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },

  micArea: { alignItems: "center", paddingTop: 16, gap: 10 },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  micLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
