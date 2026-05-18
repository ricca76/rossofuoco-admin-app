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
  FiscalReceiptPayload,
  PrinterGroupConfig,
  TicketDetail,
  getPrinterConfig,
  getTicketDetail,
  printFiscalReceiptToPrinter,
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
  const { id, closingDate: closingDateParam, server: serverParam } =
    useLocalSearchParams<{ id: string; closingDate?: string; server?: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [printerGroups, setPrinterGroups] = useState<PrinterGroupConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comanda reprint (kitchen)
  const [reprinting, setReprinting] = useState(false);

  // Fiscal reprint
  const [fiscalPrinting, setFiscalPrinting] = useState(false);
  const [fiscalPgId, setFiscalPgId] = useState<string | null>(null);

  const closingDate = closingDateParam || null;
  const serverName = serverParam || null;

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      getTicketDetail(id),
      getPrinterConfig().catch(() => ({ groups: [] as PrinterGroupConfig[] })),
    ])
      .then(([t, cfg]) => {
        setTicket(t);
        // Only show groups that have at least one printer configured
        const withPrinters = cfg.groups.filter((g) => g.printers.length > 0);
        setPrinterGroups(withPrinters);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Errore caricamento scontrino");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleFiscalReprint = useCallback(async () => {
    if (!ticket) return;

    const groupsToUse =
      fiscalPgId !== null
        ? printerGroups.filter((g) => g.pgId === fiscalPgId)
        : printerGroups;

    if (groupsToUse.length === 0) {
      Alert.alert(
        "Nessuna stampante",
        "Nessuna stampante configurata. Configura le stampanti in Rosso Fuoco Console."
      );
      return;
    }

    const allPrinters = groupsToUse.flatMap((g) => g.printers);
    if (allPrinters.length === 0) {
      Alert.alert("Nessuna stampante", "Il gruppo selezionato non ha stampanti.");
      return;
    }

    const activeItems = ticket.items.filter((i) => !i.voided && !i.isSeparator);

    const receipt: FiscalReceiptPayload = {
      shortId: ticket.shortId,
      tokenNo: ticket.tokenNo,
      closingDate: closingDate ?? ticket.createDate,
      tableNum: ticket.tableNum,
      guests: ticket.guests,
      waiter: ticket.server ?? serverName,
      total: ticket.total,
      paid: ticket.paid,
      items: activeItems.map((i) => ({
        name: i.name,
        qty: i.quantity,
        totalPrice: i.total,
      })),
    };

    setFiscalPrinting(true);
    try {
      const results = await Promise.allSettled(
        allPrinters.map((p) =>
          printFiscalReceiptToPrinter(p.ip, p.port, receipt)
        )
      );

      const failures = results.filter((r) => r.status === "rejected");
      const successes = results.length - failures.length;

      if (failures.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Ristampa avviata",
          `Scontrino fiscale inviato a ${successes} stampant${successes === 1 ? "e" : "i"}.`
        );
      } else if (successes > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "Parzialmente completato",
          `Inviato a ${successes} stampant${successes === 1 ? "e" : "i"}. ${failures.length} errore${failures.length > 1 ? "i" : ""}.`
        );
      } else {
        const firstErr = failures[0];
        const msg =
          firstErr.status === "rejected"
            ? (firstErr.reason instanceof Error
                ? firstErr.reason.message
                : "Errore di stampa")
            : "Errore sconosciuto";
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Errore ristampa fiscale", msg);
      }
    } finally {
      setFiscalPrinting(false);
    }
  }, [ticket, printerGroups, fiscalPgId, closingDate, serverName]);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPadding = insets.bottom + 16;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, paddingTop: topPadding }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
          Caricamento scontrino...
        </Text>
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, paddingTop: topPadding }]}>
        <Feather name="alert-circle" size={40} color={theme.destructive} />
        <Text style={[styles.errorTitle, { color: theme.foreground }]}>
          Scontrino non trovato
        </Text>
        <Text style={[styles.errorSub, { color: theme.mutedForeground }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusLabel = ticket.status?.toUpperCase();
  const isEmitted =
    statusLabel === "COMPLETED" ||
    statusLabel === "CLOSED" ||
    statusLabel === "PAID" ||
    ticket.paid > 0;

  const activeItems = ticket.items.filter((i) => !i.voided && !i.isSeparator);
  const voidedItems = ticket.items.filter((i) => i.voided);
  const displayClosingDate = closingDate || ticket.createDate;
  const displayServer = ticket.server ?? serverName;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <TouchableOpacity
        style={[styles.backRow, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={16} color={theme.foreground} />
        <Text style={[styles.backLabel, { color: theme.foreground }]}>Scontrini</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          {ticket.shortId ? `Scontrino #${ticket.shortId}` : `Ticket ${ticket.tokenNo ?? id}`}
        </Text>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: isEmitted ? theme.success + "20" : theme.warning + "20" },
          ]}
        >
          <Feather
            name={isEmitted ? "check-circle" : "clock"}
            size={12}
            color={isEmitted ? theme.success : theme.warning}
          />
          <Text style={[styles.statusText, { color: isEmitted ? theme.success : theme.warning }]}>
            {isEmitted ? "Emesso" : "Non emesso"}
          </Text>
        </View>
      </View>

      {/* Info card */}
      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {displayClosingDate && (
          <InfoRow
            icon="calendar"
            label="Chiuso"
            value={formatDateTime(displayClosingDate)}
            theme={theme}
          />
        )}
        {ticket.tableNum && (
          <InfoRow icon="grid" label="Tavolo" value={ticket.tableNum} theme={theme} />
        )}
        {displayServer && (
          <InfoRow icon="user" label="Operatore" value={displayServer} theme={theme} />
        )}
        {ticket.guests != null && (
          <InfoRow icon="users" label="Coperti" value={String(ticket.guests)} theme={theme} />
        )}
        {ticket.isAsporto && (
          <InfoRow icon="shopping-bag" label="Tipo" value="Asporto" theme={theme} />
        )}
      </View>

      {/* Items */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>ARTICOLI</Text>
      <View style={[styles.itemsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {activeItems.length === 0 ? (
          <Text style={[styles.noItems, { color: theme.mutedForeground }]}>Nessun articolo</Text>
        ) : (
          activeItems.map((item, idx) => (
            <View
              key={`${item.id || idx}-active`}
              style={[
                styles.itemRow,
                idx > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.itemLeft}>
                <Text style={[styles.itemQty, { color: theme.primary }]}>{item.quantity}×</Text>
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: theme.foreground }]}>{item.name}</Text>
                  {item.notes && (
                    <Text style={[styles.itemNotes, { color: theme.mutedForeground }]}>
                      {item.notes}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={[styles.itemTotal, { color: theme.foreground }]}>
                {formatEuro(item.total)}
              </Text>
            </View>
          ))
        )}

        {voidedItems.length > 0 && (
          <>
            <View
              style={[
                styles.voidedHeader,
                { backgroundColor: theme.warning + "10", borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Feather name="x-circle" size={12} color={theme.warning} />
              <Text style={[styles.voidedHeaderText, { color: theme.warning }]}>
                ANNULLATI ({voidedItems.length})
              </Text>
            </View>
            {voidedItems.map((item, idx) => (
              <View
                key={`${item.id || idx}-voided`}
                style={[
                  styles.itemRow,
                  styles.itemRowVoided,
                  { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemQty, { color: theme.warning }]}>{item.quantity}×</Text>
                  <Text style={[styles.itemName, styles.itemNameVoided, { color: theme.mutedForeground }]}>
                    {item.name}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, styles.itemTotalVoided, { color: theme.mutedForeground }]}>
                  {formatEuro(item.total)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Totals */}
        <View style={[styles.totalRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}>
          <Text style={[styles.totalLabel, { color: theme.foreground }]}>Totale</Text>
          <Text style={[styles.totalValue, { color: theme.primary }]}>
            {formatEuro(ticket.total)}
          </Text>
        </View>
        {ticket.paid > 0 && (
          <>
            <View style={[styles.totalRow, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.paidLabel, { color: theme.mutedForeground }]}>Pagato</Text>
              <Text style={[styles.paidValue, { color: theme.mutedForeground }]}>
                {formatEuro(ticket.paid)}
              </Text>
            </View>
            {ticket.paid > ticket.total && (
              <View style={[styles.totalRow, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.paidLabel, { color: theme.mutedForeground }]}>Resto</Text>
                <Text style={[styles.paidValue, { color: theme.success }]}>
                  {formatEuro(ticket.paid - ticket.total)}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Note */}
      {ticket.ticketNote && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>NOTE</Text>
          <View style={[styles.noteCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.noteText, { color: theme.foreground }]}>{ticket.ticketNote}</Text>
          </View>
        </>
      )}

      {/* ── Ristampa Fiscale ─────────────────────────────────────── */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        RISTAMPA SCONTRINO FISCALE
      </Text>

      {printerGroups.length > 0 ? (
        <>
          {/* Printer group picker */}
          <View style={[styles.groupPicker, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.groupPickerLabel, { color: theme.mutedForeground }]}>
              Stampante:
            </Text>
            <View style={styles.groupBtns}>
              <TouchableOpacity
                style={[
                  styles.groupBtn,
                  {
                    backgroundColor: fiscalPgId === null ? theme.primary + "20" : theme.muted,
                    borderColor: fiscalPgId === null ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => { Haptics.selectionAsync(); setFiscalPgId(null); }}
              >
                <Text style={[styles.groupBtnText, { color: fiscalPgId === null ? theme.primary : theme.foreground }]}>
                  Tutte
                </Text>
              </TouchableOpacity>
              {printerGroups.map((g) => (
                <TouchableOpacity
                  key={g.pgId}
                  style={[
                    styles.groupBtn,
                    {
                      backgroundColor: fiscalPgId === g.pgId ? theme.primary + "20" : theme.muted,
                      borderColor: fiscalPgId === g.pgId ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setFiscalPgId(g.pgId); }}
                >
                  <Text
                    style={[
                      styles.groupBtnText,
                      { color: fiscalPgId === g.pgId ? theme.primary : theme.foreground },
                    ]}
                  >
                    {g.pgName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.fiscalBtn,
              { backgroundColor: theme.primary, opacity: fiscalPrinting ? 0.7 : 1 },
            ]}
            onPress={handleFiscalReprint}
            disabled={fiscalPrinting}
            activeOpacity={0.8}
          >
            {fiscalPrinting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="printer" size={18} color="#fff" />
                <View>
                  <Text style={styles.fiscalBtnText}>Ristampa scontrino fiscale</Text>
                  <Text style={styles.fiscalBtnSub}>
                    {fiscalPgId !== null
                      ? printerGroups.find((g) => g.pgId === fiscalPgId)?.pgName ?? ""
                      : `${printerGroups.reduce((s, g) => s + g.printers.length, 0)} stampant${printerGroups.reduce((s, g) => s + g.printers.length, 0) === 1 ? "e" : "i"}`}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <View style={[styles.fiscalNote, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="info" size={13} color={theme.mutedForeground} />
            <Text style={[styles.fiscalNoteText, { color: theme.mutedForeground }]}>
              Il formato è quello configurato in Rosso Fuoco Console (layout scontrino).
            </Text>
          </View>
        </>
      ) : (
        <View style={[styles.noPrinterBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="printer" size={20} color={theme.mutedForeground} />
          <Text style={[styles.noPrinterText, { color: theme.mutedForeground }]}>
            Nessuna stampante configurata
          </Text>
          <Text style={[styles.noPrinterSub, { color: theme.mutedForeground }]}>
            Configura le stampanti in Rosso Fuoco Console
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  theme: typeof colors.dark;
}) {
  return (
    <View style={[styles.infoRow, { borderTopColor: theme.border }]}>
      <Feather name={icon} size={14} color={theme.mutedForeground} />
      <Text style={[styles.infoLabel, { color: theme.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.foreground }]}>{value}</Text>
    </View>
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
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  errorTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  errorSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  backBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
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
  backLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4, flex: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 4,
  },
  itemsCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  noItems: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 16 },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  itemRowVoided: { opacity: 0.55 },
  itemLeft: { flex: 1, flexDirection: "row", gap: 6, alignItems: "flex-start" },
  itemQty: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 24 },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  itemNameVoided: { textDecorationLine: "line-through" },
  itemNotes: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  itemTotal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemTotalVoided: { textDecorationLine: "line-through" },
  voidedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  voidedHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  totalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  paidLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  paidValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  noteCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  noteText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  groupPicker: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  groupPickerLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  groupBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  groupBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  fiscalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 60,
    borderRadius: 14,
    marginBottom: 10,
  },
  fiscalBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  fiscalBtnSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  fiscalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  fiscalNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  noPrinterBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  noPrinterText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noPrinterSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
