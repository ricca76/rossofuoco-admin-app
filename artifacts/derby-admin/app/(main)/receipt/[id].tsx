import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import {
  PrinterGroup,
  TicketDetail,
  getPrinterGroups,
  getTicketDetail,
  reprintTicket,
} from "@/services/derbyApi";

function formatEuro(amount: number): string {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const [selectedPgId, setSelectedPgId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      getTicketDetail(id),
      getPrinterGroups().catch(() => [] as PrinterGroup[]),
    ])
      .then(([t, g]) => {
        setTicket(t);
        setGroups(g);
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error ? e.message : "Errore caricamento scontrino"
        );
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleReprint = useCallback(async () => {
    if (!id) return;
    setReprinting(true);
    try {
      await reprintTicket(id, selectedPgId ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Ristampa avviata", "Lo scontrino è stato inviato alla stampante.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore ristampa";
      Alert.alert("Errore ristampa", msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setReprinting(false);
    }
  }, [id, selectedPgId]);

  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPadding = insets.bottom + 16;

  if (isLoading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: theme.background, paddingTop: topPadding },
        ]}
      >
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
          Caricamento scontrino...
        </Text>
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: theme.background, paddingTop: topPadding },
        ]}
      >
        <Feather name="alert-circle" size={40} color={theme.destructive} />
        <Text
          style={[styles.errorTitle, { color: theme.foreground }]}
        >
          Scontrino non trovato
        </Text>
        <Text
          style={[styles.errorSub, { color: theme.mutedForeground }]}
        >
          {error}
        </Text>
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: theme.primary },
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPaid = ticket.paid > 0;
  const statusLabel = ticket.status?.toUpperCase();
  const isEmitted =
    statusLabel === "COMPLETED" ||
    statusLabel === "CLOSED" ||
    statusLabel === "PAID" ||
    ticket.paid > 0;

  const activeItems = ticket.items.filter(
    (i) => !i.voided && !i.isSeparator
  );
  const voidedItems = ticket.items.filter((i) => i.voided);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button */}
      <TouchableOpacity
        style={[
          styles.backRow,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={16} color={theme.foreground} />
        <Text style={[styles.backLabel, { color: theme.foreground }]}>
          Scontrini
        </Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          {ticket.shortId ? `Scontrino #${ticket.shortId}` : `Ticket ${ticket.tokenNo ?? id}`}
        </Text>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isEmitted
                ? theme.success + "20"
                : theme.warning + "20",
            },
          ]}
        >
          <Feather
            name={isEmitted ? "check-circle" : "clock"}
            size={12}
            color={isEmitted ? theme.success : theme.warning}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: isEmitted ? theme.success : theme.warning,
              },
            ]}
          >
            {isEmitted ? "Emesso" : "Non emesso"}
          </Text>
        </View>
      </View>

      {/* Info card */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {ticket.tableNum && (
          <View style={styles.infoRow}>
            <Feather name="grid" size={14} color={theme.mutedForeground} />
            <Text
              style={[styles.infoLabel, { color: theme.mutedForeground }]}
            >
              Tavolo
            </Text>
            <Text style={[styles.infoValue, { color: theme.foreground }]}>
              {ticket.tableNum}
            </Text>
          </View>
        )}
        {ticket.server && (
          <View
            style={[
              styles.infoRow,
              {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Feather name="user" size={14} color={theme.mutedForeground} />
            <Text
              style={[styles.infoLabel, { color: theme.mutedForeground }]}
            >
              Operatore
            </Text>
            <Text style={[styles.infoValue, { color: theme.foreground }]}>
              {ticket.server}
            </Text>
          </View>
        )}
        {ticket.createDate && (
          <View
            style={[
              styles.infoRow,
              {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Feather name="clock" size={14} color={theme.mutedForeground} />
            <Text
              style={[styles.infoLabel, { color: theme.mutedForeground }]}
            >
              Aperto
            </Text>
            <Text style={[styles.infoValue, { color: theme.foreground }]}>
              {formatDateTime(ticket.createDate)}
            </Text>
          </View>
        )}
        {ticket.guests != null && (
          <View
            style={[
              styles.infoRow,
              {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Feather name="users" size={14} color={theme.mutedForeground} />
            <Text
              style={[styles.infoLabel, { color: theme.mutedForeground }]}
            >
              Coperti
            </Text>
            <Text style={[styles.infoValue, { color: theme.foreground }]}>
              {ticket.guests}
            </Text>
          </View>
        )}
        {ticket.isAsporto && (
          <View
            style={[
              styles.infoRow,
              {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Feather
              name="shopping-bag"
              size={14}
              color={theme.mutedForeground}
            />
            <Text
              style={[styles.infoLabel, { color: theme.mutedForeground }]}
            >
              Tipo
            </Text>
            <Text style={[styles.infoValue, { color: theme.foreground }]}>
              Asporto
            </Text>
          </View>
        )}
      </View>

      {/* Items */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        ARTICOLI
      </Text>
      <View
        style={[
          styles.itemsCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {activeItems.length === 0 ? (
          <Text
            style={[styles.noItems, { color: theme.mutedForeground }]}
          >
            Nessun articolo
          </Text>
        ) : (
          activeItems.map((item, idx) => (
            <View
              key={item.id || idx}
              style={[
                styles.itemRow,
                idx > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.itemLeft}>
                <Text style={[styles.itemQty, { color: theme.primary }]}>
                  {item.quantity}×
                </Text>
                <View style={styles.itemDetails}>
                  <Text
                    style={[styles.itemName, { color: theme.foreground }]}
                  >
                    {item.name}
                  </Text>
                  {item.notes && (
                    <Text
                      style={[
                        styles.itemNotes,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      {item.notes}
                    </Text>
                  )}
                </View>
              </View>
              <Text
                style={[styles.itemTotal, { color: theme.foreground }]}
              >
                {formatEuro(item.total)}
              </Text>
            </View>
          ))
        )}

        {/* Annullati */}
        {voidedItems.length > 0 && (
          <>
            <View
              style={[
                styles.voidedHeader,
                {
                  backgroundColor: theme.warning + "10",
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Feather
                name="x-circle"
                size={12}
                color={theme.warning}
              />
              <Text
                style={[styles.voidedHeaderText, { color: theme.warning }]}
              >
                ANNULLATI ({voidedItems.length})
              </Text>
            </View>
            {voidedItems.map((item, idx) => (
              <View
                key={`v-${item.id || idx}`}
                style={[
                  styles.itemRow,
                  styles.itemRowVoided,
                  {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={styles.itemLeft}>
                  <Text
                    style={[styles.itemQty, { color: theme.warning }]}
                  >
                    {item.quantity}×
                  </Text>
                  <Text
                    style={[
                      styles.itemName,
                      styles.itemNameVoided,
                      { color: theme.mutedForeground },
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemTotal,
                    styles.itemTotalVoided,
                    { color: theme.mutedForeground },
                  ]}
                >
                  {formatEuro(item.total)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Total */}
        <View
          style={[
            styles.totalRow,
            {
              borderTopColor: theme.border,
              borderTopWidth: 1,
            },
          ]}
        >
          <Text style={[styles.totalLabel, { color: theme.foreground }]}>
            Totale
          </Text>
          <Text style={[styles.totalValue, { color: theme.primary }]}>
            {formatEuro(ticket.total)}
          </Text>
        </View>
      </View>

      {/* Note */}
      {ticket.ticketNote && (
        <>
          <Text
            style={[styles.sectionLabel, { color: theme.mutedForeground }]}
          >
            NOTE
          </Text>
          <View
            style={[
              styles.noteCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.noteText, { color: theme.foreground }]}>
              {ticket.ticketNote}
            </Text>
          </View>
        </>
      )}

      {/* Reprint section */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        RISTAMPA
      </Text>

      {groups.length > 0 && (
        <View
          style={[
            styles.groupPicker,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text
            style={[styles.groupPickerLabel, { color: theme.mutedForeground }]}
          >
            Stampante:
          </Text>
          <View style={styles.groupBtns}>
            <TouchableOpacity
              style={[
                styles.groupBtn,
                {
                  backgroundColor:
                    selectedPgId === null
                      ? theme.primary + "20"
                      : theme.muted,
                  borderColor:
                    selectedPgId === null ? theme.primary : theme.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedPgId(null);
              }}
            >
              <Text
                style={[
                  styles.groupBtnText,
                  {
                    color:
                      selectedPgId === null
                        ? theme.primary
                        : theme.foreground,
                  },
                ]}
              >
                Tutte
              </Text>
            </TouchableOpacity>
            {groups.map((g) => (
              <TouchableOpacity
                key={g.pgId}
                style={[
                  styles.groupBtn,
                  {
                    backgroundColor:
                      selectedPgId === g.pgId
                        ? theme.primary + "20"
                        : theme.muted,
                    borderColor:
                      selectedPgId === g.pgId
                        ? theme.primary
                        : theme.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPgId(g.pgId);
                }}
              >
                <Text
                  style={[
                    styles.groupBtnText,
                    {
                      color:
                        selectedPgId === g.pgId
                          ? theme.primary
                          : theme.foreground,
                    },
                  ]}
                >
                  {g.pgName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.reprintBtn,
          {
            backgroundColor: theme.primary,
            opacity: reprinting ? 0.7 : 1,
          },
        ]}
        onPress={handleReprint}
        disabled={reprinting}
        activeOpacity={0.8}
      >
        {reprinting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="printer" size={18} color="#fff" />
            <Text style={styles.reprintBtnText}>
              {selectedPgId
                ? `Ristampa su ${groups.find((g) => g.pgId === selectedPgId)?.pgName ?? "stampante"}`
                : "Ristampa scontrino"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  errorSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  backBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  scroll: { paddingHorizontal: 16 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 8,
  },
  backLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 4,
  },
  itemsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  noItems: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  itemRowVoided: {
    opacity: 0.55,
  },
  itemLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  itemQty: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    minWidth: 24,
  },
  itemDetails: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  itemNameVoided: {
    textDecorationLine: "line-through",
  },
  itemNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  itemTotalVoided: {
    textDecorationLine: "line-through",
  },
  voidedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  voidedHeaderText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  totalValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  noteText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  groupPicker: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  groupPickerLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  groupBtns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  groupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  groupBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  reprintBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  reprintBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
