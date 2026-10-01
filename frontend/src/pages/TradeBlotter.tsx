import { useCallback } from "react";
import { usePolling } from "../hooks/usePolling";
import { api, type Trade } from "../lib/api";

export default function TradeBlotter() {
  const fetchTrades = useCallback(() => api.getTrades(), []);
  const { data: trades, error, loading } = usePolling<Trade[]>(fetchTrades, 3000);

  return (
    <div className="panel">
      <h2>Trade Blotter</h2>
      {loading && !trades && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {trades && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticker</th>
              <th>Qty</th>
              <th>Price (ZAR)</th>
              <th>Buy Order</th>
              <th>Sell Order</th>
              <th>Traded At</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7}>No trades yet</td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.ticker ?? t.instrument_id}</td>
                  <td>{t.qty}</td>
                  <td>{t.price.toFixed(2)}</td>
                  <td>{t.buy_order_id}</td>
                  <td>{t.sell_order_id}</td>
                  <td>{new Date(t.traded_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
