import { useCallback, useState } from "react";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Settlement } from "../lib/api";

export default function BackOfficeSettlement() {
  const { role } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fetchPending = useCallback(() => api.getPendingSettlements(), []);
  const { data: settlements, error: pollError, refresh } = usePolling<
    Settlement[]
  >(fetchPending, 3000);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!settlements?.length) return;
    if (selected.size === settlements.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(settlements.map((s) => s.id)));
    }
  };

  const handleBatch = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.batchSettlements();
      setMessage(
        created.length
          ? `Created ${created.length} T+3 settlement(s) from affirmed trades`
          : "No affirmed trades ready for batch — affirm trades first"
      );
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
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (!selected.size) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const results = await api.confirmSettlementsBulk([...selected]);
      setMessage(`Confirmed ${results.length} settlement(s) — balances updated`);
      setSelected(new Set());
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk confirm failed");
    } finally {
      setBusy(false);
    }
  };

  const isOps = role === "ops";

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Back Office Settlement</h2>
          <p className="page-subtitle">T+3 batch settlement with manual confirmation</p>
        </div>
      </div>

      {!isOps && (
        <div className="banner banner-warn">
          Switch to <strong>Ops</strong> role to batch and confirm settlements.
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}
      {pollError && <div className="banner banner-error">{pollError}</div>}
      {message && <div className="banner banner-success">{message}</div>}

      {isOps && (
        <div className="toolbar">
          <button className="btn btn-primary" onClick={handleBatch} disabled={busy}>
            Run T+3 Batch
          </button>
          {selected.size > 0 && (
            <button
              className="btn btn-success"
              onClick={handleBulkConfirm}
              disabled={busy}
            >
              Confirm Selected ({selected.size})
            </button>
          )}
        </div>
      )}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              {isOps && (
                <th>
                  <input
                    type="checkbox"
                    checked={
                      !!settlements?.length &&
                      selected.size === settlements.length
                    }
                    onChange={toggleAll}
                  />
                </th>
              )}
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
            {!settlements?.length ? (
              <tr>
                <td colSpan={isOps ? 9 : 7} className="empty-row">
                  No pending settlements
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id}>
                  {isOps && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                    </td>
                  )}
                  <td>#{s.id}</td>
                  <td>#{s.trade_id}</td>
                  <td>
                    <span className="ticker-pill">{s.trade?.ticker ?? "—"}</span>
                  </td>
                  <td>{s.trade?.qty ?? "—"}</td>
                  <td>{s.trade ? formatZAR(s.trade.price) : "—"}</td>
                  <td>{new Date(s.settlement_date).toLocaleDateString()}</td>
                  <td>
                    <span className="badge badge-pending">{s.status}</span>
                  </td>
                  {isOps && (
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleConfirm(s.id)}
                        disabled={busy}
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
    </div>
  );
}
