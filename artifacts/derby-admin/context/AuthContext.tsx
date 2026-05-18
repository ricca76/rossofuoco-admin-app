import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AdminCredentials,
  ServerConfig,
  configureApi,
  login,
} from "@/services/derbyApi";

interface AuthState {
  isConnected: boolean;
  isLoading: boolean;
  serverConfig: ServerConfig | null;
  adminName: string | null;
  userId: number | null;
  error: string | null;
  hasSavedCredentials: boolean;
}

interface AuthContextValue extends AuthState {
  saveServerConfig: (config: ServerConfig) => Promise<void>;
  signIn: (credentials: AdminCredentials) => Promise<void>;
  signInWithStoredPin: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS = {
  SERVER_CONFIG: "@derby_server_config",
  ADMIN_NAME: "@derby_admin_name",
  USER_ID: "@derby_user_id",
  ADMIN_PIN: "@derby_admin_pin",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isConnected: false,
    isLoading: true,
    serverConfig: null,
    adminName: null,
    userId: null,
    error: null,
    hasSavedCredentials: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const [configStr, adminName, userIdStr, savedPin] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SERVER_CONFIG),
          AsyncStorage.getItem(STORAGE_KEYS.ADMIN_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
          AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN),
        ]);
        const serverConfig: ServerConfig | null = configStr
          ? JSON.parse(configStr)
          : null;
        if (serverConfig) configureApi(serverConfig);
        setState({
          isConnected: !!(adminName && serverConfig),
          isLoading: false,
          serverConfig,
          adminName,
          userId: userIdStr ? Number(userIdStr) : null,
          error: null,
          hasSavedCredentials: !!(adminName && serverConfig && savedPin),
        });
      } catch {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const saveServerConfig = useCallback(async (config: ServerConfig) => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SERVER_CONFIG,
      JSON.stringify(config)
    );
    configureApi(config);
    setState((s) => ({ ...s, serverConfig: config }));
  }, []);

  const signIn = useCallback(async (credentials: AdminCredentials) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await login(credentials);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ADMIN_NAME, res.adminName),
        AsyncStorage.setItem(STORAGE_KEYS.USER_ID, String(res.userId)),
        AsyncStorage.setItem(STORAGE_KEYS.ADMIN_PIN, credentials.pin),
      ]);
      setState((s) => ({
        ...s,
        isConnected: true,
        isLoading: false,
        adminName: res.adminName,
        userId: res.userId,
        error: null,
        hasSavedCredentials: true,
      }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Connessione fallita";
      setState((s) => ({
        ...s,
        isLoading: false,
        isConnected: false,
        error: msg,
      }));
    }
  }, []);

  const signInWithStoredPin = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const savedPin = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN);
      if (!savedPin) {
        throw new Error("Nessun PIN salvato. Accedi manualmente.");
      }
      const res = await login({ pin: savedPin });
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ADMIN_NAME, res.adminName),
        AsyncStorage.setItem(STORAGE_KEYS.USER_ID, String(res.userId)),
      ]);
      setState((s) => ({
        ...s,
        isConnected: true,
        isLoading: false,
        adminName: res.adminName,
        userId: res.userId,
        error: null,
        hasSavedCredentials: true,
      }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Accesso automatico fallito";
      setState((s) => ({
        ...s,
        isLoading: false,
        isConnected: false,
        error: msg,
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_NAME),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
      AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_PIN),
    ]);
    setState((s) => ({
      ...s,
      isConnected: false,
      adminName: null,
      userId: null,
      error: null,
      hasSavedCredentials: false,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        saveServerConfig,
        signIn,
        signInWithStoredPin,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
