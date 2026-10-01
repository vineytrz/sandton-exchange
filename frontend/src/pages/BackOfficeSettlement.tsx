import { useCallback, useState } from "react";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, type Settlement } from "../lib/api";

export default function BackOfficeSettlement() {
  const { role } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchPending = useCallback(() => api.getPendingSettlements(), []);
  const { data: settlements, error: pollError, refresh } = usePolling<
    Settlement[]
  >(fetchPending, 3000);

  const handleBatch = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.batchSettlements();
      setMessage(`Created ${created.length} settlement batch(es) for T+3`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (id: number) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.confirmSettlement(id);
      setMessage(`Settlement #${result.id} confirmed — balances updated`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  const isOps = role === "ops";

  return (
    <div className="panel">
      <h2>Back Office Settlement</h2>
      {!isOps && (
        <div className="ops-only-banner">
          Switch to <strong>Ops</strong> role to batch and confirm settlements.
          You can view pending items below.
        </div>
      )}
      {isOps && (
        <div style={{ marginBottom: "1rem" }}>
          <button onClick={handleBatch} disabled={busy}>
            Run T+3 Settlement Batch
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {pollError && <p className="error">{pollError}</p>}
      {message && <p className="success">{message}</p>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Trade</th>
            <th>Ticker</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Settlement Date</th>
            <th>Status</th>
            {isOps && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {!settlements || settlements.length === 0 ? (
            <tr>
              <td colSpan={isOps ? 8 : 7}>No pending settlements</td>
            </tr>
          ) : (
            settlements.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.trade_id}</td>
                <td>{s.trade?.ticker ?? "—"}</td>
                <td>{s.trade?.qty ?? "—"}</td>
                <td>{s.trade ? s.trade.price.toFixed(2) : "—"}</td>
                <td>{new Date(s.settlement_date).toLocaleDateString()}</td>
                <td>
                  <span className="badge badge-pending">{s.status}</span>
                </td>
                {isOps && (
                  <td>
                    <button
                      onClick={() => handleConfirm(s.id)}
                      disabled={busy || s.status !== "PENDING"}
                    >
                      Confirm
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
