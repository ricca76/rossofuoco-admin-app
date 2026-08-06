import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar } from "@/components/BottomTabBar";
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useTip } from "@/context/TipContext";
import {
  buildEndOfDayReport,
  buildTipReceiptText,
} from "@/services/tipStorage";
import {
  getDailySummaryFull,
  sendPrinterMessage,
} from "@/services/derbyApi";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalDateStr(d);
}

function formatDateLabel(dateStr: string): string {
  const today = getDateStr(0);
  const yesterday = getDateStr(-1);
  if (dateStr === today) return "Oggi";
  if (dateStr === yesterday) return "Ieri";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

function fmt(amount: number): string {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : Math.round(v * 100) / 100;
}

interface SummaryTotals {
  card: number;
  cash: number;
  gc: number;
}

export default function CassaScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const { adminName } = useAuth();
  const { config, tipData, distribution, currentDate, setDate, updateTipData, reload } = useTip();

  const [selectedDate, setSelectedDate] = useState(getDateStr(0));
  const [summaryTotals, setSummaryTotals] = useState<SummaryTotals | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [cashTipInput, setCashTipInput] = useState("");
  const [cardTipInput, setCardTipInput] = useState("");
  const [editingTips, setEditingTips] = useState(false);
  const cashRef = useRef<TextInput>(null);
  const cardRef = useRef<TextInput>(null);

  // Sync date with tip context
  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate, setDate]);

  // Sync inputs when tip data changes (loaded from storage)
  useEffect(() => {
    if (!editingTips) {
      setCashTipInput(tipData.cashTips > 0 ? String(tipData.cashTips) : "");
      setCardTipInput(tipData.cardTips > 0 ? String(tipData.cardTips) : "");
    }
  }, [tipData, editingTips]);

  const loadSummary = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getDailySummaryFull(selectedDate);
      const totals = data.totals;
      setSummaryTotals({
        card: totals.card,
        cash: totals.cash,
        gc: totals.gc,
      });
    } catch (e: unknown) {
      setSummaryError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setSummaryLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const saveTips = useCallback(async () => {
    const cash = parseMoney(cashTipInput);
    const card = parseMoney(cardTipInput);
    await updateTipData({ cashTips: cash, cardTips: card });
    setEditingTips(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [cashTipInput, cardTipInput, updateTipData]);

  const handlePrintDayReport = useCallback(async () => {
    if (!summaryTotals) {
      Alert.alert("Attenzione", "Carica prima i dati della giornata.");
      return;
    }
    setPrinting(true);
    try {
      const report = buildEndOfDayReport({
        date: selectedDate,
        totalCard: summaryTotals.card,
        totalCash: summaryTotals.cash,
        totalGc: summaryTotals.gc,
        tipData,
        distribution,
        config,
        managerName: adminName ?? "Manager",
        restaurantName: "Rosso Fuoco",
      });
      await sendPrinterMessage(report, undefined, adminName ?? "Manager");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Stampato", "Resoconto di fine giornata inviato alla stampante.");
    } catch (e: unknown) {
      Alert.alert("Errore stampa", e instanceof Error ? e.message : "Impossibile stampare.");
    } finally {
      setPrinting(false);
    }
  }, [summaryTotals, selectedDate, tipData, distribution, config, adminName]);

  const handlePrintTipReceipts = useCallback(async () => {
    if (distribution.netTotal <= 0) {
      Alert.alert("Nessuna mancia", "Inserisci le mance prima di stampare le ricevute.");
      return;
    }
    Alert.alert(
      "Stampa ricevute mance",
      "Verranno stampate le ricevute per:\n• Sala\n• Cucina\n• Bar\n• Fondo Ristorante\n\nContinuare?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Stampa",
          onPress: async () => {
            setPrinting(true);
            try {
              const depts = [
                { name: "Sala", amount: distribution.sala, dept: "Sala" },
                { name: "Cucina", amount: distribution.cucina, dept: "Cucina" },
                { name: "Bar", amount: distribution.bar, dept: "Bar" },
                { name: "Fondo Ristorante", amount: distribution.fondo, dept: "Fondo" },
              ];
              for (const dept of depts) {
                if (dept.amount <= 0) continue;
                const receipt = buildTipReceiptText({
                  employeeName: dept.name,
                  department: dept.dept,
                  amount: dept.amount,
                  date: selectedDate,
                  restaurantName: "Rosso Fuoco",
                });
                await sendPrinterMessage(receipt, undefined, adminName ?? "Manager");
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Stampate", "Ricevute mance inviate alla stampante.");
            } catch (e: unknown) {
              Alert.alert("Errore stampa", e instanceof Error ? e.message : "Impossibile stampare.");
            } finally {
              setPrinting(false);
            }
          },
        },
      ]
    );
  }, [distribution, selectedDate, adminName]);

  const changeDate = useCallback((delta: number) => {
    Haptics.selectionAsync();
    setSelectedDate((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + delta);
      return toLocalDateStr(d);
    });
  }, []);

  const total =
    summaryTotals !== null
      ? summaryTotals.card + summaryTotals.cash + summaryTotals.gc
      : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              setIsRefreshing(true);
              await Promise.all([loadSummary(true), reload()]);
              setIsRefreshing(false);
            }}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 90 },
        ]}
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>Cassa Manager</Text>

          {/* Date selector */}
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateNavBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => changeDate(-1)}
            >
              <Feather name="chevron-left" size={18} color={theme.foreground} />
            </TouchableOpacity>
            <View style={styles.dateLabelBox}>
              <Text style={[styles.dateLabel, { color: theme.foreground }]}>
                {formatDateLabel(selectedDate)}
              </Text>
              {selectedDate !== getDateStr(0) && (
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setSelectedDate(getDateStr(0)); }}>
                  <Text style={[styles.todayLink, { color: theme.primary }]}>Torna ad oggi</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.dateNavBtn,
                { backgroundColor: theme.card, borderColor: theme.border, opacity: selectedDate >= getDateStr(0) ? 0.3 : 1 },
              ]}
              disabled={selectedDate >= getDateStr(0)}
              onPress={() => changeDate(1)}
            >
              <Feather name="chevron-right" size={18} color={theme.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── INCASSI GIORNATA ── */}
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>INCASSI GIORNATA</Text>
        {summaryLoading ? (
          <View style={[styles.card, styles.centered, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : summaryError ? (
          <View style={[styles.errorBox, { backgroundColor: theme.destructive + "12", borderColor: theme.destructive + "30" }]}>
            <Feather name="alert-circle" size={15} color={theme.destructive} />
            <Text style={[styles.errorText, { color: theme.destructive }]}>{summaryError}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <CassaRow
              icon="credit-card"
              label="Totale Carte"
              amount={summaryTotals?.card ?? 0}
              color="#3b82f6"
              theme={theme}
              first
            />
            <CassaRow
              icon="dollar-sign"
              label="Totale Contanti"
              amount={summaryTotals?.cash ?? 0}
              color="#22c55e"
              theme={theme}
            />
            {(summaryTotals?.gc ?? 0) > 0 && (
              <CassaRow
                icon="gift"
                label="Gift Card"
                amount={summaryTotals?.gc ?? 0}
                color="#a855f7"
                theme={theme}
              />
            )}
            <View style={[styles.totalRow, { borderTopColor: theme.border, backgroundColor: theme.primary + "08" }]}>
              <Text style={[styles.totalLabel, { color: theme.foreground }]}>TOTALE INCASSATO</Text>
              <Text style={[styles.totalAmount, { color: theme.primary }]}>
                {total !== null ? fmt(total) : "—"}
              </Text>
            </View>
          </View>
        )}

        {/* ── MANCE ── */}
        <View style={[styles.sectionHeaderRow]}>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginTop: 0, marginBottom: 0 }]}>
            MANCE
          </Text>
          {!editingTips ? (
            <TouchableOpacity
              onPress={() => { setEditingTips(true); setTimeout(() => cashRef.current?.focus(), 100); }}
              style={[styles.editBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Feather name="edit-2" size={13} color={theme.primary} />
              <Text style={[styles.editBtnText, { color: theme.primary }]}>Modifica</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={saveTips}
              style={[styles.editBtn, { borderColor: theme.primary, backgroundColor: theme.primary + "15" }]}
            >
              <Feather name="check" size={13} color={theme.primary} />
              <Text style={[styles.editBtnText, { color: theme.primary }]}>Salva</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.inputRow, { borderBottomColor: theme.border }]}>
            <View style={[styles.inputIconBox, { backgroundColor: "#22c55e20" }]}>
              <Feather name="dollar-sign" size={15} color="#22c55e" />
            </View>
            <Text style={[styles.inputLabel, { color: theme.foreground }]}>Mance contanti</Text>
            {editingTips ? (
              <TextInput
                ref={cashRef}
                style={[styles.inputValue, { color: theme.foreground }]}
                value={cashTipInput}
                onChangeText={setCashTipInput}
                placeholder="0,00"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                textAlign="right"
                returnKeyType="next"
                onSubmitEditing={() => cardRef.current?.focus()}
              />
            ) : (
              <Text style={[styles.inputValue, { color: theme.foreground, textAlign: "right" }]}>
                {tipData.cashTips > 0 ? fmt(tipData.cashTips) : "—"}
              </Text>
            )}
          </View>
          <View style={styles.inputRow}>
            <View style={[styles.inputIconBox, { backgroundColor: "#3b82f620" }]}>
              <Feather name="credit-card" size={15} color="#3b82f6" />
            </View>
            <Text style={[styles.inputLabel, { color: theme.foreground }]}>Mance su carta/POS</Text>
            {editingTips ? (
              <TextInput
                ref={cardRef}
                style={[styles.inputValue, { color: theme.foreground }]}
                value={cardTipInput}
                onChangeText={setCardTipInput}
                placeholder="0,00"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                textAlign="right"
                returnKeyType="done"
                onSubmitEditing={saveTips}
              />
            ) : (
              <Text style={[styles.inputValue, { color: theme.foreground, textAlign: "right" }]}>
                {tipData.cardTips > 0 ? fmt(tipData.cardTips) : "—"}
              </Text>
            )}
          </View>
        </View>

        {(tipData.cashTips > 0 || tipData.cardTips > 0) && (
          <>
            <View style={[styles.taxNote, { backgroundColor: theme.warning + "12", borderColor: theme.warning + "30" }]}>
              <Feather name="info" size={14} color={theme.warning} />
              <Text style={[styles.taxNoteText, { color: theme.warning }]}>
                Le mance su carta sono soggette al {config.electronicTipTaxPct}% di tassazione (legge polacca).{"\n"}
                Trattenuta: {fmt(distribution.taxDeducted)} · Netto carte: {fmt(distribution.netCard)}
              </Text>
            </View>

            {/* ── DISTRIBUZIONE MANCE ── */}
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
              DISTRIBUZIONE MANCE NETTE
            </Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <DistRow label="Sala" pct={config.salaPct} amount={distribution.sala} color="#f59e0b" theme={theme} first />
              <DistRow label="Cucina" pct={config.cucinaPct} amount={distribution.cucina} color="#ef4444" theme={theme} />
              <DistRow label="Bar" pct={config.barPct} amount={distribution.bar} color="#8b5cf6" theme={theme} />
              <DistRow label="Fondo Ristorante" pct={config.fondoPct} amount={distribution.fondo} color="#6b7280" theme={theme} />
              <View style={[styles.totalRow, { borderTopColor: theme.border, backgroundColor: theme.primary + "08" }]}>
                <Text style={[styles.totalLabel, { color: theme.foreground }]}>TOTALE DISTRIBUIBILE</Text>
                <Text style={[styles.totalAmount, { color: theme.primary }]}>{fmt(distribution.netTotal)}</Text>
              </View>
            </View>

            {/* ── AZIONI STAMPA ── */}
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>STAMPA</Text>
            <View style={styles.printRow}>
              <TouchableOpacity
                style={[styles.printBtn, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={handlePrintDayReport}
                disabled={printing}
                activeOpacity={0.8}
              >
                {printing ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <>
                    <Feather name="printer" size={16} color="#fff" />
                    <Text style={styles.printBtnText}>Resoconto giornata</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.printBtn, { backgroundColor: "#22c55e", flex: 1 }]}
                onPress={handlePrintTipReceipts}
                disabled={printing}
                activeOpacity={0.8}
              >
                {printing ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <>
                    <Feather name="file-text" size={16} color="#fff" />
                    <Text style={styles.printBtnText}>Ricevute mance</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.settingsLink, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => router.push("/(main)/settings")}
              activeOpacity={0.8}
            >
              <Feather name="sliders" size={15} color={theme.primary} />
              <Text style={[styles.settingsLinkText, { color: theme.primary }]}>
                Modifica percentuali distribuzione
              </Text>
              <Feather name="chevron-right" size={15} color={theme.mutedForeground} />
            </TouchableOpacity>
          </>
        )}

        {tipData.cashTips === 0 && tipData.cardTips === 0 && (
          <View style={[styles.emptyTipBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="gift" size={28} color={theme.mutedForeground} />
            <Text style={[styles.emptyTipTitle, { color: theme.foreground }]}>Nessuna mancia registrata</Text>
            <Text style={[styles.emptyTipSub, { color: theme.mutedForeground }]}>
              Tocca "Modifica" per inserire le mance del turno
            </Text>
          </View>
        )}
      </ScrollView>

      <BottomTabBar />
    </View>
  );
}

function CassaRow({
  icon,
  label,
  amount,
  color,
  theme,
  first = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  amount: number;
  color: string;
  theme: typeof colors.dark;
  first?: boolean;
}) {
  return (
    <View
      style={[
        styles.cassaRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      <View style={[styles.cassaIconBox, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.cassaLabel, { color: theme.foreground }]}>{label}</Text>
      <Text style={[styles.cassaAmount, { color: theme.foreground }]}>{fmt(amount)}</Text>
    </View>
  );
}

function DistRow({
  label,
  pct,
  amount,
  color,
  theme,
  first = false,
}: {
  label: string;
  pct: number;
  amount: number;
  color: string;
  theme: typeof colors.dark;
  first?: boolean;
}) {
  return (
    <View
      style={[
        styles.distRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      <View style={[styles.distDot, { backgroundColor: color }]} />
      <Text style={[styles.distLabel, { color: theme.foreground }]}>{label}</Text>
      <Text style={[styles.distPct, { color: theme.mutedForeground }]}>{pct}%</Text>
      <Text style={[styles.distAmount, { color: theme.foreground }]}>{fmt(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  headerBlock: { marginBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateNavBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  dateLabelBox: { flex: 1, alignItems: "center", gap: 2 },
  dateLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  todayLink: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 2, marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, marginBottom: 8,
  },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  centered: { padding: 24, alignItems: "center", justifyContent: "center" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  cassaRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cassaIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cassaLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  cassaAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  totalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  totalAmount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  inputLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  inputValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right" },
  taxNote: {
    flexDirection: "row", gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, marginTop: 8, alignItems: "flex-start",
  },
  taxNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  distRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  distDot: { width: 10, height: 10, borderRadius: 5 },
  distLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  distPct: { width: 36, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "right" },
  distAmount: { width: 80, fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "right" },
  printRow: { flexDirection: "row", gap: 10 },
  printBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, height: 48, borderRadius: 13, paddingHorizontal: 12,
  },
  printBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  settingsLink: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8,
  },
  settingsLinkText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyTipBox: {
    alignItems: "center", gap: 8, padding: 30,
    borderRadius: 14, borderWidth: 1, marginTop: 4,
  },
  emptyTipTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyTipSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
