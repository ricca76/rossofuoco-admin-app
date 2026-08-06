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
import { useAuth } from "@/context/AuthContext";
import { useRequests } from "@/context/RequestsContext";
import {
  BiometricType,
  authenticateWithBiometrics,
  getBiometricType,
} from "@/services/biometrics";

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

function formatPayloadKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { getRequest, approve, deny } = useRequests();
  const { adminName } = useAuth();

  const request = getRequest(id ?? "");
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");

  useEffect(() => {
    getBiometricType().then(setBiometricType).catch(() => {});
  }, []);

  const doApprove = useCallback(async () => {
    if (!request) return;
    setApproving(true);
    try {
      await approve(request.id, adminName ?? undefined);
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore";
      Alert.alert("Errore", msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setApproving(false);
    }
  }, [request, approve, adminName]);

  const handleApprove = useCallback(async () => {
    if (!request) return;
    if (biometricType !== "none") {
      const bio = await authenticateWithBiometrics("Autorizza richiesta con Face ID");
      if (!bio.success) {
        if (bio.error && bio.error !== "Autenticazione annullata.") {
          Alert.alert("Errore", bio.error);
        }
        return;
      }
    }
    await doApprove();
  }, [request, biometricType, doApprove]);

  const handleDeny = useCallback(async () => {
    if (!request) return;
    Alert.alert(
      "Rifiuta richiesta",
      "Sei sicuro di voler rifiutare questa richiesta?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Rifiuta",
          style: "destructive",
          onPress: async () => {
            setDenying(true);
            try {
              await deny(request.id, adminName ?? undefined);
              router.back();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Errore";
              Alert.alert("Errore", msg);
            } finally {
              setDenying(false);
            }
          },
        },
      ]
    );
  }, [request, deny, adminName]);

  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 24);

  if (!request) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Feather name="alert-circle" size={32} color={theme.mutedForeground} />
        <Text style={[styles.notFoundText, { color: theme.mutedForeground }]}>
          Richiesta non trovata
        </Text>
      </View>
    );
  }

  const typeLabel = TYPE_LABELS[request.type] ?? request.type;

  const formattedTime = (() => {
    try {
      return new Date(request.createdAt).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(request.createdAt);
    }
  })();

  const payloadEntries = Object.entries(request.payload ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== ""
  );

  const isPayment = request.type === "payment";

  const amount =
    request.payload?.amount ??
    request.payload?.total ??
    request.payload?.price;

  // Payment method(s) from payload — handle various field names the POS may send
  const rawMethods =
    request.payload?.paymentMethods ??
    request.payload?.payment_methods ??
    request.payload?.methods ??
    request.payload?.paymentMethod ??
    request.payload?.payment_method ??
    request.payload?.method ??
    null;

  const paymentMethods: string[] = (() => {
    if (rawMethods == null) return [];
    if (Array.isArray(rawMethods)) return rawMethods.map(String).filter(Boolean);
    const s = String(rawMethods).trim();
    return s ? s.split(/[,;|]/).map((m) => m.trim()).filter(Boolean) : [];
  })();

  const METHOD_LABELS: Record<string, string> = {
    cash: "Contanti",
    card: "Carta",
    credit_card: "Carta di credito",
    debit_card: "Carta di debito",
    contactless: "Contactless",
    bancomat: "Bancomat",
    voucher: "Voucher",
    ticket: "Ticket",
    satispay: "Satispay",
    app: "App",
  };

  const approveBtnLabel =
    biometricType === "faceId"
      ? "Autorizza con Face ID"
      : biometricType === "fingerprint"
      ? "Autorizza con Touch ID"
      : "Autorizza";

  const approveBtnIcon =
    biometricType !== "none" ? "smile" : "check-circle";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Type + description */}
      <View style={styles.typeChipRow}>
        <View
          style={[
            styles.typeChip,
            {
              backgroundColor: isPayment ? "#22C55E20" : theme.primary + "18",
            },
          ]}
        >
          <Text
            style={[
              styles.typeText,
              { color: isPayment ? "#22C55E" : theme.primary },
            ]}
          >
            {typeLabel.toUpperCase()}
          </Text>
        </View>
        {isPayment && (
          <View style={styles.paymentPriorityBadge}>
            <Feather name="credit-card" size={11} color="#fff" />
            <Text style={styles.paymentPriorityText}>CHIUSURA CONTO</Text>
          </View>
        )}
      </View>

      <Text style={[styles.description, { color: theme.foreground }]}>
        {request.description}
      </Text>

      {/* Payment — prominent amount + methods block */}
      {isPayment ? (
        <View
          style={[
            styles.paymentBox,
            { backgroundColor: isDark ? "#0D1F14" : "#F0FDF4", borderColor: "#22C55E55" },
          ]}
        >
          <View style={styles.paymentBoxTop}>
            <View>
              <Text style={[styles.paymentBoxLabel, { color: "#22C55E" }]}>
                Totale da incassare
              </Text>
              <Text style={[styles.paymentBoxAmount, { color: isDark ? "#4ADE80" : "#16A34A" }]}>
                {amount != null ? `€ ${Number(amount).toFixed(2)}` : "—"}
              </Text>
            </View>
            <View
              style={[
                styles.paymentIconCircle,
                { backgroundColor: "#22C55E25" },
              ]}
            >
              <Feather name="dollar-sign" size={24} color="#22C55E" />
            </View>
          </View>

          {paymentMethods.length > 0 && (
            <View style={styles.paymentMethods}>
              <Text style={[styles.paymentMethodsLabel, { color: isDark ? "#4ADE80" : "#16A34A" }]}>
                Metodi di pagamento
              </Text>
              <View style={styles.paymentMethodChips}>
                {paymentMethods.map((m) => (
                  <View key={m} style={styles.methodChip}>
                    <Feather name="credit-card" size={11} color="#22C55E" />
                    <Text style={styles.methodChipText}>
                      {METHOD_LABELS[m.toLowerCase()] ?? m}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : (
        /* Generic amount for non-payment types */
        amount != null && (
          <View
            style={[
              styles.amountBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.amountLabel, { color: theme.mutedForeground }]}>
              Importo
            </Text>
            <Text style={[styles.amountValue, { color: theme.primary }]}>
              € {Number(amount).toFixed(2)}
            </Text>
          </View>
        )
      )}

      {/* Info */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <InfoRow
          icon="user"
          label="Operatore"
          value={request.operatorName}
          theme={theme}
        />
        {request.tableNum && (
          <InfoRow
            icon="grid"
            label="Tavolo"
            value={request.tableNum}
            theme={theme}
          />
        )}
        <InfoRow
          icon="hash"
          label="Conto"
          value={request.ticketId}
          theme={theme}
        />
        <InfoRow
          icon="clock"
          label="Orario"
          value={formattedTime}
          theme={theme}
        />
        <InfoRow
          icon="tag"
          label="ID"
          value={request.id.slice(0, 8) + "…"}
          theme={theme}
          isLast
        />
      </View>

      {/* Payload details */}
      {payloadEntries.length > 0 && (
        <>
          <Text
            style={[styles.sectionLabel, { color: theme.mutedForeground }]}
          >
            DETTAGLI
          </Text>
          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {payloadEntries.map(([key, val], i, arr) => (
              <InfoRow
                key={key}
                icon="info"
                label={formatPayloadKey(key)}
                value={String(val)}
                theme={theme}
                isLast={i === arr.length - 1}
              />
            ))}
          </View>
        </>
      )}

      {/* ── Azioni ────────────────────────────────────────────── */}
      <View style={styles.actions}>
        {biometricType !== "none" && (
          <View
            style={[
              styles.biometricBadge,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Feather name="smile" size={14} color={theme.mutedForeground} />
            <Text style={[styles.biometricBadgeText, { color: theme.mutedForeground }]}>
              {biometricType === "faceId"
                ? "Richiede Face ID per autorizzare"
                : "Richiede Touch ID per autorizzare"}
            </Text>
          </View>
        )}

        {/* Approve */}
        <TouchableOpacity
          style={[
            styles.approveBtn,
            { backgroundColor: theme.success },
            (approving || denying) && styles.btnDisabled,
          ]}
          onPress={handleApprove}
          disabled={approving || denying}
          activeOpacity={0.82}
        >
          {approving ? (
            <ActivityIndicator size={22} color="#fff" />
          ) : (
            <>
              <Feather name={approveBtnIcon} size={22} color="#fff" />
              <Text style={styles.approveBtnText}>{approveBtnLabel}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Deny */}
        <TouchableOpacity
          style={[
            styles.denyBtn,
            {
              borderColor: theme.destructive + "55",
              backgroundColor: theme.destructive + "0D",
            },
            (approving || denying) && styles.btnDisabled,
          ]}
          onPress={handleDeny}
          disabled={approving || denying}
          activeOpacity={0.82}
        >
          {denying ? (
            <ActivityIndicator size={18} color={theme.destructive} />
          ) : (
            <>
              <Feather name="x-circle" size={18} color={theme.destructive} />
              <Text style={[styles.denyBtnText, { color: theme.destructive }]}>
                Rifiuta richiesta
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  theme,
  isLast = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  theme: typeof colors.dark;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Feather name={icon} size={14} color={theme.mutedForeground} />
      <Text style={[styles.infoLabel, { color: theme.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[styles.infoValue, { color: theme.foreground }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: { fontSize: 16, fontFamily: "Inter_400Regular" },

  typeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  description: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 27,
  },

  amountBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  amountValue: { fontSize: 24, fontFamily: "Inter_700Bold" },

  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: -6,
    marginLeft: 4,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    width: 90,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },

  actions: {
    gap: 10,
    marginTop: 6,
  },

  biometricBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  biometricBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  approveBtn: {
    height: 64,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  approveBtnText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },

  denyBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  denyBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  btnDisabled: { opacity: 0.55 },

  // Payment-specific styles
  typeChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  paymentPriorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  paymentPriorityText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  paymentBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  paymentBoxTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentBoxLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  paymentBoxAmount: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  paymentIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethods: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#22C55E40",
    paddingTop: 12,
  },
  paymentMethodsLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  paymentMethodChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  methodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#22C55E18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  methodChipText: {
    color: "#22C55E",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
