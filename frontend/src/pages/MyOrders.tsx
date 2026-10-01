import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Order, type OrderStatus } from "../lib/api";

const STATUSES: (OrderStatus | "ALL")[] = [
  "ALL",
  "OPEN",
  "PARTIAL",
  "FILLED",
  "PENDING",
  "CANCELLED",
  "REJECTED",
];

export default function MyOrders() {
  const { role } = useRole();
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [accountFilter, setAccountFilter] = useState<number | "ALL">("ALL");
  const [message, setMessage] = useState<string | null>(null);

  const fetch = useCallback(() => api.getOrders(), []);
  const { data: orders, refresh } = usePolling<Order[]>(fetch, 3000);

  const accounts = useMemo(() => {
    if (!orders) return [];
    const ids = new Map<number, string>();
    orders.forEach((o) => {
      if (!ids.has(o.account_id)) ids.set(o.account_id, `Account #${o.account_id}`);
    });
    return [...ids.entries()];
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (filter !== "ALL" && o.status !== filter) return false;
      if (accountFilter !== "ALL" && o.account_id !== accountFilter) return false;
      return true;
    });
  }, [orders, filter, accountFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders?.forEach((o) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    return counts;
  }, [orders]);

  const handleCancel = async (id: number) => {
    try {
      await api.cancelOrder(id);
      setMessage(`Order #${id} cancelled`);
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Orders</h2>
          <p className="page-subtitle">
            Track, filter, and cancel open orders
          </p>
        </div>
        <Link to="/order-entry" className="btn btn-primary">
          + New Order
        </Link>
      </div>

      {message && <div className="banner banner-success">{message}</div>}

      <div className="chip-row">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`chip${filter === s ? " active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
            {s !== "ALL" && statusCounts[s] != null && (
              <span className="chip-count">{statusCounts[s]}</span>
            )}
            {s === "ALL" && orders && (
              <span className="chip-count">{orders.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="inline-label">
          Account
          <select
            value={accountFilter}
            onChange={(e) =>
              setAccountFilter(
                e.target.value === "ALL" ? "ALL" : Number(e.target.value)
              )
            }
          >
            <option value="ALL">All accounts</option>
            {accounts.map(([id]) => (
              <option key={id} value={id}>
                Account #{id}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-meta">{filtered.length} orders shown</span>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticker</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Filled</th>
              <th>Price</th>
              <th>Status</th>
              <th>Account</th>
              <th>Created</th>
              {role === "trader" && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr>
                <td colSpan={role === "trader" ? 10 : 9} className="empty-row">
                  No orders match filters —{" "}
                  <Link to="/order-entry">place your first order</Link>
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id}>
                  <td className="mono">#{o.id}</td>
                  <td>
                    <span className="ticker-pill">{o.ticker ?? o.instrument_id}</span>
                  </td>
                  <td>
                    <span className={`side-badge side-${o.side.toLowerCase()}`}>
                      {o.side}
                    </span>
                  </td>
                  <td>{o.qty.toLocaleString()}</td>
                  <td>{o.filled_qty.toLocaleString()}</td>
                  <td>{formatZAR(o.price)}</td>
                  <td>
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td>#{o.account_id}</td>
                  <td>{new Date(o.created_at).toLocaleString()}</td>
                  {role === "trader" && (
                    <td>
                      {["OPEN", "PARTIAL", "VALIDATED"].includes(o.status) ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleCancel(o.id)}
                        >
                          Cancel
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
