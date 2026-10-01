import { useCallback, useState } from "react";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Trade } from "../lib/api";

export default function TradeAffirmation() {
  const { role } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetch = useCallback(() => api.getPendingAffirmations(), []);
  const { data: trades, error: pollError, refresh } = usePolling<Trade[]>(
    fetch,
    3000
  );

  const handleAffirm = async (id: number) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.affirmTrade(id);
      setMessage(`Trade #${id} affirmed — eligible for T+3 settlement batch`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Affirmation failed");
    } finally {
      setBusy(false);
    }
  };

  const isOps = role === "ops";

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Trade Affirmation</h2>
          <p className="page-subtitle">
            Manual T+0 back-office confirmation before settlement
          </p>
        </div>
      </div>

      {!isOps && (
        <div className="banner banner-warn">
          View-only in Trader mode. Switch to <strong>Ops</strong> to affirm
          trades.
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}
      {pollError && <div className="banner banner-error">{pollError}</div>}
      {message && <div className="banner banner-success">{message}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trade ID</th>
              <th>Ticker</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Notional</th>
              <th>Traded At</th>
              <th>Status</th>
              {isOps && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {!trades?.length ? (
              <tr>
                <td colSpan={isOps ? 8 : 7} className="empty-row">
                  No trades awaiting affirmation
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td>
                    <span className="ticker-pill">{t.ticker}</span>
                  </td>
                  <td>{t.qty.toLocaleString()}</td>
                  <td>{formatZAR(t.price)}</td>
                  <td>{formatZAR(t.qty * t.price)}</td>
                  <td>{new Date(t.traded_at).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-pending">PENDING</span>
                  </td>
                  {isOps && (
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAffirm(t.id)}
                        disabled={busy}
                      >
                        Affirm
                      </button>
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
