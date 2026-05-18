export interface ServerConfig {
  ip: string;
  port: number;
}

export interface AdminCredentials {
  pin: string;
}

export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  active: boolean;
  isAdmin: boolean;
  hasPinSet: boolean;
  visibleInLogin: boolean;
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
      return `Il server ha risposto con HTML (HTTP ${status}). Verifica IP e porta.`;
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
    response = await fetch(`${_baseUrl}/api${path}`, {
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
        "Timeout: il server non ha risposto in tempo. Verifica IP, porta e Wi-Fi."
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

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await apiRequest<{ users: AdminUser[] }>("/users");
  const all = Array.isArray(res.users) ? res.users : [];
  return all.filter((u) => u.isAdmin && u.active && u.hasPinSet);
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
  const result = await apiRequest<{ requests: AuthRequest[] }>("/auth-requests");
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
    const response = await fetch(
      `http://${config.ip}:${config.port}/api/healthz`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );
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
  const url = `${_baseUrl}/api/events/stream`;
  let closed = false;
  let xhr: XMLHttpRequest | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastIndex = 0;

  function parseEvents(chunk: string) {
    const lines = chunk.split("\n");
    let eventType = "message";
    let dataBuffer = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataBuffer += line.slice(5).trim();
      } else if (line === "") {
        if (dataBuffer) {
          try {
            onEvent(eventType, JSON.parse(dataBuffer));
          } catch {
            onEvent(eventType, dataBuffer);
          }
          eventType = "message";
          dataBuffer = "";
        }
      }
    }
  }

  function connect() {
    if (closed) return;
    lastIndex = 0;
    xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Cache-Control", "no-cache");

    xhr.onreadystatechange = () => {
      if (closed) return;
      if (xhr && xhr.readyState >= 3 && xhr.responseText) {
        const newText = xhr.responseText.slice(lastIndex);
        lastIndex = xhr.responseText.length;
        if (newText) parseEvents(newText);
      }
      if (xhr && xhr.readyState === 4) {
        xhr = null;
        if (!closed) {
          onError?.();
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    };

    xhr.onerror = () => {
      xhr = null;
      if (!closed) {
        onError?.();
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    xhr.send();
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (xhr) {
      xhr.abort();
      xhr = null;
    }
  };
}
