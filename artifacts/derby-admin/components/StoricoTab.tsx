import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "@/constants/colors";
import { useTip } from "@/context/TipContext";
import {
  DayTipData,
  MonthlyTipSummary,
  aggregateMonth,
  buildMonthlyExportText,
  calculateDistribution,
  datesOfMonth,
  loadRangeTipData,
} from "@/services/tipStorage";
import { sendPrinterMessage } from "@/services/derbyApi";
import { useAuth } from "@/context/AuthContext";

function fmt(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function todayYM(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function prevYM(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextYM(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function isCurrentOrFuture(year: number, month: number) {
  const { year: ty, month: tm } = todayYM();
  return year > ty || (year === ty && month >= tm);
}

function dayOfWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "short" });
}

interface Props {
  theme: typeof colors.dark;
}

export default function StoricoTab({ theme }: Props) {
  const { config } = useTip();
  const { adminName } = useAuth();

  const [year, setYear] = useState(todayYM().year);
  const [month, setMonth] = useState(todayYM().month);
  const [days, setDays] = useState<DayTipData[]>([]);
  const [summary, setSummary] = useState<MonthlyTipSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const dates = datesOfMonth(y, m);
      const data = await loadRangeTipData(dates);
      setDays(data);
      setSummary(aggregateMonth(data, config));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  const goToPrev = () => {
    Haptics.selectionAsync();
    const { year: ny, month: nm } = prevYM(year, month);
    setYear(ny);
    setMonth(nm);
  };

  const goToNext = () => {
    if (isCurrentOrFuture(year, month)) return;
    Haptics.selectionAsync();
    const { year: ny, month: nm } = nextYM(year, month);
    setYear(ny);
    setMonth(nm);
  };

  const handleExport = useCallback(async () => {
    if (!summary || summary.activeDays === 0) {
      Alert.alert("Nessun dato", "Non ci sono mance registrate per questo mese.");
      return;
    }
    setPrinting(true);
    try {
      const text = buildMonthlyExportText({
        year,
        month,
        days,
        summary,
        config,
        restaurantName: "Rosso Fuoco",
      });
      await sendPrinterMessage(text, undefined, adminName ?? "Manager");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Stampato", "Riepilogo mensile inviato alla stampante.");
    } catch (e: unknown) {
      Alert.alert("Errore stampa", e instanceof Error ? e.message : "Impossibile stampare.");
    } finally {
      setPrinting(false);
    }
  }, [summary, year, month, days, config, adminName]);

  const activeDays = days.filter((d) => d.cashTips > 0 || d.cardTips > 0);

  return (
    <View style={styles.root}>
      {/* Month picker */}
      <View style={[styles.monthPicker, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.monthNavBtn} onPress={goToPrev}>
          <Feather name="chevron-left" size={20} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: theme.foreground }]}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <TouchableOpacity
          style={[styles.monthNavBtn, { opacity: isCurrentOrFuture(year, month) ? 0.3 : 1 }]}
          onPress={goToNext}
          disabled={isCurrentOrFuture(year, month)}
        >
          <Feather name="chevron-right" size={20} color={theme.foreground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
            Caricamento dati…
          </Text>
        </View>
      ) : (
        <>
          {/* Monthly summary card */}
          {summary && summary.activeDays > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                RIEPILOGO MENSILE
              </Text>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <SummaryRow
                  label="Mance contanti"
                  value={fmt(summary.totalCash)}
                  color="#22c55e"
                  theme={theme}
                  first
                />
                <SummaryRow
                  label="Mance POS"
                  value={fmt(summary.totalCard)}
                  color="#3b82f6"
                  theme={theme}
                />
                <SummaryRow
                  label={`Tassa ${config.electronicTipTaxPct}% (POS)`}
                  value={`-${fmt(summary.totalTax)}`}
                  color={theme.destructive}
                  theme={theme}
                  negative
                />
                <View style={[styles.totalRow, { borderTopColor: theme.border, backgroundColor: theme.primary + "08" }]}>
                  <Text style={[styles.totalLabel, { color: theme.foreground }]}>NETTO DISTRIBUIBILE</Text>
                  <Text style={[styles.totalAmount, { color: theme.primary }]}>{fmt(summary.netTotal)}</Text>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                DISTRIBUZIONE MENSILE
              </Text>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <DistRow label="Sala" pct={config.salaPct} value={fmt(summary.sala)} color="#f59e0b" theme={theme} first />
                <DistRow label="Cucina" pct={config.cucinaPct} value={fmt(summary.cucina)} color="#ef4444" theme={theme} />
                <DistRow label="Bar" pct={config.barPct} value={fmt(summary.bar)} color="#8b5cf6" theme={theme} />
                <DistRow label="Fondo Ristorante" pct={config.fondoPct} value={fmt(summary.fondo)} color="#6b7280" theme={theme} />
              </View>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: theme.primary }]}
                onPress={handleExport}
                disabled={printing}
                activeOpacity={0.82}
              >
                {printing ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <>
                    <Feather name="printer" size={16} color="#fff" />
                    <Text style={styles.exportBtnText}>Stampa riepilogo mensile</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="calendar" size={28} color={theme.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
                Nessuna mancia registrata
              </Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                Non ci sono dati per {MONTH_NAMES[month - 1]} {year}
              </Text>
            </View>
          )}

          {/* Day-by-day list */}
          {activeDays.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                DETTAGLIO GIORNALIERO · {activeDays.length} GG ATTIVI
              </Text>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {activeDays.map((day, idx) => {
                  const dist = calculateDistribution(day, config);
                  const [, , dd] = day.date.split("-");
                  const dow = dayOfWeekLabel(day.date);
                  return (
                    <View
                      key={day.date}
                      style={[
                        styles.dayRow,
                        idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                      ]}
                    >
                      <View style={styles.dayDateBox}>
                        <Text style={[styles.dayDD, { color: theme.foreground }]}>{dd}</Text>
                        <Text style={[styles.dayDow, { color: theme.mutedForeground }]}>{dow}</Text>
                      </View>
                      <View style={styles.dayMid}>
                        {day.cashTips > 0 && (
                          <View style={styles.dayChip}>
                            <View style={[styles.chipDot, { backgroundColor: "#22c55e" }]} />
                            <Text style={[styles.chipText, { color: theme.mutedForeground }]}>
                              {fmt(day.cashTips)}
                            </Text>
                          </View>
                        )}
                        {day.cardTips > 0 && (
                          <View style={styles.dayChip}>
                            <View style={[styles.chipDot, { backgroundColor: "#3b82f6" }]} />
                            <Text style={[styles.chipText, { color: theme.mutedForeground }]}>
                              {fmt(day.cardTips)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.dayNet, { color: theme.foreground }]}>
                        {fmt(dist.netTotal)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  color,
  theme,
  first = false,
  negative = false,
}: {
  label: string;
  value: string;
  color: string;
  theme: typeof colors.dark;
  first?: boolean;
  negative?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      <View style={[styles.summaryDot, { backgroundColor: color + "30" }]}>
        <View style={[styles.summaryDotInner, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.summaryLabel, { color: theme.foreground }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: negative ? color : theme.foreground }]}>{value}</Text>
    </View>
  );
}

function DistRow({
  label,
  pct,
  value,
  color,
  theme,
  first = false,
}: {
  label: string;
  pct: number;
  value: string;
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
      <Text style={[styles.distValue, { color: theme.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 32 },
  monthPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
  },
  monthNavBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  monthLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
    marginTop: 16,
  },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  totalAmount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  exportBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    padding: 36,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  // Summary rows
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  summaryDot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDotInner: { width: 10, height: 10, borderRadius: 5 },
  summaryLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  summaryValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  // Dist rows
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  distDot: { width: 10, height: 10, borderRadius: 5 },
  distLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  distPct: { width: 36, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "right" },
  distValue: { width: 80, fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "right" },
  // Day rows
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  dayDateBox: {
    width: 36,
    alignItems: "center",
  },
  dayDD: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 20 },
  dayDow: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.4 },
  dayMid: { flex: 1, gap: 3 },
  dayChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dayNet: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "right" },
});
