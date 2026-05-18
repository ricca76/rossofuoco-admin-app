import * as Haptics from "expo-haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AuthRequest,
  getPendingRequests,
  resolveRequest,
} from "@/services/derbyApi";
import { saveAuthHistoryItem } from "@/services/authHistory";
import { notifyNewAuthRequest } from "@/services/notifications";

interface RequestsState {
  requests: AuthRequest[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface RequestsContextValue extends RequestsState {
  fetchRequests: () => Promise<void>;
  refresh: () => Promise<void>;
  approve: (id: string, adminName?: string) => Promise<void>;
  deny: (id: string, adminName?: string) => Promise<void>;
  getRequest: (id: string) => AuthRequest | undefined;
}

const RequestsContext = createContext<RequestsContextValue | null>(null);

export function RequestsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RequestsState>({
    requests: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  const knownIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const detectAndNotify = useCallback(
    async (requests: AuthRequest[]) => {
      if (isFirstLoad.current) {
        for (const r of requests) knownIds.current.add(r.id);
        isFirstLoad.current = false;
        return;
      }

      const newOnes = requests.filter(
        (r) => r.status === "pending" && !knownIds.current.has(r.id)
      );

      for (const r of newOnes) {
        knownIds.current.add(r.id);
        try {
          await notifyNewAuthRequest(r.type, r.operatorName, r.description, r.id);
        } catch {
          // ignora errori notifiche
        }
      }
    },
    []
  );

  const fetchRequests = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const requests = await getPendingRequests();
      await detectAndNotify(requests);
      setState((s) => ({
        ...s,
        requests,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore caricamento";
      setState((s) => ({ ...s, isLoading: false, error: msg }));
    }
  }, [detectAndNotify]);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, isRefreshing: true, error: null }));
    try {
      const requests = await getPendingRequests();
      await detectAndNotify(requests);
      setState((s) => ({
        ...s,
        requests,
        isRefreshing: false,
        lastUpdated: new Date(),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore caricamento";
      setState((s) => ({ ...s, isRefreshing: false, error: msg }));
    }
  }, [detectAndNotify]);

  const approve = useCallback(async (id: string, adminName?: string) => {
    const req = state.requests.find((r) => r.id === id);
    await resolveRequest(id, true, adminName);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    knownIds.current.delete(id);
    if (req) {
      saveAuthHistoryItem(req, "approved", adminName ?? null).catch(() => {});
    }
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r.id !== id),
    }));
  }, [state.requests]);

  const deny = useCallback(async (id: string, adminName?: string) => {
    const req = state.requests.find((r) => r.id === id);
    await resolveRequest(id, false, adminName);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    knownIds.current.delete(id);
    if (req) {
      saveAuthHistoryItem(req, "denied", adminName ?? null).catch(() => {});
    }
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r.id !== id),
    }));
  }, [state.requests]);

  const getRequest = useCallback(
    (id: string) => state.requests.find((r) => r.id === id),
    [state.requests]
  );

  return (
    <RequestsContext.Provider
      value={{ ...state, fetchRequests, refresh, approve, deny, getRequest }}
    >
      {children}
    </RequestsContext.Provider>
  );
}

export function useRequests() {
  const ctx = useContext(RequestsContext);
  if (!ctx) throw new Error("useRequests must be used within RequestsProvider");
  return ctx;
}
