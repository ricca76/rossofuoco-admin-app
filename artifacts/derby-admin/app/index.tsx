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
import { ServerConfig, testConnection } from "@/services/derbyApi";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { signIn, saveServerConfig, serverConfig, isConnected, isLoading, error, clearError } = useAuth();

  const [ip, setIp] = useState(serverConfig?.ip ?? "");
  const [port, setPort] = useState(String(serverConfig?.port ?? "8080"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connOk, setConnOk] = useState<boolean | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

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
  }, [error]);

  const handleTestConnection = async () => {
    if (!ip.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'indirizzo IP del server.");
      return;
    }
    setTestingConn(true);
    setConnOk(null);
    const config: ServerConfig = { ip: ip.trim(), port: Number(port) || 8080 };
    const ok = await testConnection(config);
    setConnOk(ok);
    setTestingConn(false);
    if (ok) {
      await saveServerConfig(config);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleLogin = async () => {
    if (!ip.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'indirizzo IP del server.");
      return;
    }
    if (!username.trim() || !password.trim()) {
      Alert.alert("Campi mancanti", "Inserisci username e password.");
      return;
    }
    const config: ServerConfig = { ip: ip.trim(), port: Number(port) || 8080 };
    await saveServerConfig(config);
    await signIn({ username: username.trim(), password });
  };

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

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
        <View style={styles.header}>
          <View style={[styles.logoBox, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="shield" size={36} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Derby Admin
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            Autorizzazioni POS
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
            SERVER
          </Text>

          <View style={[styles.inputGroup, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={[styles.inputRow, { borderBottomColor: theme.border }]}>
              <Feather name="server" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="Indirizzo IP (es. 192.168.1.10)"
                placeholderTextColor={theme.mutedForeground}
                value={ip}
                onChangeText={(t) => { setIp(t); setConnOk(null); clearError(); }}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.inputRow}>
              <Feather name="radio" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="Porta (es. 8080)"
                placeholderTextColor={theme.mutedForeground}
                value={port}
                onChangeText={(t) => { setPort(t); setConnOk(null); clearError(); }}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[
                  styles.testBtn,
                  {
                    backgroundColor:
                      connOk === true
                        ? theme.success + "20"
                        : connOk === false
                        ? theme.destructive + "20"
                        : theme.primary + "15",
                  },
                ]}
                onPress={handleTestConnection}
                disabled={testingConn}
              >
                {testingConn ? (
                  <ActivityIndicator size={14} color={theme.primary} />
                ) : (
                  <Feather
                    name={connOk === true ? "check" : connOk === false ? "x" : "wifi"}
                    size={14}
                    color={
                      connOk === true
                        ? theme.success
                        : connOk === false
                        ? theme.destructive
                        : theme.primary
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {connOk === true && (
            <Text style={[styles.hint, { color: theme.success }]}>
              Server raggiungibile
            </Text>
          )}
          {connOk === false && (
            <Text style={[styles.hint, { color: theme.destructive }]}>
              Server non raggiungibile
            </Text>
          )}

          <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginTop: 24 }]}>
            CREDENZIALI ADMIN
          </Text>

          <Animated.View
            style={[
              styles.inputGroup,
              { borderColor: error ? theme.destructive : theme.border, backgroundColor: theme.card },
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            <View style={[styles.inputRow, { borderBottomColor: error ? theme.destructive : theme.border }]}>
              <Feather name="user" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="Username admin"
                placeholderTextColor={theme.mutedForeground}
                value={username}
                onChangeText={(t) => { setUsername(t); clearError(); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.inputRow}>
              <Feather name="lock" size={16} color={theme.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="Password"
                placeholderTextColor={theme.mutedForeground}
                value={password}
                onChangeText={(t) => { setPassword(t); clearError(); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.destructive + "15", borderColor: theme.destructive + "40" }]}>
              <Feather name="alert-circle" size={14} color={theme.destructive} />
              <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.loginBtn,
              { backgroundColor: theme.primary },
              isLoading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Accedi</Text>
                <Feather name="arrow-right" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  form: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  inputGroup: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  testBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeBtn: {
    padding: 6,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    marginTop: 16,
    gap: 8,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
