import { useCallback } from "react";
import PlatformPage from "../components/PlatformPage";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type RiskLimit } from "../lib/api";

export default function RiskLimits() {
  const fetch = useCallback(() => api.getRiskLimits(), []);
  const { data: limits, error } = usePolling<RiskLimit[]>(fetch, 10000);

  return (
    <PlatformPage
      title="Pre-Trade Risk Limits"
      subtitle="Orders breaching limits are rejected before entering the book"
    >
      <div className="banner banner-info">
        <strong>Automation opportunity:</strong> Explicit limit-check agent — limits evolve independently of matching engine.
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Threshold</th>
              <th>Account</th>
              <th>Instrument</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {!limits?.length ? (
              <tr><td colSpan={6} className="empty-row">No limits configured</td></tr>
            ) : (
              limits.map((l) => (
                <tr key={l.id}>
                  <td>#{l.id}</td>
                  <td><span className="entity-tag">{l.limit_type}</span></td>
                  <td className="mono">
                    {l.limit_type.includes("NOTIONAL") || l.limit_type.includes("CASH")
                      ? formatZAR(l.threshold)
                      : l.threshold.toLocaleString()}
                  </td>
                  <td>{l.account_id ? `#${l.account_id}` : "Global"}</td>
                  <td>{l.instrument_id ? `#${l.instrument_id}` : "All"}</td>
                  <td>{l.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformPage>
  );
}
