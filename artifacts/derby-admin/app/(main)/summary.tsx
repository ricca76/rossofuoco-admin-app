import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar } from "@/components/BottomTabBar";
import colors from "@/constants/colors";
import { useTip } from "@/context/TipContext";
import { getDailySummaryFull, FullDailySummaryResponse, DailySummaryOperator } from "@/services/derbyApi";

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

function formatEuro(amount: number): string {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function pct(num: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((num / total) * 100)}%`;
}

function getHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

interface HourBucket {
  hour: number;
  count: number;
  total: number;
}

function buildHourlyData(operators: DailySummaryOperator[]): HourBucket[] {
  const map = new Map<number, HourBucket>();
  for (const op of operators) {
    for (const t of op.tickets) {
      if (!t.closingDate) continue;
      try {
        const d = new Date(t.closingDate.replace(" ", "T"));
        const h = d.getHours();
        if (!map.has(h)) map.set(h, { hour: h, count: 0, total: 0 });
        const b = map.get(h)!;
        b.count += 1;
        b.total += t.total;
      } catch {}
    }
  }
  return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
}

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const { tipData, distribution, config, setDate: setTipDate } = useTip();

  const [selectedDate, setSelectedDate] = useState(getDateStr(0));
  const [data, setData] = useState<FullDailySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOp, setFilterOp] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  // Keep tip context date in sync
  useEffect(() => { setTipDate(selectedDate); }, [selectedDate, setTipDate]);

  const load = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await getDailySummaryFull(selectedDate);
      setData(res);
      setFilterOp(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  const operators = data?.operators ?? [];

  const visibleOps: DailySummaryOperator[] = filterOp
    ? operators.filter(op => `${op.firstName} ${op.lastName}`.trim() === filterOp)
    : operators;

  const totals = visibleOps.reduce(
    (acc, op) => ({
      total: acc.total + op.total,
      receiptCount: acc.receiptCount + op.receiptCount,
      cash: acc.cash + op.cash,
      card: acc.card + op.card,
      gc: acc.gc + op.gc,
      stornoCount: acc.stornoCount + op.stornoCount,
      stornoAmount: acc.stornoAmount + op.stornoAmount,
    }),
    { total: 0, receiptCount: 0, cash: 0, card: 0, gc: 0, stornoCount: 0, stornoAmount: 0 }
  );

  const allTickets = visibleOps.flatMap(op => op.tickets);
  const avgReceipt = totals.receiptCount > 0 ? totals.total / totals.receiptCount : 0;
  const topReceipt = allTickets.length > 0 ? Math.max(...allTickets.map(t => t.total)) : 0;
  const hourlyData = buildHourlyData(visibleOps);
  const maxHourlyCount = hourlyData.length > 0 ? Math.max(...hourlyData.map(h => h.count)) : 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} tintColor={theme.primary} />
        }
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 80 },
        ]}
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>Riepilogo</Text>

          {/* Date selector */}
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateNavBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() - 1);
                setSelectedDate(toLocalDateStr(d));
              }}
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
              onPress={() => {
                Haptics.selectionAsync();
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() + 1);
                setSelectedDate(toLocalDateStr(d));
              }}
            >
              <Feather name="chevron-right" size={18} color={theme.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primary} size="large" />
            <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Caricamento...</Text>
          </View>
        )}

        {error && !isLoading && (
          <View style={[styles.errorBox, { backgroundColor: theme.destructive + "12", borderColor: theme.destructive + "30" }]}>
            <Feather name="alert-circle" size={16} color={theme.destructive} />
            <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
          </View>
        )}

        {!isLoading && !error && data && (
          <>
            {/* Operator filter */}
            {operators.length > 1 && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>OPERATORE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: filterOp === null ? theme.primary + "20" : theme.card,
                        borderColor: filterOp === null ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => { Haptics.selectionAsync(); setFilterOp(null); }}
                  >
                    <Text style={[styles.filterChipText, { color: filterOp === null ? theme.primary : theme.foreground }]}>
                      Tutti
                    </Text>
                  </TouchableOpacity>
                  {operators.map(op => {
                    const name = `${op.firstName} ${op.lastName}`.trim();
                    const active = filterOp === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: active ? theme.primary + "20" : theme.card,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => { Haptics.selectionAsync(); setFilterOp(active ? null : name); }}
                      >
                        <Text style={[styles.filterChipText, { color: active ? theme.primary : theme.foreground }]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {totals.receiptCount === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="inbox" size={36} color={theme.mutedForeground} />
                <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>Nessuno scontrino emesso</Text>
              </View>
            ) : (
              <>
                {/* KPI grid */}
                <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>INCASSI</Text>
                <View style={styles.kpiGrid}>
                  <KpiCard label="Totale" value={formatEuro(totals.total)} icon="trending-up" accent={theme.primary} theme={theme} large />
                  <KpiCard label="Scontrini" value={String(totals.receiptCount)} icon="file-text" accent={theme.primary} theme={theme} />
                  <KpiCard label="Media" value={formatEuro(avgReceipt)} icon="bar-chart-2" accent={theme.primary} theme={theme} />
                  <KpiCard label="Top scontrino" value={formatEuro(topReceipt)} icon="award" accent="#f59e0b" theme={theme} />
                </View>

                {/* Payment breakdown */}
                <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>METODI DI PAGAMENTO</Text>
                <View style={[styles.payCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <PayRow label="Contanti" amount={totals.cash} total={totals.total} color="#22c55e" theme={theme} />
                  <PayRow label="Carta" amount={totals.card} total={totals.total} color="#3b82f6" theme={theme} />
                  {totals.gc > 0 && (
                    <PayRow label="Gift card" amount={totals.gc} total={totals.total} color="#a855f7" theme={theme} />
                  )}
                </View>

                {/* Storni */}
                {totals.stornoCount > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>STORNI</Text>
                    <View style={[styles.stornoCard, { backgroundColor: theme.warning + "12", borderColor: theme.warning + "30" }]}>
                      <View style={styles.stornoRow}>
                        <Feather name="x-circle" size={16} color={theme.warning} />
                        <Text style={[styles.stornoLabel, { color: theme.warning }]}>Articoli stornati</Text>
                        <Text style={[styles.stornoValue, { color: theme.warning }]}>{totals.stornoCount}</Text>
                      </View>
                      <View style={[styles.stornoRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.warning + "40" }]}>
                        <Feather name="trending-down" size={16} color={theme.warning} />
                        <Text style={[styles.stornoLabel, { color: theme.warning }]}>Importo stornato</Text>
                        <Text style={[styles.stornoValue, { color: theme.warning }]}>{formatEuro(totals.stornoAmount)}</Text>
                      </View>
                    </View>
                  </>
                )}

                {/* Operator leaderboard */}
                {operators.length > 0 && !filterOp && (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>CLASSIFICA OPERATORI</Text>
                    <View style={[styles.leaderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {[...operators]
                        .sort((a, b) => b.total - a.total)
                        .map((op, idx) => {
                          const name = `${op.firstName} ${op.lastName}`.trim();
                          const barPct = operators.length > 0 ? op.total / Math.max(...operators.map(o => o.total)) : 0;
                          return (
                            <View
                              key={name}
                              style={[
                                styles.leaderRow,
                                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                              ]}
                            >
                              <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? "#f59e0b20" : theme.muted }]}>
                                <Text style={[styles.rankText, { color: idx === 0 ? "#f59e0b" : theme.mutedForeground }]}>
                                  {idx + 1}
                                </Text>
                              </View>
                              <View style={styles.leaderInfo}>
                                <View style={styles.leaderNameRow}>
                                  <Text style={[styles.leaderName, { color: theme.foreground }]}>{name}</Text>
                                  <Text style={[styles.leaderCount, { color: theme.mutedForeground }]}>
                                    {op.receiptCount} scontrini
                                  </Text>
                                </View>
                                <View style={styles.leaderBarBg}>
                                  <View
                                    style={[
                                      styles.leaderBarFill,
                                      { width: `${Math.round(barPct * 100)}%`, backgroundColor: theme.primary },
                                    ]}
                                  />
                                </View>
                                <View style={styles.leaderAmounts}>
                                  <Text style={[styles.leaderTotal, { color: theme.primary }]}>
                                    {formatEuro(op.total)}
                                  </Text>
                                  <Text style={[styles.leaderSub, { color: theme.mutedForeground }]}>
                                    {formatEuro(op.cash)} c · {formatEuro(op.card)} k
                                    {op.gc > 0 ? ` · ${formatEuro(op.gc)} gc` : ""}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                    </View>
                  </>
                )}

                {/* Mance giornata */}
                {(tipData.cashTips > 0 || tipData.cardTips > 0) && (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>MANCE GIORNATA</Text>
                    <View style={[styles.payCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <PayRow label="Contanti" amount={tipData.cashTips} total={tipData.cashTips + tipData.cardTips} color="#22c55e" theme={theme} />
                      <PayRow label="Carta" amount={tipData.cardTips} total={tipData.cashTips + tipData.cardTips} color="#3b82f6" theme={theme} />
                      <View style={[styles.payRow, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        <View style={[styles.payDot, { backgroundColor: theme.primary }]} />
                        <Text style={[styles.payLabel, { color: theme.foreground }]}>Netto distr.</Text>
                        <View style={styles.payBarBg} />
                        <Text style={[styles.payAmount, { color: theme.primary, fontFamily: "Inter_700Bold" }]}>{formatEuro(distribution.netTotal)}</Text>
                      </View>
                    </View>
                    <View style={[styles.distCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {[
                        { label: `Sala ${config.salaPct}%`, amount: distribution.sala, color: "#f59e0b" },
                        { label: `Cucina ${config.cucinaPct}%`, amount: distribution.cucina, color: "#ef4444" },
                        { label: `Bar ${config.barPct}%`, amount: distribution.bar, color: "#8b5cf6" },
                        { label: `Fondo ${config.fondoPct}%`, amount: distribution.fondo, color: "#6b7280" },
                      ].map((d, i) => (
                        <View
                          key={d.label}
                          style={[
                            styles.distRow,
                            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                          ]}
                        >
                          <View style={[styles.distDot, { backgroundColor: d.color }]} />
                          <Text style={[styles.distRowLabel, { color: theme.foreground }]}>{d.label}</Text>
                          <Text style={[styles.distRowAmount, { color: theme.foreground }]}>{formatEuro(d.amount)}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.cassaLink, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => router.push("/(main)/cassa")}
                      activeOpacity={0.8}
                    >
                      <Feather name="dollar-sign" size={15} color={theme.primary} />
                      <Text style={[styles.cassaLinkText, { color: theme.primary }]}>Apri Cassa Manager · stampa resoconto</Text>
                      <Feather name="chevron-right" size={15} color={theme.mutedForeground} />
                    </TouchableOpacity>
                  </>
                )}

                {tipData.cashTips === 0 && tipData.cardTips === 0 && (
                  <TouchableOpacity
                    style={[styles.cassaLink, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push("/(main)/cassa")}
                    activeOpacity={0.8}
                  >
                    <Feather name="dollar-sign" size={15} color={theme.mutedForeground} />
                    <Text style={[styles.cassaLinkText, { color: theme.mutedForeground }]}>Registra mance in Cassa Manager</Text>
                    <Feather name="chevron-right" size={15} color={theme.mutedForeground} />
                  </TouchableOpacity>
                )}

                {/* Distribuzione oraria */}
                {hourlyData.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>DISTRIBUZIONE ORARIA</Text>
                    <View style={[styles.hourCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {hourlyData.map(h => (
                        <View key={h.hour} style={styles.hourRow}>
                          <Text style={[styles.hourLabel, { color: theme.mutedForeground }]}>
                            {getHourLabel(h.hour)}
                          </Text>
                          <View style={styles.hourBarBg}>
                            <View
                              style={[
                                styles.hourBarFill,
                                {
                                  width: `${Math.round((h.count / maxHourlyCount) * 100)}%`,
                                  backgroundColor: theme.primary + "80",
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.hourCount, { color: theme.foreground }]}>
                            {h.count}
                          </Text>
                          <Text style={[styles.hourTotal, { color: theme.mutedForeground }]}>
                            {formatEuro(h.total)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomTabBar />
    </View>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  theme,
  large = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
  theme: typeof colors.dark;
  large?: boolean;
}) {
  return (
    <View
      style={[
        styles.kpiCard,
        large && styles.kpiCardLarge,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Feather name={icon} size={16} color={accent} />
      <Text style={[styles.kpiValue, large && styles.kpiValueLarge, { color: theme.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: theme.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function PayRow({
  label,
  amount,
  total,
  color,
  theme,
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
  theme: typeof colors.dark;
}) {
  const p = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View style={[styles.payRow, { borderTopColor: theme.border }]}>
      <View style={[styles.payDot, { backgroundColor: color }]} />
      <Text style={[styles.payLabel, { color: theme.foreground }]}>{label}</Text>
      <View style={styles.payBarBg}>
        <View style={[styles.payBarFill, { width: `${p}%`, backgroundColor: color + "60" }]} />
      </View>
      <Text style={[styles.payPct, { color: theme.mutedForeground }]}>{pct(amount, total)}</Text>
      <Text style={[styles.payAmount, { color: theme.foreground }]}>{formatEuro(amount)}</Text>
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
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabelBox: { flex: 1, alignItems: "center", gap: 2 },
  dateLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  todayLink: { fontSize: 12, fontFamily: "Inter_400Regular" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
    marginTop: 12,
  },
  filterRow: { gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  kpiCardLarge: { minWidth: "100%", flexDirection: "row", alignItems: "center", gap: 10 },
  kpiValue: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  kpiValueLarge: { fontSize: 26, flex: 1 },
  kpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  payCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  payDot: { width: 8, height: 8, borderRadius: 4 },
  payLabel: { width: 64, fontSize: 13, fontFamily: "Inter_500Medium" },
  payBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(128,128,128,0.15)", overflow: "hidden" },
  payBarFill: { height: "100%", borderRadius: 3 },
  payPct: { width: 36, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  payAmount: { width: 72, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  stornoCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  stornoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stornoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  stornoValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  leaderCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  leaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rankText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  leaderInfo: { flex: 1, gap: 6 },
  leaderNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leaderName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  leaderCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  leaderBarBg: { height: 4, borderRadius: 2, backgroundColor: "rgba(128,128,128,0.2)", overflow: "hidden" },
  leaderBarFill: { height: "100%", borderRadius: 2 },
  leaderAmounts: { flexDirection: "row", alignItems: "center", gap: 8 },
  leaderTotal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  leaderSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  hourCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", paddingVertical: 4 },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  hourLabel: { width: 44, fontSize: 12, fontFamily: "Inter_500Medium" },
  hourBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(128,128,128,0.15)", overflow: "hidden" },
  hourBarFill: { height: "100%", borderRadius: 4 },
  hourCount: { width: 24, fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "right" },
  hourTotal: { width: 74, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  distCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  distRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  distDot: { width: 9, height: 9, borderRadius: 5 },
  distRowLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  distRowAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cassaLink: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 13, borderRadius: 12, borderWidth: 1, marginBottom: 4,
  },
  cassaLinkText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
});
