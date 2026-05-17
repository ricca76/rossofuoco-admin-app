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
  clearToken,
  configureApi,
  login,
  logout,
  setToken,
} from "@/services/derbyApi";

interface AuthState {
  isConnected: boolean;
  isLoading: boolean;
  serverConfig: ServerConfig | null;
  username: string | null;
  token: string | null;
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
  TOKEN: "@derby_token",
  USERNAME: "@derby_username",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isConnected: false,
    isLoading: true,
    serverConfig: null,
    username: null,
    token: null,
    error: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [configStr, token, username] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SERVER_CONFIG),
          AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USERNAME),
        ]);
        const serverConfig: ServerConfig | null = configStr
          ? JSON.parse(configStr)
          : null;
        if (serverConfig) configureApi(serverConfig);
        if (token) setToken(token);
        setState({
          isConnected: !!(token && serverConfig),
          isLoading: false,
          serverConfig,
          username,
          token,
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
      setToken(res.token);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token),
        AsyncStorage.setItem(STORAGE_KEYS.USERNAME, res.username),
      ]);
      setState((s) => ({
        ...s,
        isConnected: true,
        isLoading: false,
        token: res.token,
        username: res.username,
        error: null,
      }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Connessione fallita";
      clearToken();
      setState((s) => ({
        ...s,
        isLoading: false,
        isConnected: false,
        error: msg,
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USERNAME),
    ]);
    setState((s) => ({
      ...s,
      isConnected: false,
      token: null,
      username: null,
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
