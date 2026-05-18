import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

const TYPE_LABELS: Record<string, string> = {
  void_item: "Annullamento articolo",
  void_ticket: "Annullamento conto",
  discount: "Sconto",
  refund: "Rimborso",
  override: "Override",
  price_change: "Modifica prezzo",
  payment: "Pagamento",
  reopen: "Riapertura conto",
  delete: "Eliminazione",
  access: "Accesso",
};

export async function notifyNewAuthRequest(
  type: string,
  operatorName: string,
  description: string,
  requestId?: string
): Promise<void> {
  if (Platform.OS === "web") return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const label = TYPE_LABELS[type] ?? type;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Nuova richiesta: ${label}`,
      body: `${operatorName} — ${description}`,
      sound: true,
      badge: 1,
      data: { type, operatorName, requestId: requestId ?? null },
    },
    trigger: null,
  });
}

export async function clearNotificationBadge(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.setBadgeCountAsync(0);
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
