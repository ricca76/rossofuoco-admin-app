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

  const response = await fetch(`${_baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function login(
  credentials: AdminCredentials
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/login", "POST", credentials);
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/api/logout", "POST").catch(() => {});
  clearToken();
}

export async function getPendingRequests(): Promise<AuthRequest[]> {
  const result = await apiRequest<{ requests: AuthRequest[] }>(
    "/api/authorizations/pending"
  );
  return result.requests ?? [];
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
  try {
    const url = `http://${config.ip}:${config.port}/api/ping`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
}
