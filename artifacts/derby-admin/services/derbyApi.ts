export interface ServerConfig {
  ip: string;
  port: number;
}

export interface AdminCredentials {
  username: string;
  password: string;
}

export interface AuthRequest {
  id: string;
  type: string;
  description: string;
  amount?: number;
  operator: string;
  table?: string;
  timestamp: string;
  status: "pending" | "approved" | "denied";
  details?: Record<string, string | number | boolean>;
}

export interface LoginResponse {
  token: string;
  username: string;
  serverInfo?: string;
}

let _baseUrl = "";
let _token = "";

export function configureApi(config: ServerConfig) {
  _baseUrl = `http://${config.ip}:${config.port}`;
}

export function setToken(token: string) {
  _token = token;
}

export function clearToken() {
  _token = "";
}

function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get("content-type") ?? "";
  return ct.includes("application/json") || ct.includes("text/json");
}

function extractErrorMessage(text: string, status: number): string {
  if (!text) return `Errore HTTP ${status}`;
  // Try to parse JSON error message
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
    // If it's HTML, return a generic message
    if (text.trim().startsWith("<")) {
      return `Il server ha risposto con una pagina HTML (HTTP ${status}). Verifica l'indirizzo e la porta.`;
    }
    // Plain text — truncate if too long
    return text.length > 120 ? text.slice(0, 120) + "…" : text;
  }
}

async function apiRequest<T>(
  path: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${_baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Network request failed") || msg.includes("fetch")) {
      throw new Error(
        "Server non raggiungibile. Verifica IP, porta e connessione Wi-Fi."
      );
    }
    throw new Error(msg);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(extractErrorMessage(text, response.status));
  }

  // No body for 204
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  if (!isJsonResponse(response)) {
    const text = await response.text().catch(() => "");
    if (text.trim().startsWith("<")) {
      throw new Error(
        "Il server ha risposto con una pagina HTML. Verifica che l'IP e la porta siano corretti e che Derby Server Connect sia in esecuzione."
      );
    }
    // Try parsing anyway — some servers omit content-type
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Risposta non valida dal server. Controlla gli endpoint API. Risposta: ${text.slice(0, 80)}`
      );
    }
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "Errore nella lettura della risposta JSON dal server."
    );
  }
}

export async function login(
  credentials: AdminCredentials
): Promise<LoginResponse> {
  const res = await apiRequest<Record<string, unknown>>(
    "/api/login",
    "POST",
    credentials
  );
  // Flexible parsing: support various field names
  const token =
    (res.token ?? res.access_token ?? res.accessToken ?? res.sessionToken ?? res.session_token ?? "") as string;
  const username =
    (res.username ?? res.user ?? res.name ?? credentials.username) as string;
  if (!token) {
    throw new Error(
      "Login riuscito ma nessun token ricevuto. Verifica il formato della risposta del server."
    );
  }
  return { token, username: String(username), serverInfo: res.serverInfo as string | undefined };
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/api/logout", "POST").catch(() => {});
  clearToken();
}

export async function getPendingRequests(): Promise<AuthRequest[]> {
  const result = await apiRequest<unknown>("/api/authorizations/pending");
  // Support both { requests: [] } and [] response shapes
  if (Array.isArray(result)) return result as AuthRequest[];
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    const list = obj.requests ?? obj.data ?? obj.items ?? obj.authorizations ?? [];
    return Array.isArray(list) ? (list as AuthRequest[]) : [];
  }
  return [];
}

export async function approveRequest(
  id: string,
  note?: string
): Promise<void> {
  await apiRequest<void>(`/api/authorizations/${id}/approve`, "POST", {
    note: note ?? "",
  });
}

export async function denyRequest(id: string, note?: string): Promise<void> {
  await apiRequest<void>(`/api/authorizations/${id}/deny`, "POST", {
    note: note ?? "",
  });
}

export async function testConnection(config: ServerConfig): Promise<boolean> {
  const endpoints = ["/api/ping", "/api/status", "/", "/api"];
  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`http://${config.ip}:${config.port}${ep}`, {
        method: "GET",
        headers: { Accept: "application/json, text/html, */*" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      // Any response (even 401/403) means the server is reachable
      if (response.status < 500) return true;
    } catch {
      // Try next endpoint
    }
  }
  return false;
}
