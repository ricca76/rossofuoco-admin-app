import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthRequest } from "./derbyApi";

const STORAGE_KEY = "rosso_admin_auth_history";
const MAX_ITEMS = 200;

export interface AuthHistoryItem extends AuthRequest {
  resolvedAt: number;
  resolvedBy: string | null;
  resolution: "approved" | "denied";
}

export async function loadAuthHistory(): Promise<AuthHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuthHistoryItem[];
  } catch {
    return [];
  }
}

export async function saveAuthHistoryItem(
  request: AuthRequest,
  resolution: "approved" | "denied",
  resolvedBy: string | null
): Promise<void> {
  try {
    const existing = await loadAuthHistory();
    const item: AuthHistoryItem = {
      ...request,
      resolvedAt: Date.now(),
      resolvedBy,
      resolution,
      status: resolution,
    };
    const updated = [item, ...existing].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export async function clearAuthHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
