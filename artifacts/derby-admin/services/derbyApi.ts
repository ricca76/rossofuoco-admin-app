export interface ServerConfig {
  ip: string;
  port: number;
  /** Se impostato, sovrascrive http://ip:port — supporta https e domini esterni */
  baseUrl?: string;
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
  token?: string;
}

let _baseUrl = "";
let _adminToken: string | null = null;
let _adminUserId: number | null = null;

export function configureApi(config: ServerConfig) {
  if (config.baseUrl?.trim()) {
    _baseUrl = config.baseUrl.trim().replace(/\/$/, "");
  } else {
    _baseUrl = `http://${config.ip}:${config.port}`;
  }
}

export function getBaseUrl() {
  return _baseUrl;
}

export function setAdminToken(token: string | null) {
  _adminToken = token;
}

export function setAdminUserId(userId: number | null) {
  _adminUserId = userId;
}

export function clearAdminCredentials() {
  _adminToken = null;
  _adminUserId = null;
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
  if (_adminToken) {
    headers["Authorization"] = `Bearer ${_adminToken}`;
  }

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
  const res = await apiRequest<{ ok: boolean; userId: number; name: string; token?: string }>(
    "/users/verify-admin-pin",
    "POST",
    { pin: credentials.pin }
  );
  if (!res.ok) {
    throw new Error("PIN non riconosciuto o utente non ha permessi admin.");
  }
  if (res.token) {
    _adminToken = res.token;
  }
  _adminUserId = res.userId;
  return {
    adminName: res.name,
    userId: res.userId,
    token: res.token,
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
  const body: Record<string, unknown> = {
    approved,
    adminName: adminName ?? null,
  };
  if (_adminUserId !== null) {
    body.adminId = _adminUserId;
  }
  await apiRequest<{ ok: boolean }>(`/auth-requests/${id}/resolve`, "POST", body);
}

// ── Receipts ──────────────────────────────────────────────────────────────────

export interface DailyReceipt {
  id: string;
  shortId: string | null;
  tokenNo: string | null;
  tableNum: string | null;
  status: string;
  total: number;
  closingDate: string | null;
  server: string | null;
  cashAmount: number;
  cardAmount: number;
  gcAmount: number;
  voidedCount: number;
  voidedAmount: number;
}

export interface DailySummaryResponse {
  tickets: DailyReceipt[];
  totalRevenue: number;
  ticketCount: number;
}

// ── Full daily summary (for Riepilogo screen) ─────────────────────────────────

export interface DailySummaryOperator {
  firstName: string;
  lastName: string;
  receiptCount: number;
  total: number;
  cash: number;
  card: number;
  gc: number;
  stornoCount: number;
  stornoAmount: number;
  tickets: Array<{
    ticketId: string;
    shortId: string | null;
    tokenNo: string | null;
    tableNum: string | null;
    total: number;
    closingDate: string | null;
    cashAmount: number;
    cardAmount: number;
    gcAmount: number;
    voidedCount: number;
    voidedAmount: number;
  }>;
}

export interface DailySummaryTotals {
  receiptCount: number;
  total: number;
  cash: number;
  card: number;
  gc: number;
  stornoCount: number;
  stornoAmount: number;
}

export interface FullDailySummaryResponse {
  date: string;
  operators: DailySummaryOperator[];
  totals: DailySummaryTotals;
}

export async function getDailySummaryFull(date: string): Promise<FullDailySummaryResponse> {
  const res = await apiRequest<{
    date?: string;
    operators?: Array<Record<string, unknown>>;
    totals?: Record<string, unknown>;
  }>(`/reports/daily-summary?date=${date}`, "GET", undefined, 30000);

  const operators: DailySummaryOperator[] = (Array.isArray(res.operators) ? res.operators : []).map((op) => ({
    firstName: String(op.firstName ?? ""),
    lastName: String(op.lastName ?? ""),
    receiptCount: Number(op.receiptCount ?? 0),
    total: Number(op.total ?? 0),
    cash: Number(op.cash ?? 0),
    card: Number(op.card ?? 0),
    gc: Number(op.gc ?? 0),
    stornoCount: Number(op.stornoCount ?? 0),
    stornoAmount: Number(op.stornoAmount ?? 0),
    tickets: (Array.isArray(op.tickets) ? op.tickets : []).map((t: Record<string, unknown>) => ({
      ticketId: String(t.ticketId ?? ""),
      shortId: t.shortId != null && String(t.shortId) !== "" ? String(t.shortId) : null,
      tokenNo: t.tokenNo != null && String(t.tokenNo) !== "" ? String(t.tokenNo) : null,
      tableNum: t.tableNum != null && String(t.tableNum) !== "" ? String(t.tableNum) : null,
      total: Number(t.total ?? 0),
      closingDate: t.closingDate != null ? String(t.closingDate) : null,
      cashAmount: Number(t.cashAmount ?? 0),
      cardAmount: Number(t.cardAmount ?? 0),
      gcAmount: Number(t.gcAmount ?? 0),
      voidedCount: Number(t.voidedCount ?? 0),
      voidedAmount: Number(t.voidedAmount ?? 0),
    })),
  }));

  const rt = res.totals ?? {};
  const totals: DailySummaryTotals = {
    receiptCount: Number(rt.receiptCount ?? 0),
    total: Number(rt.total ?? 0),
    cash: Number(rt.cash ?? 0),
    card: Number(rt.card ?? 0),
    gc: Number(rt.gc ?? 0),
    stornoCount: Number(rt.stornoCount ?? 0),
    stornoAmount: Number(rt.stornoAmount ?? 0),
  };

  return { date: res.date ?? date, operators, totals };
}

export async function getDailyReceipts(
  date?: string
): Promise<DailySummaryResponse> {
  const dateStr = date ?? new Date().toISOString().slice(0, 10);

  // Real response shape: { operators: [{ firstName, lastName, tickets: [{ticketId, ...}] }], totals }
  const res = await apiRequest<{
    operators?: Array<{
      firstName?: string;
      lastName?: string;
      tickets?: Array<Record<string, unknown>>;
    }>;
    totals?: { total?: number; receiptCount?: number };
  }>(`/reports/daily-summary?date=${dateStr}`);

  const operators = Array.isArray(res.operators) ? res.operators : [];
  const tickets: DailyReceipt[] = [];

  let globalIdx = 0;
  for (const op of operators) {
    const serverName =
      [op.firstName, op.lastName].filter(Boolean).join(" ").trim() || null;
    for (const r of Array.isArray(op.tickets) ? op.tickets : []) {
      const rawId = String(r.ticketId ?? r.id ?? "");
      tickets.push({
        id: rawId || `ticket-${globalIdx++}`,
        shortId: r.shortId != null && String(r.shortId) !== "" ? String(r.shortId) : null,
        tokenNo: r.tokenNo != null && String(r.tokenNo) !== "" ? String(r.tokenNo) : null,
        tableNum: r.tableNum != null && String(r.tableNum) !== "" ? String(r.tableNum) : null,
        status: String(r.status ?? "closed"),
        total: Number(r.total ?? r.totalPrice ?? 0),
        closingDate: r.closingDate != null ? String(r.closingDate) : null,
        server: serverName,
        cashAmount: Number(r.cashAmount ?? 0),
        cardAmount: Number(r.cardAmount ?? 0),
        gcAmount: Number(r.gcAmount ?? 0),
        voidedCount: Number(r.voidedCount ?? 0),
        voidedAmount: Number(r.voidedAmount ?? 0),
      });
    }
  }

  // Sort by closingDate desc (server already sorts DESC but we flatten operators)
  tickets.sort((a, b) => {
    if (!a.closingDate && !b.closingDate) return 0;
    if (!a.closingDate) return 1;
    if (!b.closingDate) return -1;
    return b.closingDate.localeCompare(a.closingDate);
  });

  const totalRevenue = Number(res.totals?.total ?? 0);

  return {
    tickets,
    totalRevenue,
    ticketCount: res.totals?.receiptCount ?? tickets.length,
  };
}

export interface TicketItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  voided: boolean;
  notes: string | null;
  courseName: string | null;
  isSeparator: boolean;
}

export interface TicketDetail {
  id: string;
  shortId: string | null;
  tokenNo: string | null;
  tableNum: string | null;
  status: string;
  total: number;
  paid: number;
  guests: number | null;
  createDate: string | null;
  server: string | null;
  items: TicketItem[];
  ticketNote: string | null;
  isAsporto: boolean;
}

export async function getTicketDetail(id: string): Promise<TicketDetail> {
  const res = await apiRequest<{
    ticket: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
    ticketNote?: string | null;
    isAsporto?: boolean;
  }>(`/pos/ticket/${encodeURIComponent(id)}`);

  const t = res.ticket ?? {};
  const rawItems = Array.isArray(res.items) ? res.items : [];

  const items: TicketItem[] = rawItems.map((i) => ({
    id: String(i.id ?? i.itemId ?? ""),
    name: String(i.name ?? ""),
    quantity: Number(i.quantity ?? 1),
    unitPrice: Number(i.unitPrice ?? i.unit_price ?? 0),
    total: Number(i.total ?? i.totalPrice ?? 0),
    voided: i.voided === true || i.isVoided === "Y",
    notes: i.notes != null ? String(i.notes) : null,
    courseName: i.courseName != null ? String(i.courseName) : null,
    isSeparator: Boolean(i.isSeparator),
  }));

  return {
    id: String(t.id ?? ""),
    shortId: t.shortId != null ? String(t.shortId) : null,
    tokenNo: t.tokenNo != null ? String(t.tokenNo) : null,
    tableNum: t.tableNum != null ? String(t.tableNum) : null,
    status: String(t.status ?? ""),
    total: Number(t.total ?? 0),
    paid: Number(t.paid ?? 0),
    guests: t.guests != null ? Number(t.guests) : null,
    createDate: t.createDate != null ? String(t.createDate) : null,
    server: t.server != null ? String(t.server) : null,
    items,
    ticketNote: res.ticketNote ?? null,
    isAsporto: Boolean(res.isAsporto),
  };
}

export async function reprintTicket(
  id: string,
  pgId?: string
): Promise<void> {
  await apiRequest<{ ok?: boolean }>(
    `/pos/ticket/${encodeURIComponent(id)}/print`,
    "POST",
    pgId ? { pgId } : {}
  );
}

// ── Printer messages ──────────────────────────────────────────────────────────

export interface PrinterGroup {
  pgId: string;
  pgName: string;
}

export interface PrinterDevice {
  ip: string;
  port: number;
}

export interface PrinterGroupConfig extends PrinterGroup {
  printers: PrinterDevice[];
}

export interface PrinterConfig {
  groups: PrinterGroupConfig[];
}

export async function getPrinterGroups(): Promise<PrinterGroup[]> {
  const res = await apiRequest<{ groups: PrinterGroup[] }>("/pos/printer-groups");
  return Array.isArray(res.groups) ? res.groups : [];
}

export async function getPrinterConfig(): Promise<PrinterConfig> {
  const res = await apiRequest<PrinterConfig>("/pos/printers-config");
  return { groups: Array.isArray(res.groups) ? res.groups : [] };
}

export interface FiscalReceiptPayload {
  shortId: string | null;
  tokenNo: string | null;
  closingDate: string | null;
  tableNum: string | null;
  guests: number | null;
  waiter: string | null;
  total: number;
  paid: number;
  items: Array<{ name: string; qty: number; totalPrice: number }>;
}

export async function printFiscalReceiptToPrinter(
  ip: string,
  port: number,
  receipt: FiscalReceiptPayload
): Promise<void> {
  await apiRequest<{ ok: boolean }>("/printers/print-receipt", "POST", {
    ip,
    port,
    receipt,
  });
}

export async function sendPrinterMessage(
  message: string,
  pgIds?: string[],
  fromNm?: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>("/pos/print-message", "POST", {
    message,
    pgIds: pgIds && pgIds.length > 0 ? pgIds : undefined,
    fromNm: fromNm ?? undefined,
  });
}

// ── Connection test ───────────────────────────────────────────────────────────

export async function testConnection(config: ServerConfig): Promise<boolean> {
  const base = config.baseUrl?.trim()
    ? config.baseUrl.trim().replace(/\/$/, "")
    : `http://${config.ip}:${config.port}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${base}/api/healthz`, {
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
