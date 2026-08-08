/**
 * PinAuthModal — chiede il PIN di autorizzazione prima di approvare una richiesta.
 * Appare come bottom-sheet modale con campo PIN sicuro.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

interface PinAuthModalProps {
  visible: boolean;
  onConfirm: (pin: string) => Promise<void>;
  onCancel: () => void;
  /** Titolo contestuale mostrato nella modale */
  title?: string;
  /** Sottotitolo (es. tipo richiesta) */
  subtitle?: string;
}

export function PinAuthModal({
  visible,
  onConfirm,
  onCancel,
  title = "PIN di Autorizzazione",
  subtitle,
}: PinAuthModalProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // reset ogni volta che si apre
  useEffect(() => {
    if (visible) {
      setPin("");
      setError(null);
      setLoading(false);
      setTimeout(() => pinRef.current?.focus(), 300);
    }
  }, [visible]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const handleConfirm = async () => {
    if (!pin.trim()) {
      setError("Inserisci il PIN di autorizzazione.");
      shake();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(pin.trim());
      setPin("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante l'autorizzazione";
      setError(msg);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              paddingBottom: insets.bottom + 24,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + "18" }]}>
              <Feather name="lock" size={22} color={theme.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                  {subtitle}
                </Text>
              ) : (
                <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                  Inserisci il PIN di autorizzazione del manager
                </Text>
              )}
            </View>
          </View>

          {/* PIN input */}
          <Animated.View
            style={[
              styles.inputWrapper,
              {
                borderColor: error ? theme.destructive : theme.border,
                backgroundColor: theme.card,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            <Feather name="key" size={16} color={theme.mutedForeground} style={{ marginRight: 10 }} />
            <TextInput
              ref={pinRef}
              style={[styles.input, { color: theme.foreground }]}
              placeholder="PIN autorizzazione"
              placeholderTextColor={theme.mutedForeground}
              value={pin}
              onChangeText={(t) => { setPin(t); setError(null); }}
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleConfirm}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={() => setShowPin((v) => !v)} style={styles.eyeBtn}>
              <Feather name={showPin ? "eye-off" : "eye"} size={16} color={theme.mutedForeground} />
            </TouchableOpacity>
          </Animated.View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.destructive + "15", borderColor: theme.destructive + "40" }]}>
              <Feather name="alert-circle" size={13} color={theme.destructive} />
              <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
            </View>
          )}

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: theme.success }, loading && { opacity: 0.7 }]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#fff" />
                <Text style={styles.confirmBtnText}>Conferma Autorizzazione</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: theme.border }]}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, { color: theme.mutedForeground }]}>Annulla</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", letterSpacing: 2 },
  eyeBtn: { padding: 6 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  confirmBtn: {
    height: 58,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  cancelBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
