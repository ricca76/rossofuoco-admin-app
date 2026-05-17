import * as Haptics from "expo-haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  AuthRequest,
  approveRequest,
  denyRequest,
  getPendingRequests,
} from "@/services/derbyApi";

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
  approve: (id: string, note?: string) => Promise<void>;
  deny: (id: string, note?: string) => Promise<void>;
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

  const fetchRequests = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const requests = await getPendingRequests();
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
  }, []);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, isRefreshing: true, error: null }));
    try {
      const requests = await getPendingRequests();
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
  }, []);

  const approve = useCallback(async (id: string, note?: string) => {
    await approveRequest(id, note);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r.id !== id),
    }));
  }, []);

  const deny = useCallback(async (id: string, note?: string) => {
    await denyRequest(id, note);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r.id !== id),
    }));
  }, []);

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

