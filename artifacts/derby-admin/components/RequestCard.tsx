import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import colors from "@/constants/colors";
import { AuthRequest } from "@/services/derbyApi";

const TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof Feather.glyphMap; label: string; color: string }
> = {
  void_item: { icon: "x-circle", label: "Annullamento articolo", color: "#EF4444" },
  void_ticket: { icon: "trash-2", label: "Annullamento conto", color: "#DC2626" },
  discount: { icon: "percent", label: "Sconto", color: "#F59E0B" },
  refund: { icon: "refresh-ccw", label: "Rimborso", color: "#6366F1" },
  override: { icon: "unlock", label: "Override", color: "#F05C28" },
  access: { icon: "key", label: "Accesso", color: "#8B5CF6" },
  price_change: { icon: "edit-2", label: "Modifica Prezzo", color: "#06B6D4" },
  payment: { icon: "credit-card", label: "Pagamento", color: "#22C55E" },
  reopen: { icon: "rotate-ccw", label: "Riapertura", color: "#0EA5E9" },
  delete: { icon: "trash", label: "Eliminazione", color: "#EF4444" },
  default: { icon: "alert-circle", label: "Richiesta", color: "#64748B" },
};

function formatTime(createdAt: number) {
  try {
    const d = new Date(createdAt);
    return d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function getAmountFromPayload(payload: Record<string, unknown>): number | null {
  const v = payload?.amount ?? payload?.total ?? payload?.price;
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

interface Props {
  request: AuthRequest;
  onPress: () => void;
}

export function RequestCard({ request, onPress }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const config = TYPE_CONFIG[request.type] ?? TYPE_CONFIG["default"];
  const amount = getAmountFromPayload(request.payload);
  const isPayment = request.type === "payment";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isPayment
            ? (isDark ? "#0D1F14" : "#F0FDF4")
            : theme.card,
          borderColor: isPayment ? "#22C55E55" : theme.border,
          borderWidth: isPayment ? 1.5 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[styles.iconContainer, { backgroundColor: config.color + "20" }]}
      >
        <Feather name={config.icon} size={22} color={config.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text
              style={[styles.typeLabel, { color: config.color }]}
              numberOfLines={1}
            >
              {config.label}
            </Text>
            {isPayment && (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>CONTO</Text>
              </View>
            )}
          </View>
          <Text style={[styles.time, { color: theme.mutedForeground }]}>
            {formatTime(request.createdAt)}
          </Text>
        </View>

        <Text
          style={[styles.description, { color: theme.foreground }]}
          numberOfLines={2}
        >
          {request.description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <Feather
              name="user"
              size={12}
              color={theme.mutedForeground}
              style={styles.metaIcon}
            />
            <Text style={[styles.meta, { color: theme.mutedForeground }]}>
              {request.operatorName}
            </Text>
          </View>
          {request.tableNum && (
            <View style={styles.metaItem}>
              <Feather
                name="grid"
                size={12}
                color={theme.mutedForeground}
                style={styles.metaIcon}
              />
              <Text style={[styles.meta, { color: theme.mutedForeground }]}>
                Tavolo {request.tableNum}
              </Text>
            </View>
          )}
          {amount != null && (
            <Text style={[styles.amount, { color: isPayment ? "#22C55E" : theme.primary }]}>
              € {amount.toFixed(2)}
            </Text>
          )}
        </View>
      </View>

      <Feather name="chevron-right" size={18} color={theme.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 12,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaIcon: {},
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  amount: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginLeft: "auto",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  priorityBadge: {
    backgroundColor: "#22C55E",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
