import { useCallback, useState } from "react";
import PlatformPage from "../components/PlatformPage";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type SettlementFail } from "../lib/api";

export default function SettlementFails() {
  const { role } = useRole();
  const [busy, setBusy] = useState(false);
  const fetch = useCallback(() => api.getSettlementFails(), []);
  const { data: fails, refresh, error } = usePolling<SettlementFail[]>(fetch, 4000);

  const handleFail = async (id: number) => {
    const reason = prompt("Fail reason:");
    if (!reason) return;
    setBusy(true);
    try {
      await api.failSettlement(id, reason);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformPage
      title="Settlement Fails"
      subtitle="Aging and failed T+3 settlements — counterparty short on cash/shares"
    >
      <div className="banner banner-info">
        <strong>Automation opportunity:</strong> Fails agent monitors aging, auto-escalates past threshold, drafts fail notice.
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Settlement</th>
              <th>Trade</th>
              <th>Ticker</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Type</th>
              <th>Reason</th>
              {role === "ops" && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {!fails?.length ? (
              <tr><td colSpan={role === "ops" ? 8 : 7} className="empty-row">No settlement fails</td></tr>
            ) : (
              fails.map((f) => (
                <tr key={f.settlement_id}>
                  <td>#{f.settlement_id}</td>
                  <td>#{f.trade_id}</td>
                  <td><span className="ticker-pill">{f.ticker ?? "—"}</span></td>
                  <td>{f.qty ?? "—"}</td>
                  <td>{f.price != null ? formatZAR(f.price) : "—"}</td>
                  <td><span className={`badge ${f.fail_type === "OVERDUE" ? "badge-pending" : "badge-rejected"}`}>{f.fail_type}</span></td>
                  <td>{f.reason}</td>
                  {role === "ops" && f.fail_type === "OVERDUE" && (
                    <td>
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => handleFail(f.settlement_id)}>
                        Mark Failed
                      </button>
                    </td>
                  )}
                  {role === "ops" && f.fail_type !== "OVERDUE" && <td>—</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformPage>
  );
}
