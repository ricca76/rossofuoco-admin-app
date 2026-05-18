export interface ServerConfig {
  ip: string;
  port: number;
}

export interface AdminCredentials {
  pin: string;
}

export interface AuthRequest {
  id: string;
  type: string;
  operatorName: string;
  operatorId: number | null;
  ticketId: string;
  tableNum: string | null;
  description: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "denied";
  createdAt: number;
}

export interface LoginResponse {
  adminName: string;
  userId: number;
}

let _baseUrl = "";

export function configureApi(config: ServerConfig) {
  _baseUrl = `http://${config.ip}:${config.port}`;
}

export function getBaseUrl() {
  return _baseUrl;
}

function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get("content-type") ?? "";
  return ct.includes("application/json") || ct.includes("text/json");
}

function extractErrorMessage(text: string, status: number): string {
  if (!text) return `Errore HTTP ${status}`;
  try {
    const parsed = JSON.parse(text);
    return (
      parsed.message ??
      parsed.error ??
      parsed.msg ??
      parsed.description ??
      `Errore HTTP ${status}`
    );
  } catch {
    if (text.trim().startsWith("<")) {
      return `Il server ha risposto con HTML (HTTP ${status}). Verifica l'indirizzo e la porta.`;
    }
    return text.length > 120 ? text.slice(0, 120) + "…" : text;
  }
}

async function apiRequest<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
  timeoutMs: number = 10000
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${_baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.includes("timeout")) {
      throw new Error(
        "Timeout: il server non ha risposto in tempo. Verifica IP, porta e connessione Wi-Fi."
      );
    }
    if (
      msg.includes("Network request failed") ||
      msg.includes("fetch") ||
      msg.includes("ECONNREFUSED")
    ) {
      throw new Error(
        "Server non raggiungibile. Verifica IP, porta e connessione Wi-Fi."
      );
    }
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(extractErrorMessage(text, response.status));
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  if (!isJsonResponse(response)) {
    const text = await response.text().catch(() => "");
    if (text.trim().startsWith("<")) {
      throw new Error(
        "Il server ha risposto con HTML. Verifica che IP e porta siano corretti e che Rosso Fuoco Console sia in esecuzione."
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Risposta non valida dal server. Risposta: ${text.slice(0, 80)}`
      );
    }
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Errore nella lettura della risposta JSON dal server.");
  }
}

export async function login(
  credentials: AdminCredentials
): Promise<LoginResponse> {
  const res = await apiRequest<{ ok: boolean; userId: number; name: string }>(
    "/users/verify-admin-pin",
    "POST",
    { pin: credentials.pin }
  );
  if (!res.ok) {
    throw new Error("PIN non riconosciuto o utente non ha permessi admin.");
  }
  return {
    adminName: res.name,
    userId: res.userId,
  };
}

export async function getPendingRequests(): Promise<AuthRequest[]> {
  const result = await apiRequest<{ requests: AuthRequest[] }>(
    "/auth-requests"
  );
  return Array.isArray(result.requests) ? result.requests : [];
}

export async function resolveRequest(
  id: string,
  approved: boolean,
  adminName?: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/auth-requests/${id}/resolve`, "POST", {
    approved,
    adminName: adminName ?? null,
  });
}

export async function testConnection(config: ServerConfig): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`http://${config.ip}:${config.port}/healthz`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.status === 200;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export function subscribeToEvents(
  onEvent: (type: string, data: unknown) => void,
  onError?: () => void
): () => void {
  const url = `${_baseUrl}/events/stream`;
  let es: EventSource | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(e.type || "message", data);
      } catch {
        onEvent(e.type || "message", e.data);
      }
    };

    const eventTypes = [
      "auth_request_created",
      "auth_request_resolved",
      "order_changed",
    ];
    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          onEvent(type, JSON.parse(e.data));
        } catch {
          onEvent(type, e.data);
        }
      });
    }

    es.onerror = () => {
      es?.close();
      es = null;
      if (!closed) {
        onError?.();
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    es?.close();
    es = null;
  };
}
