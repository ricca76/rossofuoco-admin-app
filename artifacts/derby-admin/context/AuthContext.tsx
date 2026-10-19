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
  clearAdminCredentials,
  configureApi,
  login,
  setAdminApprovalToken,
  setAdminUserId,
} from "@/services/derbyApi";

interface AuthState {
  isConnected: boolean;
  isLoading: boolean;
  serverConfig: ServerConfig | null;
  adminName: string | null;
  userId: number | null;
  error: string | null;
  hasSavedCredentials: boolean;
  /** PIN di autorizzazione (separato dal PIN di accesso) */
  authPin: string | null;
}

interface AuthContextValue extends AuthState {
  saveServerConfig: (config: ServerConfig) => Promise<void>;
  signIn: (credentials: AdminCredentials) => Promise<void>;
  signInWithStoredPin: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  /** Aggiorna solo il PIN di autorizzazione senza ri-effettuare il login */
  saveAuthPin: (pin: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS = {
  SERVER_CONFIG: "@derby_server_config",
  ADMIN_NAME: "@derby_admin_name",
  USER_ID: "@derby_user_id",
  /** PIN di accesso (login) */
  ADMIN_PIN: "@derby_admin_pin",
  /** PIN di autorizzazione (approvazione richieste) */
  ADMIN_AUTH_PIN: "@derby_admin_auth_pin",
  ADMIN_TOKEN: "@derby_admin_token",
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
    authPin: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [configStr, adminName, userIdStr, savedPin, savedAuthPin, savedToken] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.SERVER_CONFIG),
            AsyncStorage.getItem(STORAGE_KEYS.ADMIN_NAME),
            AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
            AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN),
            AsyncStorage.getItem(STORAGE_KEYS.ADMIN_AUTH_PIN),
            AsyncStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN),
          ]);
        const serverConfig: ServerConfig | null = configStr
          ? JSON.parse(configStr)
          : null;
        if (serverConfig) configureApi(serverConfig);
        // Il token di approvazione ha TTL breve lato POS: ripristinarlo è
        // innocuo (scadrà presto) — l'autenticazione reale è via x-op-id.
        if (savedToken) setAdminApprovalToken(savedToken);
        const userId = userIdStr ? Number(userIdStr) : null;
        if (userId !== null) setAdminUserId(userId);
        setState({
          isConnected: !!(adminName && serverConfig),
          isLoading: false,
          serverConfig,
          adminName,
          userId,
          error: null,
          hasSavedCredentials: !!(adminName && serverConfig && savedPin),
          authPin: savedAuthPin,
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
      const saves: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEYS.ADMIN_NAME, res.adminName),
        AsyncStorage.setItem(STORAGE_KEYS.USER_ID, String(res.userId)),
        AsyncStorage.setItem(STORAGE_KEYS.ADMIN_PIN, credentials.pin),
      ];
      // Salva il PIN di autorizzazione se fornito; altrimenti usa il PIN di accesso come fallback
      const authPinToSave = credentials.authPin ?? credentials.pin;
      saves.push(AsyncStorage.setItem(STORAGE_KEYS.ADMIN_AUTH_PIN, authPinToSave));
      if (res.token) {
        saves.push(AsyncStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, res.token));
      }
      await Promise.all(saves);
      setAdminUserId(res.userId);
      if (res.token) setAdminApprovalToken(res.token);
      setState((s) => ({
        ...s,
        isConnected: true,
        isLoading: false,
        adminName: res.adminName,
        userId: res.userId,
        error: null,
        hasSavedCredentials: true,
        authPin: authPinToSave,
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
      const [savedPin, savedAuthPin] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN),
        AsyncStorage.getItem(STORAGE_KEYS.ADMIN_AUTH_PIN),
      ]);
      if (!savedPin) {
        throw new Error("Nessun PIN salvato. Accedi manualmente.");
      }
      const res = await login({ pin: savedPin, authPin: savedAuthPin ?? undefined });
      const saves: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEYS.ADMIN_NAME, res.adminName),
        AsyncStorage.setItem(STORAGE_KEYS.USER_ID, String(res.userId)),
      ];
      if (res.token) {
        saves.push(AsyncStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, res.token));
      }
      await Promise.all(saves);
      setAdminUserId(res.userId);
      if (res.token) setAdminApprovalToken(res.token);
      setState((s) => ({
        ...s,
        isConnected: true,
        isLoading: false,
        adminName: res.adminName,
        userId: res.userId,
        error: null,
        hasSavedCredentials: true,
        authPin: savedAuthPin,
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
      AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH_PIN),
      AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN),
    ]);
    clearAdminCredentials();
    setState((s) => ({
      ...s,
      isConnected: false,
      adminName: null,
      userId: null,
      error: null,
      hasSavedCredentials: false,
      authPin: null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const saveAuthPin = useCallback(async (pin: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_AUTH_PIN, pin);
    setState((s) => ({ ...s, authPin: pin }));
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
        saveAuthPin,
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
