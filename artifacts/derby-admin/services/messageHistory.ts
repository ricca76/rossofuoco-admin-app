import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rosso_admin_message_history";
const MAX_ITEMS = 100;

export interface MessageHistoryItem {
  id: string;
  message: string;
  sentAt: number;
  sentBy: string | null;
  destinations: string[];
}

export async function loadMessageHistory(): Promise<MessageHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MessageHistoryItem[];
  } catch {
    return [];
  }
}

export async function saveMessageHistoryItem(item: Omit<MessageHistoryItem, "id">): Promise<void> {
  try {
    const existing = await loadMessageHistory();
    const entry: MessageHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    const updated = [entry, ...existing].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export async function clearMessageHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
