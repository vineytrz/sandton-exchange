import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Trade } from "../lib/api";

export default function TradeBlotter() {
  const [affirmFilter, setAffirmFilter] = useState<"ALL" | "PENDING" | "AFFIRMED">("ALL");

  const fetchTrades = useCallback(() => api.getTrades(), []);
  const { data: trades, error, loading } = usePolling<Trade[]>(fetchTrades, 3000);

  const filtered = useMemo(() => {
    if (!trades) return [];
    if (affirmFilter === "ALL") return trades;
    return trades.filter((t) =>
      affirmFilter === "AFFIRMED"
        ? t.affirmation_status === "AFFIRMED"
        : t.affirmation_status === "PENDING_AFFIRMATION"
    );
  }, [trades, affirmFilter]);

  const totalVolume = filtered.reduce((s, t) => s + t.qty, 0);
  const totalNotional = filtered.reduce((s, t) => s + t.qty * t.price, 0);
  const pendingCount =
    trades?.filter((t) => t.affirmation_status === "PENDING_AFFIRMATION").length ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Trade Blotter</h2>
          <p className="page-subtitle">Executed trades · affirmation status</p>
        </div>
        <Link to="/affirmation" className="btn">
          Affirmations ({pendingCount})
        </Link>
      </div>

      <div className="chip-row">
        {(["ALL", "PENDING", "AFFIRMED"] as const).map((f) => (
          <button
            key={f}
            className={`chip${affirmFilter === f ? " active" : ""}`}
            onClick={() => setAffirmFilter(f)}
          >
            {f === "PENDING" ? "Pending Affirmation" : f === "AFFIRMED" ? "Affirmed" : "All"}
          </button>
        ))}
      </div>

      {trades && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-value">{filtered.length}</span>
            <span className="stat-label">Trades</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{totalVolume.toLocaleString()}</span>
            <span className="stat-label">Total Volume</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{formatZAR(totalNotional)}</span>
            <span className="stat-label">Total Notional</span>
          </div>
        </div>
      )}

      {loading && !trades && <div className="panel">Loading trades…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticker</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Notional</th>
              <th>Buy #</th>
              <th>Sell #</th>
              <th>Affirmation</th>
              <th>Traded At</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  No trades — <Link to="/order-entry">place matching orders</Link>
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td className="mono">#{t.id}</td>
                  <td>
                    <span className="ticker-pill">{t.ticker ?? t.instrument_id}</span>
                  </td>
                  <td>{t.qty.toLocaleString()}</td>
                  <td>{formatZAR(t.price)}</td>
                  <td>{formatZAR(t.qty * t.price)}</td>
                  <td className="mono">#{t.buy_order_id}</td>
                  <td className="mono">#{t.sell_order_id}</td>
                  <td>
                    <span
                      className={`badge ${t.affirmation_status === "AFFIRMED" ? "badge-confirmed" : "badge-pending"}`}
                    >
                      {t.affirmation_status === "AFFIRMED" ? "AFFIRMED" : "PENDING"}
                    </span>
                  </td>
                  <td>{new Date(t.traded_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
