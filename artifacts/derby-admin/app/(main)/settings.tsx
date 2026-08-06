import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTip } from "@/context/TipContext";
import { ServerConfig, testConnection } from "@/services/derbyApi";

function normalizeServerUrl(url: string): string {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { serverConfig, saveServerConfig, signOut, adminName } = useAuth();

  const { config: tipConfig, updateConfig: updateTipConfig } = useTip();

  const [ip, setIp] = useState(serverConfig?.ip ?? "");
  const [port, setPort] = useState(String(serverConfig?.port ?? "51521"));
  const [mode, setMode] = useState<"local" | "remote">(serverConfig?.baseUrl ? "remote" : (!serverConfig?.ip ? "remote" : "local"));
  const [remoteUrl, setRemoteUrl] = useState(serverConfig?.baseUrl ?? "https://rossofuoco.eu");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<"ok" | "fail" | null>(null);

  // Tip config local state
  const [salaPct, setSalaPct] = useState(String(tipConfig.salaPct));
  const [cucinaPct, setCucinaPct] = useState(String(tipConfig.cucinaPct));
  const [barPct, setBarPct] = useState(String(tipConfig.barPct));
  const [fondoPct, setFondoPct] = useState(String(tipConfig.fondoPct));
  const [taxPct, setTaxPct] = useState(String(tipConfig.electronicTipTaxPct));
  const [savingTips, setSavingTips] = useState(false);

  // Sync when tipConfig loads from storage
  useEffect(() => {
    setSalaPct(String(tipConfig.salaPct));
    setCucinaPct(String(tipConfig.cucinaPct));
    setBarPct(String(tipConfig.barPct));
    setFondoPct(String(tipConfig.fondoPct));
    setTaxPct(String(tipConfig.electronicTipTaxPct));
  }, [tipConfig.salaPct, tipConfig.cucinaPct, tipConfig.barPct, tipConfig.fondoPct, tipConfig.electronicTipTaxPct]);

  const parsePct = (s: string) => Math.max(0, Math.min(100, Number(s.replace(",", ".")) || 0));

  const handleSaveTipConfig = async () => {
    const s = parsePct(salaPct);
    const c = parsePct(cucinaPct);
    const b = parsePct(barPct);
    const f = parsePct(fondoPct);
    const total = s + c + b + f;
    if (Math.abs(total - 100) > 0.5) {
      Alert.alert(
        "Percentuali non valide",
        `La somma delle percentuali è ${total.toFixed(0)}%. Deve essere esattamente 100%.`
      );
      return;
    }
    setSavingTips(true);
    await updateTipConfig({
      salaPct: s,
      cucinaPct: c,
      barPct: b,
      fondoPct: f,
      electronicTipTaxPct: parsePct(taxPct),
    });
    setSavingTips(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Salvato", "Configurazione mance aggiornata.");
  };

  const tipTotal = parsePct(salaPct) + parsePct(cucinaPct) + parsePct(barPct) + parsePct(fondoPct);
  const tipTotalOk = Math.abs(tipTotal - 100) < 0.5;

  const buildConfig = (): ServerConfig =>
    mode === "remote"
      ? { ip: "", port: 51521, baseUrl: normalizeServerUrl(remoteUrl.trim()) }
      : { ip: ip.trim(), port: Number(port) || 51521 };

  const handleTest = async () => {
    setTesting(true);
    setConnStatus(null);
    const config = buildConfig();
    const ok = await testConnection(config);
    setConnStatus(ok ? "ok" : "fail");
    setTesting(false);
    Haptics.notificationAsync(
      ok
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );
  };

  const handleSave = async () => {
    if (mode === "local" && !ip.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'indirizzo IP.");
      return;
    }
    if (mode === "remote" && !remoteUrl.trim()) {
      Alert.alert("Campo mancante", "Inserisci l'URL del server remoto.");
      return;
    }
    setSaving(true);
    const config = buildConfig();
    await saveServerConfig(config);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Salvato", "Configurazione aggiornata.");
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

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
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

      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        CONNESSIONE SERVER
      </Text>

      {/* Modalità connessione */}
      <View style={[styles.modeToggle, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "local" && { backgroundColor: theme.primary }]}
          onPress={() => { setMode("local"); setConnStatus(null); }}
          activeOpacity={0.8}
        >
          <Feather name="wifi" size={13} color={mode === "local" ? "#fff" : theme.mutedForeground} />
          <Text style={[styles.modeBtnText, { color: mode === "local" ? "#fff" : theme.mutedForeground }]}>
            Rete locale
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "remote" && { backgroundColor: theme.primary }]}
          onPress={() => { setMode("remote"); setConnStatus(null); }}
          activeOpacity={0.8}
        >
          <Feather name="globe" size={13} color={mode === "remote" ? "#fff" : theme.mutedForeground} />
          <Text style={[styles.modeBtnText, { color: mode === "remote" ? "#fff" : theme.mutedForeground }]}>
            Accesso remoto
          </Text>
        </TouchableOpacity>
      </View>

      {mode === "local" ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.inputRow, { borderBottomColor: theme.border }]}>
            <Feather name="server" size={15} color={theme.mutedForeground} style={styles.inputIcon} />
            <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Indirizzo IP</Text>
            <TextInput
              style={[styles.inputValue, { color: theme.foreground }]}
              value={ip}
              onChangeText={(t) => { setIp(t); setConnStatus(null); }}
              placeholder="192.168.1.10"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
          </View>
          <View style={styles.inputRow}>
            <Feather name="radio" size={15} color={theme.mutedForeground} style={styles.inputIcon} />
            <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Porta</Text>
            <TextInput
              style={[styles.inputValue, { color: theme.foreground }]}
              value={port}
              onChangeText={(t) => { setPort(t); setConnStatus(null); }}
              placeholder="51521"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="number-pad"
              textAlign="right"
            />
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.inputRow}>
            <Feather name="globe" size={15} color={theme.mutedForeground} style={styles.inputIcon} />
            <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>URL server</Text>
            <TextInput
              style={[styles.inputValue, { color: theme.foreground }]}
              value={remoteUrl}
              onChangeText={(t) => { setRemoteUrl(t); setConnStatus(null); }}
              placeholder="https://rossofuoco.eu"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
          </View>
        </View>
      )}

      <Text style={[styles.portHint, { color: theme.mutedForeground }]}>
        {mode === "local" ? "Porta default Rosso Fuoco Console: 51521" : "Es. https://rossofuoco.eu · https://tuoserver.com"}
      </Text>

      {connStatus && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: connStatus === "ok" ? theme.success + "15" : theme.destructive + "15",
              borderColor: connStatus === "ok" ? theme.success + "40" : theme.destructive + "40",
            },
          ]}
        >
          <Feather
            name={connStatus === "ok" ? "check-circle" : "x-circle"}
            size={14}
            color={connStatus === "ok" ? theme.success : theme.destructive}
          />
          <Text
            style={[
              styles.statusText,
              { color: connStatus === "ok" ? theme.success : theme.destructive },
            ]}
          >
            {connStatus === "ok" ? "Server raggiungibile" : "Server non raggiungibile"}
          </Text>
        </View>
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.testBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={handleTest}
          disabled={testing || saving}
          activeOpacity={0.8}
        >
          {testing ? (
            <ActivityIndicator size={16} color={theme.primary} />
          ) : (
            <>
              <Feather name="wifi" size={16} color={theme.primary} />
              <Text style={[styles.btnText, { color: theme.primary }]}>Test</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || testing}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={[styles.btnText, { color: "#fff" }]}>Salva</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── DISTRIBUZIONE MANCE ── */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        DISTRIBUZIONE MANCE
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TipPctRow
          label="Sala"
          value={salaPct}
          onChange={setSalaPct}
          theme={theme}
          first
          borderColor={theme.border}
        />
        <TipPctRow
          label="Cucina"
          value={cucinaPct}
          onChange={setCucinaPct}
          theme={theme}
          borderColor={theme.border}
        />
        <TipPctRow
          label="Bar"
          value={barPct}
          onChange={setBarPct}
          theme={theme}
          borderColor={theme.border}
        />
        <TipPctRow
          label="Fondo Ristorante"
          value={fondoPct}
          onChange={setFondoPct}
          theme={theme}
          borderColor={theme.border}
        />
      </View>
      <Text
        style={[
          styles.portHint,
          { color: tipTotalOk ? theme.success : theme.destructive, marginTop: 2 },
        ]}
      >
        {tipTotalOk
          ? `✓ Totale: 100% — distribuzione corretta`
          : `⚠ Totale: ${tipTotal.toFixed(0)}% — la somma deve essere esattamente 100%`}
      </Text>

      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        TASSAZIONE MANCE ELETTRONICHE
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.inputRow}>
          <Feather name="percent" size={15} color={theme.mutedForeground} style={styles.inputIcon} />
          <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Aliquota mance POS/carta</Text>
          <TextInput
            style={[styles.inputValue, { color: theme.foreground }]}
            value={taxPct}
            onChangeText={setTaxPct}
            placeholder="30"
            placeholderTextColor={theme.mutedForeground}
            keyboardType="decimal-pad"
            textAlign="right"
          />
          <Text style={[styles.pctSuffix, { color: theme.mutedForeground }]}>%</Text>
        </View>
      </View>
      <Text style={[styles.portHint, { color: theme.mutedForeground }]}>
        Le mance incassate tramite POS o fattura sono soggette a tassazione.{"\n"}
        La percentuale viene detratta prima della distribuzione (art. 12 legge polacca sul reddito).
      </Text>

      <TouchableOpacity
        style={[
          styles.btn,
          styles.saveBtn,
          { backgroundColor: tipTotalOk ? theme.primary : theme.muted },
          (savingTips || !tipTotalOk) && { opacity: 0.6 },
        ]}
        onPress={handleSaveTipConfig}
        disabled={savingTips || !tipTotalOk}
        activeOpacity={0.8}
      >
        {savingTips ? (
          <ActivityIndicator size={16} color="#fff" />
        ) : (
          <>
            <Feather name="save" size={16} color="#fff" />
            <Text style={[styles.btnText, { color: "#fff" }]}>Salva configurazione mance</Text>
          </>
        )}
      </TouchableOpacity>

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
        Rosso Admin v1.0 · Rosso Fuoco Console
      </Text>
    </ScrollView>
  );
}

function TipPctRow({
  label,
  value,
  onChange,
  theme,
  first = false,
  borderColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: typeof colors.dark;
  first?: boolean;
  borderColor: string;
}) {
  return (
    <View
      style={[
        styles.inputRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor },
        { borderBottomWidth: 0 },
      ]}
    >
      <Text style={[styles.inputLabel, { color: theme.foreground }]}>{label}</Text>
      <TextInput
        style={[styles.inputValue, { color: theme.foreground, width: 56 }]}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={theme.mutedForeground}
        keyboardType="decimal-pad"
        textAlign="right"
      />
      <Text style={[styles.pctSuffix, { color: theme.mutedForeground }]}>%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 10 },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputIcon: { marginRight: 10 },
  inputLabel: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  inputValue: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  portHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
    marginTop: -4,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 4,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  testBtn: { borderWidth: 1 },
  saveBtn: {},
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  pctSuffix: { fontSize: 14, fontFamily: "Inter_500Medium", marginLeft: 2, width: 16 },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 12,
  },
});
