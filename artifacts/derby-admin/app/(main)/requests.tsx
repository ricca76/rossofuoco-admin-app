import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
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
import { RequestCard } from "@/components/RequestCard";
import colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useRequests } from "@/context/RequestsContext";
import { AuthRequest, subscribeToEvents } from "@/services/derbyApi";

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? colors.dark : colors.light;
  const { adminName, signOut } = useAuth();
  const { requests, isLoading, isRefreshing, error, lastUpdated, fetchRequests, refresh } = useRequests();

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((type) => {
      if (type === "auth_request_created" || type === "auth_request_resolved") {
        fetchRequests();
      }
    });
    return unsubscribe;
  }, [fetchRequests]);

  const handlePress = useCallback((item: AuthRequest) => {
    Haptics.selectionAsync();
    router.push({ pathname: "/(main)/request/[id]", params: { id: item.id } });
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/");
  }, [signOut]);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const ListHeader = (
    <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: theme.background }]}>
      <View style={styles.headerTop}>
        <View>
          <Text style={[styles.greeting, { color: theme.mutedForeground }]}>
            Admin
          </Text>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>
            Autorizzazioni
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push("/(main)/settings")}
          >
            <Feather name="settings" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={18} color={theme.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.statsRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {requests.length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>
            In attesa
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.foreground }]} numberOfLines={1}>
            {adminName ?? "Admin"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>
            Operatore
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.foreground }]}>
            {lastUpdated
              ? lastUpdated.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
              : "--:--"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>
            Aggiornato
          </Text>
        </View>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.destructive + "15", borderColor: theme.destructive + "30" }]}>
          <Feather name="wifi-off" size={14} color={theme.destructive} />
          <Text style={[styles.errorText, { color: theme.destructive }]}>{error}</Text>
          <TouchableOpacity onPress={fetchRequests}>
            <Text style={[styles.retryText, { color: theme.primary }]}>Riprova</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
        {requests.length > 0 ? `${requests.length} RICHIESTA${requests.length !== 1 ? "E" : ""} IN ATTESA` : "RICHIESTE"}
      </Text>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator color={theme.primary} size="large" />
      ) : (
        <>
          <View style={[styles.emptyIcon, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="check-circle" size={32} color={theme.success} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
            Nessuna richiesta
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.mutedForeground }]}>
            Non ci sono autorizzazioni in attesa
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <FlatList<AuthRequest>
        style={{ flex: 1 }}
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard request={item} onPress={() => handlePress(item)} />
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
            onRefresh={refresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        scrollEnabled={!isLoading || requests.length > 0}
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  statDivider: {
    width: 1,
    marginHorizontal: 8,
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
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 4,
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
  },
});
