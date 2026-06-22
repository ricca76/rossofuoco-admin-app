import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { NetworkScanner, FoundServer } from "@/components/NetworkScanner";
import {
  AdminUser,
  ServerConfig,
  configureApi,
  getAdminUsers,
  testConnection,
} from "@/services/derbyApi";
import {
  BiometricType,
  biometricLabel,
  getBiometricType,
} from "@/services/biometrics";
import FaceAuthModal from "@/components/FaceAuthModal";

const DEFAULT_IP = "192.168.0.177";
const DEFAULT_PORT = 51521;

function normalizeServerUrl(url: string): string {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const {
    signIn,
    signInWithStoredPin,
    saveServerConfig,
    serverConfig,
    isConnected,
    isLoading,
    error,
    clearError,
    hasSavedCredentials,
    adminName: savedAdminName,
  } = useAuth();

  const [ip, setIp] = useState(serverConfig?.ip ?? DEFAULT_IP);
  const [port, setPort] = useState(String(serverConfig?.port ?? DEFAULT_PORT));
  const [mode, setMode] = useState<"local" | "remote">(serverConfig?.baseUrl ? "remote" : "local");
  const [remoteUrl, setRemoteUrl] = useState(serverConfig?.baseUrl ?? "");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connOk, setConnOk] = useState<boolean | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalPurpose] = useState<"login">("login");

  const pinRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getBiometricType().then(setBiometricType).catch(() => {});
  }, []);

  const handleServerFound = (server: FoundServer) => {
    setIp(server.ip);
    setConnOk(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  useEffect(() => {
    if (isConnected) {
      router.replace("/(main)/requests");
    }
  }, [isConnected]);

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error, shakeAnim]);

  const loadUsers = async (cfg: ServerConfig) => {
    setLoadingUsers(true);
    setAdminUsers([]);
    setSelectedUser(null);
    try {
      configureApi(cfg);
      const users = await getAdminUsers();
      setAdminUsers(users);
      if (users.length === 1) {
        setSelectedUser(users[0]);
        setTimeout(() => pinRef.current?.focus(), 200);
      }
    } catch {
      // silenzioso
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleTestConnection = async () => {
    if (mode === "remote" && !remoteUrl.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'URL del server remoto.");
      return;
    }
    if (mode === "local" && !ip.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'indirizzo IP del server.");
      return;
    }
    setTestingConn(true);
    setConnOk(null);
    clearError();
    const config: ServerConfig = mode === "remote"
      ? { ip: "", port: DEFAULT_PORT, baseUrl: normalizeServerUrl(remoteUrl.trim()) }
      : { ip: ip.trim(), port: Number(port) || DEFAULT_PORT };
    const ok = await testConnection(config);
    setConnOk(ok);
    setTestingConn(false);
    if (ok) {
      await saveServerConfig(config);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadUsers(config);
    } else {
      setAdminUsers([]);
      setSelectedUser(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSelectUser = (user: AdminUser) => {
    Haptics.selectionAsync();
    setSelectedUser(user);
    setPin("");
    clearError();
    setTimeout(() => pinRef.current?.focus(), 150);
  };

  const handleLogin = async () => {
    if (mode === "remote" && !remoteUrl.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'URL del server remoto.");
      return;
    }
    if (mode === "local" && !ip.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'indirizzo IP del server.");
      return;
    }
    if (!pin.trim()) {
      Alert.alert("Campo mancante", "Inserisci il PIN admin.");
      return;
    }
    const config: ServerConfig = mode === "remote"
      ? { ip: "", port: DEFAULT_PORT, baseUrl: normalizeServerUrl(remoteUrl.trim()) }
      : { ip: ip.trim(), port: Number(port) || DEFAULT_PORT };
    await saveServerConfig(config);
    await signIn({ pin: pin.trim() });
  };

  const handleFaceLogin = () => {
    if (!hasSavedCredentials) return;
    setFaceModalVisible(true);
  };

  const handleFaceLoginSuccess = async (_employeeId: number, _employeeName: string) => {
    setFaceModalVisible(false);
    await signInWithStoredPin();
  };

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const getUserInitials = (user: AdminUser) => {
    const f = user.firstName?.[0] ?? "";
    const l = user.lastName?.[0] ?? "";
    return (f + l).toUpperCase() || "?";
  };

  const getUserFullName = (user: AdminUser) =>
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "Utente";

  const showFaceBtn = hasSavedCredentials;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding + 24, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* Logo */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Rosso Admin
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            Autorizzazioni POS · Rosso Fuoco
          </Text>
        </View>

        {/* ── Riconoscimento volto (face recognition POS) ─────── */}
        {showFaceBtn && (
          <View style={styles.biometricSection}>
            <TouchableOpacity
              style={[
                styles.biometricBtn,
                { backgroundColor: theme.primary, opacity: isLoading ? 0.7 : 1 },
              ]}
              onPress={handleFaceLogin}
              disabled={isLoading}
              activeOpacity={0.82}
            >
              <Feather name="smile" size={22} color="#fff" />
              <View>
                <Text style={styles.biometricBtnTitle}>
                  Accedi con riconoscimento volto
                </Text>
                {savedAdminName && (
                  <Text style={styles.biometricBtnSub}>
                    {savedAdminName}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.mutedForeground }]}>
                oppure accedi con PIN
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>
          </View>
        )}

        <View style={styles.form}>
          {/* SERVER */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
              SERVER
            </Text>
            {mode === "local" && (
              <TouchableOpacity
                style={[
                  styles.scannerBtn,
                  { backgroundColor: theme.primary + "15", borderColor: theme.primary + "40" },
                ]}
                onPress={() => setScannerVisible(true)}
              >
                <Feather name="radio" size={13} color={theme.primary} />
                <Text style={[styles.scannerBtnText, { color: theme.primary }]}>
                  Scansiona
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Modalità connessione */}
          <View style={[styles.modeToggle, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "local" && { backgroundColor: theme.primary }]}
              onPress={() => { setMode("local"); setConnOk(null); setAdminUsers([]); setSelectedUser(null); clearError(); }}
              activeOpacity={0.8}
            >
              <Feather name="wifi" size={13} color={mode === "local" ? "#fff" : theme.mutedForeground} />
              <Text style={[styles.modeBtnText, { color: mode === "local" ? "#fff" : theme.mutedForeground }]}>
                Rete locale
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "remote" && { backgroundColor: theme.primary }]}
              onPress={() => { setMode("remote"); setConnOk(null); setAdminUsers([]); setSelectedUser(null); clearError(); }}
              activeOpacity={0.8}
            >
              <Feather name="globe" size={13} color={mode === "remote" ? "#fff" : theme.mutedForeground} />
              <Text style={[styles.modeBtnText, { color: mode === "remote" ? "#fff" : theme.mutedForeground }]}>
                Accesso remoto
              </Text>
            </TouchableOpacity>
          </View>

          {mode === "local" ? (
            <View style={[styles.inputGroup, { borderColor: theme.border, backgroundColor: theme.card }]}>
              {/* IP */}
              <View style={[styles.inputRow, { borderBottomColor: theme.border }]}>
                <Feather name="server" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.foreground }]}
                  placeholder={`IP (default: ${DEFAULT_IP})`}
                  placeholderTextColor={theme.mutedForeground}
                  value={ip}
                  onChangeText={(t) => { setIp(t); setConnOk(null); setAdminUsers([]); setSelectedUser(null); clearError(); }}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.testBtn, { backgroundColor: connOk === true ? theme.success + "20" : connOk === false ? theme.destructive + "20" : theme.primary + "15" }]}
                  onPress={handleTestConnection}
                  disabled={testingConn}
                >
                  {testingConn ? (
                    <ActivityIndicator size={14} color={theme.primary} />
                  ) : (
                    <Feather
                      name={connOk === true ? "check" : connOk === false ? "x" : "wifi"}
                      size={14}
                      color={connOk === true ? theme.success : connOk === false ? theme.destructive : theme.primary}
                    />
                  )}
                </TouchableOpacity>
              </View>
              {/* Porta */}
              <View style={styles.inputRow}>
                <Feather name="radio" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.foreground }]}
                  placeholder={`Porta (default: ${DEFAULT_PORT})`}
                  placeholderTextColor={theme.mutedForeground}
                  value={port}
                  onChangeText={(t) => { setPort(t); setConnOk(null); setAdminUsers([]); setSelectedUser(null); clearError(); }}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.inputGroup, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <View style={styles.inputRow}>
                <Feather name="globe" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.foreground }]}
                  placeholder="https://rossofuoco.eu"
                  placeholderTextColor={theme.mutedForeground}
                  value={remoteUrl}
                  onChangeText={(t) => { setRemoteUrl(t); setConnOk(null); setAdminUsers([]); setSelectedUser(null); clearError(); }}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.testBtn, { backgroundColor: connOk === true ? theme.success + "20" : connOk === false ? theme.destructive + "20" : theme.primary + "15" }]}
                  onPress={handleTestConnection}
                  disabled={testingConn}
                >
                  {testingConn ? (
                    <ActivityIndicator size={14} color={theme.primary} />
                  ) : (
                    <Feather
                      name={connOk === true ? "check" : connOk === false ? "x" : "wifi"}
                      size={14}
                      color={connOk === true ? theme.success : connOk === false ? theme.destructive : theme.primary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {connOk === true && (
            <Text style={[styles.hint, { color: theme.success }]}>
              Server raggiungibile
            </Text>
          )}
          {connOk === false && (
            <Text style={[styles.hint, { color: theme.destructive }]}>
              Server non raggiungibile. Verifica IP e Wi-Fi.
            </Text>
          )}

          {/* Seleziona operatore */}
          {(adminUsers.length > 0 || loadingUsers) && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginTop: 20 }]}>
                SELEZIONA OPERATORE
              </Text>
              {loadingUsers ? (
                <View style={[styles.loadingUsers, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.loadingUsersText, { color: theme.mutedForeground }]}>
                    Caricamento operatori...
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.usersList}
                  keyboardShouldPersistTaps="handled"
                >
                  {adminUsers.map((user) => {
                    const isSelected = selectedUser?.id === user.id;
                    return (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.userCard,
                          {
                            backgroundColor: isSelected ? theme.primary + "18" : theme.card,
                            borderColor: isSelected ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => handleSelectUser(user)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.userAvatar,
                            { backgroundColor: isSelected ? theme.primary : theme.primary + "20" },
                          ]}
                        >
                          <Text style={[styles.userAvatarText, { color: isSelected ? "#fff" : theme.primary }]}>
                            {getUserInitials(user)}
                          </Text>
                        </View>
                        <Text
                          style={[styles.userCardName, { color: isSelected ? theme.primary : theme.foreground }]}
                          numberOfLines={2}
                        >
                          {getUserFullName(user)}
                        </Text>
                        {isSelected && (
                          <Feather name="check-circle" size={14} color={theme.primary} style={styles.userCheckIcon} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* PIN */}
          {(connOk === true || connOk === null) && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginTop: 20 }]}>
                {selectedUser ? `PIN DI ${getUserFullName(selectedUser).toUpperCase()}` : "PIN ADMIN"}
              </Text>

              <Animated.View
                style={[
                  styles.inputGroup,
                  {
                    borderColor: error ? theme.destructive : theme.border,
                    backgroundColor: theme.card,
                  },
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                <View style={styles.inputRow}>
                  <Feather name="hash" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    ref={pinRef}
                    style={[styles.input, { color: theme.foreground }]}
                    placeholder="PIN numerico admin"
                    placeholderTextColor={theme.mutedForeground}
                    value={pin}
                    onChangeText={(t) => { setPin(t); clearError(); }}
                    secureTextEntry={!showPin}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPin((v) => !v)} style={styles.eyeBtn}>
                    <Feather name={showPin ? "eye-off" : "eye"} size={16} color={theme.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </>
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.destructive + "15", borderColor: theme.destructive + "40" }]}>
              <Feather name="alert-circle" size={14} color={theme.destructive} />
              <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.primary }, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Accedi con PIN</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      <NetworkScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onSelect={handleServerFound}
      />

      <FaceAuthModal
        visible={faceModalVisible}
        purpose={faceModalPurpose}
        onSuccess={handleFaceLoginSuccess}
        onCancel={() => setFaceModalVisible(false)}
        onFallback={() => setFaceModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 28 },
  logoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: { width: 90, height: 90 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },

  biometricSection: { marginBottom: 8, gap: 16 },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 66,
    borderRadius: 16,
  },
  biometricBtnTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  biometricBtnSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  modeToggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  form: { gap: 8 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 6,
  },
  scannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  scannerBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  inputGroup: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  testBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeBtn: { padding: 6 },
  portFixed: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  portBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  portBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4, marginTop: 2 },
  loadingUsers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  loadingUsersText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  usersList: { paddingHorizontal: 2, gap: 10, paddingVertical: 2 },
  userCard: {
    width: 100,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  userCardName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 16,
  },
  userCheckIcon: { marginTop: -4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    marginTop: 16,
    gap: 8,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
