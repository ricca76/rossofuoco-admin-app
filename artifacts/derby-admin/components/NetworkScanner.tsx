import { Feather } from "@expo/vector-icons";
import * as Network from "expo-network";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

const DERBY_PORTS = [51521, 4000, 8080, 3000, 8000, 4242, 80, 9000];
const BATCH_SIZE = 30;
const TIMEOUT_MS = 600;

export interface FoundServer {
  ip: string;
  port: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (server: FoundServer) => void;
}

async function probeHost(ip: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(`http://${ip}:${port}/api/ping`, {
      method: "GET",
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timer);
    if (response && (response.ok || response.status === 401 || response.status === 403)) {
      return true;
    }
    // Try root path as fallback
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
    const response2 = await fetch(`http://${ip}:${port}/`, {
      method: "HEAD",
      signal: controller2.signal,
    }).catch(() => null);
    clearTimeout(timer2);
    return !!(response2 && response2.status < 500);
  } catch {
    return false;
  }
}

function getSubnet(ip: string): string {
  const parts = ip.split(".");
  return parts.slice(0, 3).join(".");
}

function buildTargets(subnet: string): Array<{ ip: string; port: number }> {
  const targets: Array<{ ip: string; port: number }> = [];
  // Priority IPs first: .1, .2, .10, .100, .101, .200, then .3-.9, .11-.99, .102-.199, .201-.254
  const priorityLast = [1, 2, 10, 100, 101, 200, 254];
  const all = Array.from({ length: 254 }, (_, i) => i + 1);
  const sorted = [
    ...priorityLast,
    ...all.filter((n) => !priorityLast.includes(n)),
  ];
  for (const host of sorted) {
    for (const port of DERBY_PORTS) {
      targets.push({ ip: `${subnet}.${host}`, port });
    }
  }
  return targets;
}

async function runBatch(
  targets: Array<{ ip: string; port: number }>,
  onFound: (s: FoundServer) => void,
  onProgress: (done: number) => void,
  cancelRef: React.MutableRefObject<boolean>
) {
  let done = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    if (cancelRef.current) return;
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ ip, port }) => {
        if (cancelRef.current) return;
        const ok = await probeHost(ip, port);
        if (ok && !cancelRef.current) onFound({ ip, port });
      })
    );
    done += batch.length;
    onProgress(done);
  }
}

export function NetworkScanner({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(1);
  const [found, setFound] = useState<FoundServer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subnet, setSubnet] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPhase("idle");
      setProgress(0);
      setTotal(1);
      setFound([]);
      setError(null);
      setSubnet(null);
      cancelRef.current = false;
      progressAnim.setValue(0);
    } else {
      cancelRef.current = true;
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? progress / total : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress, total]);

  const startScan = useCallback(async () => {
    cancelRef.current = false;
    setFound([]);
    setError(null);
    setPhase("scanning");

    try {
      let deviceIp = "192.168.1.100";
      if (Platform.OS !== "web") {
        const ip = await Network.getIpAddressAsync();
        if (ip && ip !== "0.0.0.0" && ip !== "127.0.0.1") {
          deviceIp = ip;
        }
      }
      const sub = getSubnet(deviceIp);
      setSubnet(sub);

      const targets = buildTargets(sub);
      setTotal(targets.length);
      setProgress(0);

      await runBatch(
        targets,
        (s) => setFound((prev) => (prev.find((x) => x.ip === s.ip && x.port === s.port) ? prev : [...prev, s])),
        (done) => setProgress(done),
        cancelRef
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore scansione");
    } finally {
      if (!cancelRef.current) setPhase("done");
    }
  }, []);

  const handleClose = useCallback(() => {
    cancelRef.current = true;
    setPhase("idle");
    onClose();
  }, [onClose]);

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.border,
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.scanIcon, { backgroundColor: theme.primary + "18" }]}>
              <Feather name="radio" size={20} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.foreground }]}>
                Scansione Rete
              </Text>
              {subnet && (
                <Text style={[styles.headerSub, { color: theme.mutedForeground }]}>
                  Subnet {subnet}.0/24
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {phase === "idle" && (
            <View style={styles.centerContent}>
              <View style={[styles.bigIcon, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="wifi" size={40} color={theme.primary} />
              </View>
              <Text style={[styles.idleTitle, { color: theme.foreground }]}>
                Trova Derby Server Connect
              </Text>
              <Text style={[styles.idleDesc, { color: theme.mutedForeground }]}>
                Scansiona la rete locale per trovare automaticamente il server. Assicurati che l&apos;iPhone sia connesso alla stessa rete Wi-Fi del server.
              </Text>
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme.primary }]}
                onPress={startScan}
                activeOpacity={0.85}
              >
                <Feather name="search" size={18} color="#fff" />
                <Text style={styles.startBtnText}>Avvia Scansione</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === "scanning" && (
            <View style={styles.scanningContent}>
              <View style={styles.progressHeader}>
                <Text style={[styles.scanningLabel, { color: theme.foreground }]}>
                  Scansione in corso...
                </Text>
                <Text style={[styles.pctText, { color: theme.primary }]}>
                  {pct}%
                </Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.primary,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>

              <Text style={[styles.scanHint, { color: theme.mutedForeground }]}>
                {found.length > 0
                  ? `${found.length} server trovato${found.length !== 1 ? "i" : ""}`
                  : "Ricerca in corso..."}
              </Text>

              {found.length > 0 && (
                <View style={styles.foundList}>
                  <Text style={[styles.foundLabel, { color: theme.mutedForeground }]}>
                    TROVATI
                  </Text>
                  {found.map((s) => (
                    <FoundItem
                      key={`${s.ip}:${s.port}`}
                      server={s}
                      theme={theme}
                      onSelect={() => { onSelect(s); handleClose(); }}
                    />
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.stopBtn, { borderColor: theme.border }]}
                onPress={() => { cancelRef.current = true; setPhase("done"); }}
              >
                <Text style={[styles.stopBtnText, { color: theme.mutedForeground }]}>
                  Interrompi
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === "done" && (
            <View style={styles.doneContent}>
              {error && (
                <View style={[styles.errorBox, { backgroundColor: theme.destructive + "15", borderColor: theme.destructive + "30" }]}>
                  <Feather name="alert-circle" size={16} color={theme.destructive} />
                  <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
                </View>
              )}

              {found.length === 0 ? (
                <View style={styles.centerContent}>
                  <View style={[styles.bigIcon, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Feather name="wifi-off" size={40} color={theme.mutedForeground} />
                  </View>
                  <Text style={[styles.idleTitle, { color: theme.foreground }]}>
                    Nessun server trovato
                  </Text>
                  <Text style={[styles.idleDesc, { color: theme.mutedForeground }]}>
                    Verifica che il server Derby sia acceso e sulla stessa rete Wi-Fi, poi riprova.
                  </Text>
                  <TouchableOpacity
                    style={[styles.startBtn, { backgroundColor: theme.primary }]}
                    onPress={startScan}
                    activeOpacity={0.85}
                  >
                    <Feather name="refresh-cw" size={18} color="#fff" />
                    <Text style={styles.startBtnText}>Riprova</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <View style={[styles.doneHeader, { backgroundColor: theme.success + "15", borderColor: theme.success + "30" }]}>
                    <Feather name="check-circle" size={16} color={theme.success} />
                    <Text style={[styles.doneHeaderText, { color: theme.success }]}>
                      {found.length} server trovato{found.length !== 1 ? "i" : ""}
                    </Text>
                  </View>
                  <Text style={[styles.foundLabel, { color: theme.mutedForeground, marginHorizontal: 0, marginBottom: 8 }]}>
                    SELEZIONA IL SERVER
                  </Text>
                  <FlatList
                    data={found}
                    keyExtractor={(s) => `${s.ip}:${s.port}`}
                    renderItem={({ item }) => (
                      <FoundItem
                        server={item}
                        theme={theme}
                        onSelect={() => { onSelect(item); handleClose(); }}
                      />
                    )}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  />
                  <TouchableOpacity
                    style={[styles.stopBtn, { borderColor: theme.border, marginTop: 16 }]}
                    onPress={startScan}
                  >
                    <Feather name="refresh-cw" size={14} color={theme.mutedForeground} />
                    <Text style={[styles.stopBtnText, { color: theme.mutedForeground }]}>
                      Scansiona di nuovo
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function FoundItem({
  server,
  theme,
  onSelect,
}: {
  server: FoundServer;
  theme: typeof colors.dark;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.foundItem, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      <View style={[styles.foundIcon, { backgroundColor: theme.success + "18" }]}>
        <Feather name="server" size={18} color={theme.success} />
      </View>
      <View style={styles.foundInfo}>
        <Text style={[styles.foundIp, { color: theme.foreground }]}>
          {server.ip}
        </Text>
        <Text style={[styles.foundPort, { color: theme.mutedForeground }]}>
          Porta {server.port}
        </Text>
      </View>
      <View style={[styles.useBtn, { backgroundColor: theme.primary }]}>
        <Text style={styles.useBtnText}>Usa</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  scanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  closeBtn: { padding: 4 },
  body: { flex: 1, padding: 20 },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  bigIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  idleTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  idleDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  scanningContent: { flex: 1, gap: 16 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scanningLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  pctText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  scanHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  foundList: { gap: 8 },
  foundLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: "auto",
  },
  stopBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  doneContent: { flex: 1, gap: 12 },
  doneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  doneHeaderText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  foundItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  foundIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  foundInfo: { flex: 1 },
  foundIp: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  foundPort: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  useBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  useBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
