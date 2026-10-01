import { useCallback, useState } from "react";
import PlatformPage from "../components/PlatformPage";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, type CorporateAction } from "../lib/api";

export default function CorporateActions() {
  const { role } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const fetch = useCallback(() => api.getCorporateActions(), []);
  const { data: actions, refresh, error } = usePolling<CorporateAction[]>(fetch, 5000);

  const confirm = async (id: number) => {
    await api.confirmCorporateAction(id);
    setMessage(`Action #${id} confirmed`);
    refresh();
  };

  const apply = async (id: number) => {
    await api.applyCorporateAction(id);
    setMessage(`Action #${id} applied across accounts`);
    refresh();
  };

  return (
    <PlatformPage title="Corporate Actions" subtitle="Dividends, splits — bulk balance adjustments after confirmation">
      <div className="banner banner-warn">
        <strong>High risk:</strong> Bulk balance changes. Agent applies adjustment once action is confirmed.
      </div>
      {message && <div className="banner banner-success">{message}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticker</th>
              <th>Type</th>
              <th>Ex Date</th>
              <th>Pay Date</th>
              <th>Amount/Ratio</th>
              <th>Status</th>
              {role === "ops" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {!actions?.length ? (
              <tr><td colSpan={role === "ops" ? 8 : 7} className="empty-row">No corporate actions</td></tr>
            ) : (
              actions.map((a) => (
                <tr key={a.id}>
                  <td>#{a.id}</td>
                  <td><span className="ticker-pill">{a.ticker}</span></td>
                  <td>{a.action_type}</td>
                  <td>{new Date(a.ex_date).toLocaleDateString()}</td>
                  <td>{new Date(a.pay_date).toLocaleDateString()}</td>
                  <td>{a.amount_per_share ?? a.split_ratio ?? "—"}</td>
                  <td><span className="badge badge-pending">{a.status}</span></td>
                  {role === "ops" && (
                    <td className="action-cell">
                      {a.status === "PENDING" && (
                        <button className="btn btn-sm" onClick={() => confirm(a.id)}>Confirm</button>
                      )}
                      {a.status === "CONFIRMED" && (
                        <button className="btn btn-sm btn-primary" onClick={() => apply(a.id)}>Apply</button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformPage>
  );
}
