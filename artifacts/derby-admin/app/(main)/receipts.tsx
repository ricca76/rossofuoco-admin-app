import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar } from "@/components/BottomTabBar";
import colors from "@/constants/colors";
import { DailyReceipt, getDailyReceipts } from "@/services/derbyApi";

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  try {
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function formatEuro(amount: number): string {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function getDateStr(offset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = getDateStr(-1);
  if (dateStr === today) return "Oggi";
  if (dateStr === yesterday) return "Ieri";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function PaymentBadges({
  receipt,
  theme,
}: {
  receipt: DailyReceipt;
  theme: (typeof colors)["light"];
}) {
  const parts: string[] = [];
  if (receipt.cashAmount > 0) parts.push("Contanti");
  if (receipt.cardAmount > 0) parts.push("Carta");
  if (receipt.gcAmount > 0) parts.push("Gift card");
  if (parts.length === 0) return null;
  return (
    <View style={styles.badges}>
      {parts.map((p) => (
        <View
          key={p}
          style={[
            styles.badge,
            { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" },
          ]}
        >
          <Text style={[styles.badgeText, { color: theme.primary }]}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const [selectedDate, setSelectedDate] = useState(getDateStr(0));
  const [receipts, setReceipts] = useState<DailyReceipt[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const res = await getDailyReceipts(selectedDate);
        setReceipts(res.tickets);
        setTotalRevenue(res.totalRevenue);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Errore caricamento scontrini");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    load();
  }, [load]);

  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const ListHeader = (
    <View
      style={[
        styles.header,
        {
          paddingTop: topPadding + 8,
          backgroundColor: theme.background,
        },
      ]}
    >
      <Text style={[styles.headerTitle, { color: theme.foreground }]}>
        Scontrini
      </Text>

      {/* Date selector */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={[
            styles.dateNavBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            const d = new Date(selectedDate + "T00:00:00");
            d.setDate(d.getDate() - 1);
            setSelectedDate(d.toISOString().slice(0, 10));
          }}
        >
          <Feather name="chevron-left" size={18} color={theme.foreground} />
        </TouchableOpacity>

        <View style={styles.dateLabelBox}>
          <Text style={[styles.dateLabel, { color: theme.foreground }]}>
            {formatDateLabel(selectedDate)}
          </Text>
          {selectedDate !== getDateStr(0) && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedDate(getDateStr(0));
              }}
            >
              <Text style={[styles.todayLink, { color: theme.primary }]}>
                Torna ad oggi
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.dateNavBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: selectedDate >= getDateStr(0) ? 0.3 : 1,
            },
          ]}
          disabled={selectedDate >= getDateStr(0)}
          onPress={() => {
            Haptics.selectionAsync();
            const d = new Date(selectedDate + "T00:00:00");
            d.setDate(d.getDate() + 1);
            setSelectedDate(d.toISOString().slice(0, 10));
          }}
        >
          <Feather name="chevron-right" size={18} color={theme.foreground} />
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      {!isLoading && receipts.length > 0 && (
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>
              {receipts.length}
            </Text>
            <Text
              style={[styles.summaryLabel, { color: theme.mutedForeground }]}
            >
              Scontrini
            </Text>
          </View>
          <View
            style={[styles.summaryDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.foreground }]}>
              {formatEuro(totalRevenue || receipts.reduce((s, r) => s + r.total, 0))}
            </Text>
            <Text
              style={[styles.summaryLabel, { color: theme.mutedForeground }]}
            >
              Totale
            </Text>
          </View>
        </View>
      )}

      {error && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: theme.destructive + "15",
              borderColor: theme.destructive + "30",
            },
          ]}
        >
          <Feather name="alert-circle" size={14} color={theme.destructive} />
          <Text style={[styles.errorText, { color: theme.destructive }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={[styles.retryText, { color: theme.primary }]}>
              Riprova
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text
        style={[styles.sectionTitle, { color: theme.mutedForeground }]}
      >
        {receipts.length > 0
          ? `${receipts.length} SCONTRINO${receipts.length !== 1 ? "I" : ""} CHIUSO${receipts.length !== 1 ? "I" : ""}`
          : "SCONTRINI"}
      </Text>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator color={theme.primary} size="large" />
      ) : (
        <>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Feather name="file-text" size={32} color={theme.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
            Nessuno scontrino
          </Text>
          <Text
            style={[styles.emptySubtitle, { color: theme.mutedForeground }]}
          >
            Nessun scontrino chiuso per {formatDateLabel(selectedDate).toLowerCase()}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <FlatList<DailyReceipt>
        style={{ flex: 1 }}
        data={receipts}
        keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : String(index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({
                pathname: "/(main)/receipt/[id]",
                params: { id: item.id },
              });
            }}
            activeOpacity={0.75}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <View style={styles.cardTitleRow}>
                  {item.shortId && (
                    <Text
                      style={[
                        styles.shortId,
                        { color: theme.primary },
                      ]}
                    >
                      #{item.shortId}
                    </Text>
                  )}
                  {item.tokenNo && !item.shortId && (
                    <Text style={[styles.shortId, { color: theme.primary }]}>
                      T-{item.tokenNo}
                    </Text>
                  )}
                  {item.tableNum && (
                    <View
                      style={[
                        styles.tableBadge,
                        {
                          backgroundColor: theme.muted,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Feather
                        name="grid"
                        size={10}
                        color={theme.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.tableText,
                          { color: theme.mutedForeground },
                        ]}
                      >
                        {item.tableNum}
                      </Text>
                    </View>
                  )}
                  {item.voidedCount > 0 && (
                    <View
                      style={[
                        styles.voidBadge,
                        { backgroundColor: theme.warning + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.voidText,
                          { color: theme.warning },
                        ]}
                      >
                        {item.voidedCount} ann.
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.serverName, { color: theme.mutedForeground }]}
                >
                  {item.server ?? "Operatore sconosciuto"} · {formatTime(item.closingDate)}
                </Text>
                <PaymentBadges receipt={item} theme={theme} />
              </View>
              <View style={styles.cardRight}>
                <Text
                  style={[styles.totalAmount, { color: theme.foreground }]}
                >
                  {formatEuro(item.total)}
                </Text>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={theme.mutedForeground}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 8 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flexGrow: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 16,
    marginTop: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabelBox: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  dateLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  todayLink: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  summaryCard: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  retryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardLeft: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  shortId: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  tableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tableText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  voidBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voidText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  serverName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
    paddingTop: 2,
  },
  totalAmount: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
