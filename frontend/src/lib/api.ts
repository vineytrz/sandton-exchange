const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type OrderSide = "BUY" | "SELL";
export type OrderStatus =
  | "PENDING"
  | "VALIDATED"
  | "OPEN"
  | "PARTIAL"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED";
export type AffirmationStatus = "PENDING_AFFIRMATION" | "AFFIRMED";

export interface Account {
  id: number;
  name: string;
  role_hint: string;
  cash_balance: number;
  created_at: string;
}

export interface Instrument {
  id: number;
  ticker: string;
  name: string;
  last_price: number;
  currency: string;
}

export interface Order {
  id: number;
  account_id: number;
  instrument_id: number;
  side: OrderSide;
  qty: number;
  filled_qty: number;
  price: number;
  status: OrderStatus;
  created_at: string;
  ticker?: string;
}

export interface Trade {
  id: number;
  buy_order_id: number;
  sell_order_id: number;
  instrument_id: number;
  qty: number;
  price: number;
  traded_at: string;
  affirmation_status: AffirmationStatus;
  affirmed_by: string | null;
  affirmed_at: string | null;
  ticker?: string;
}

export interface OrderBookLevel {
  price: number;
  qty: number;
  order_count: number;
}

export interface OrderBook {
  instrument_id: number;
  ticker: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface Position {
  instrument_id: number;
  ticker: string;
  qty: number;
  avg_price: number;
}

export interface Portfolio {
  account_id: number;
  account_name: string;
  cash_balance: number;
  positions: Position[];
}

export interface Settlement {
  id: number;
  trade_id: number;
  settlement_date: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  confirmed_by: string | null;
  confirmed_at: string | null;
  trade?: Trade;
}

export interface AuditEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  actor: string;
  payload_json: string;
  created_at: string;
}

export interface OpsDashboard {
  market_open: boolean;
  open_orders: number;
  pending_affirmations: number;
  pending_settlements: number;
  todays_trades: number;
  confirmed_settlements: number;
  audit_events_today: number;
}

export interface OrderCreate {
  account_id: number;
  instrument_id: number;
  side: OrderSide;
  qty: number;
  price: number;
}

let currentRole: "trader" | "ops" = "trader";

export function setApiRole(role: "trader" | "ops") {
  currentRole = role;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Actor-Role": currentRole,
    ...(options.headers as Record<string, string>),
  };

  const resp = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

export const api = {
  getAccounts: () => request<Account[]>("/api/v1/accounts"),
  getInstruments: () => request<Instrument[]>("/api/v1/instruments"),
  getOrders: () => request<Order[]>("/api/v1/orders"),
  getOrder: (id: number) => request<Order>(`/api/v1/orders/${id}`),
  getOrderBook: (instrumentId: number) =>
    request<OrderBook>(`/api/v1/orders/book/${instrumentId}`),
  createOrder: (data: OrderCreate) =>
    request<Order>("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelOrder: (id: number) =>
    request<Order>(`/api/v1/orders/${id}/cancel`, { method: "POST" }),
  getTrades: () => request<Trade[]>("/api/v1/trades"),
  getPendingAffirmations: () =>
    request<Trade[]>("/api/v1/trades/pending-affirmation"),
  affirmTrade: (id: number) =>
    request<Trade>(`/api/v1/trades/${id}/affirm`, { method: "POST" }),
  getPortfolio: (accountId: number) =>
    request<Portfolio>(`/api/v1/accounts/${accountId}/portfolio`),
  getPendingSettlements: () =>
    request<Settlement[]>("/api/v1/settlement/pending"),
  batchSettlements: () =>
    request<Settlement[]>("/api/v1/settlement/batch", { method: "POST" }),
  confirmSettlement: (id: number) =>
    request<Settlement>(`/api/v1/settlement/${id}/confirm`, {
      method: "POST",
    }),
  confirmSettlementsBulk: (settlementIds: number[]) =>
    request<Settlement[]>("/api/v1/settlement/confirm-bulk", {
      method: "POST",
      body: JSON.stringify({ settlement_ids: settlementIds }),
    }),
  getAuditEvents: (params?: {
    entity_type?: string;
    entity_id?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.entity_type) q.set("entity_type", params.entity_type);
    if (params?.entity_id != null)
      q.set("entity_id", String(params.entity_id));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<AuditEvent[]>(`/api/v1/audit${qs ? `?${qs}` : ""}`);
  },
  getOpsDashboard: () => request<OpsDashboard>("/api/v1/ops/dashboard"),
};

export function formatZAR(amount: number): string {
  return `R\u00a0${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
