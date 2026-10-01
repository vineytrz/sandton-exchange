import { useCallback, useState } from "react";
import PlatformPage from "../components/PlatformPage";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, type ReconBreak } from "../lib/api";

export default function Reconciliation() {
  const { role } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const fetch = useCallback(() => api.getReconBreaks(), []);
  const { data: breaks, refresh, error } = usePolling<ReconBreak[]>(fetch, 5000);

  const runRecon = async () => {
    try {
      const result = await api.runRecon();
      setMessage(`Recon complete — ${result.breaks_found} break(s) found`);
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Recon failed");
    }
  };

  return (
    <PlatformPage
      title="Reconciliation"
      subtitle="Compare internal ledger vs custodian feed (read-only comparison)"
      actions={
        role === "ops" ? (
          <button className="btn btn-primary" onClick={runRecon}>Run EOD Recon</button>
        ) : undefined
      }
    >
      <div className="banner banner-info">
        <strong>Automation opportunity:</strong> Recon agent flags breaks (internal 100 vs custodian 98) — low risk, read-only.
      </div>
      {message && <div className="banner banner-success">{message}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Account</th>
              <th>Type</th>
              <th>Instrument</th>
              <th>Internal</th>
              <th>Custodian</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {!breaks?.length ? (
              <tr><td colSpan={7} className="empty-row">No breaks — run recon to compare</td></tr>
            ) : (
              breaks.map((b) => (
                <tr key={b.id} className={b.variance !== 0 ? "row-break" : ""}>
                  <td>#{b.id}</td>
                  <td>#{b.account_id}</td>
                  <td>{b.break_type}</td>
                  <td>{b.instrument_id ? `#${b.instrument_id}` : "CASH"}</td>
                  <td className="mono">{b.internal_value}</td>
                  <td className="mono">{b.custodian_value}</td>
                  <td className={`mono ${b.variance !== 0 ? "variance-bad" : ""}`}>
                    {b.variance > 0 ? "+" : ""}{b.variance}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformPage>
  );
}
