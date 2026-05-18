import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import {
  AuthHistoryItem,
  clearAuthHistory,
  loadAuthHistory,
} from "@/services/authHistory";

const TYPE_LABELS: Record<string, string> = {
  void_item: "Annullamento articolo",
  void_ticket: "Annullamento conto",
  discount: "Sconto",
  refund: "Rimborso",
  override: "Override",
  access: "Accesso",
  price_change: "Modifica Prezzo",
  payment: "Pagamento",
  reopen: "Riapertura conto",
  delete: "Eliminazione",
};

function formatDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatEuro(amount?: number): string | null {
  if (amount == null) return null;
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function getAmount(item: AuthHistoryItem): number | null {
  const v =
    item.payload?.amount ?? item.payload?.total ?? item.payload?.price;
  return v != null ? Number(v) : null;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const [items, setItems] = useState<AuthHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const data = await loadAuthHistory();
    setItems(data);
    if (isRefresh) setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClear = () => {
    Alert.alert(
      "Cancella storico",
      "Vuoi cancellare tutto lo storico delle autorizzazioni?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Cancella",
          style: "destructive",
          onPress: async () => {
            await clearAuthHistory();
            setItems([]);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          },
        },
      ]
    );
  };

  const ListHeader = (
    <View
      style={[
        styles.header,
        { paddingTop: topPadding + 8, backgroundColor: theme.background },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.foreground }]}>
          Storico
        </Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
            <Feather name="trash-2" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.headerSubtitle, { color: theme.mutedForeground }]}>
        Autorizzazioni concesse e rifiutate
      </Text>
      {items.length > 0 && (
        <Text
          style={[styles.sectionLabel, { color: theme.mutedForeground }]}
        >
          {items.length} RICHIESTE GESTITE
        </Text>
      )}
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Feather name="clock" size={32} color={theme.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
        Nessuna storia
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.mutedForeground }]}>
        Le autorizzazioni concesse e rifiutate{"\n"}appariranno qui
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <FlatList<AuthHistoryItem>
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item) => item.id + item.resolvedAt}
        renderItem={({ item }) => {
          const approved = item.resolution === "approved";
          const typeLabel = TYPE_LABELS[item.type] ?? item.type;
          const amount = getAmount(item);

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {/* Status stripe */}
              <View
                style={[
                  styles.stripe,
                  {
                    backgroundColor: approved
                      ? theme.success
                      : theme.destructive,
                  },
                ]}
              />

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <View style={styles.typeRow}>
                      <View
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: approved
                              ? theme.success + "18"
                              : theme.destructive + "15",
                          },
                        ]}
                      >
                        <Feather
                          name={approved ? "check" : "x"}
                          size={10}
                          color={
                            approved ? theme.success : theme.destructive
                          }
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            {
                              color: approved
                                ? theme.success
                                : theme.destructive,
                            },
                          ]}
                        >
                          {approved ? "AUTORIZZATA" : "RIFIUTATA"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.typeLabel,
                          { color: theme.mutedForeground },
                        ]}
                      >
                        {typeLabel}
                      </Text>
                    </View>
                    <Text
                      style={[styles.description, { color: theme.foreground }]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                    <Text
                      style={[
                        styles.meta,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      {item.operatorName}
                      {item.tableNum ? ` · Tavolo ${item.tableNum}` : ""}
                      {item.resolvedBy
                        ? ` · da ${item.resolvedBy}`
                        : ""}
                    </Text>
                  </View>

                  <View style={styles.cardRight}>
                    {amount != null && (
                      <Text
                        style={[styles.amount, { color: theme.foreground }]}
                      >
                        {formatEuro(amount)}
                      </Text>
                    )}
                    <Text
                      style={[styles.time, { color: theme.mutedForeground }]}
                    >
                      {formatDateTime(item.resolvedAt)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[styles.list, { paddingBottom: 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  stripe: {
    width: 4,
  },
  cardBody: {
    flex: 1,
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
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
    paddingTop: 2,
    minWidth: 80,
  },
  amount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
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
    lineHeight: 21,
  },
});
