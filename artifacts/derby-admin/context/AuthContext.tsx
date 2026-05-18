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
}

interface AuthContextValue extends AuthState {
  saveServerConfig: (config: ServerConfig) => Promise<void>;
  signIn: (credentials: AdminCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS = {
  SERVER_CONFIG: "@derby_server_config",
  ADMIN_NAME: "@derby_admin_name",
  USER_ID: "@derby_user_id",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isConnected: false,
    isLoading: true,
    serverConfig: null,
    adminName: null,
    userId: null,
    error: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [configStr, adminName, userIdStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SERVER_CONFIG),
          AsyncStorage.getItem(STORAGE_KEYS.ADMIN_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
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
      ]);
      setState((s) => ({
        ...s,
        isConnected: true,
        isLoading: false,
        adminName: res.adminName,
        userId: res.userId,
        error: null,
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

  const signOut = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_NAME),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
    ]);
    setState((s) => ({
      ...s,
      isConnected: false,
      adminName: null,
      userId: null,
      error: null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, saveServerConfig, signIn, signOut, clearError }}
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
