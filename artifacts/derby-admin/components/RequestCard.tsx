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
  discount: { icon: "percent", label: "Sconto", color: "#F59E0B" },
  refund: { icon: "refresh-ccw", label: "Rimborso", color: "#6366F1" },
  void: { icon: "x-circle", label: "Annullamento", color: "#EF4444" },
  override: { icon: "unlock", label: "Override", color: "#F05C28" },
  access: { icon: "key", label: "Accesso", color: "#8B5CF6" },
  price_change: { icon: "edit-2", label: "Modifica Prezzo", color: "#06B6D4" },
  payment: { icon: "credit-card", label: "Pagamento", color: "#22C55E" },
  default: { icon: "alert-circle", label: "Richiesta", color: "#64748B" },
};

function formatTime(timestamp: string) {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function formatAmount(amount?: number) {
  if (amount == null) return null;
  return `€ ${amount.toFixed(2)}`;
}

interface Props {
  request: AuthRequest;
  onPress: () => void;
}

export function RequestCard({ request, onPress }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;

  const config =
    TYPE_CONFIG[request.type] ?? TYPE_CONFIG["default"];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
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
          <Text
            style={[styles.typeLabel, { color: config.color }]}
            numberOfLines={1}
          >
            {config.label}
          </Text>
          <Text style={[styles.time, { color: theme.mutedForeground }]}>
            {formatTime(request.timestamp)}
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
              {request.operator}
            </Text>
          </View>
          {request.table && (
            <View style={styles.metaItem}>
              <Feather
                name="grid"
                size={12}
                color={theme.mutedForeground}
                style={styles.metaIcon}
              />
              <Text style={[styles.meta, { color: theme.mutedForeground }]}>
                {request.table}
              </Text>
            </View>
          )}
          {request.amount != null && (
            <Text style={[styles.amount, { color: theme.primary }]}>
              {formatAmount(request.amount)}
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
});
