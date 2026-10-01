import { useCallback, useState } from "react";
import PlatformPage from "../components/PlatformPage";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, type ComplianceAlert } from "../lib/api";

export default function Surveillance() {
  const { role } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const fetch = useCallback(() => api.getComplianceAlerts(), []);
  const { data: alerts, refresh, error } = usePolling<ComplianceAlert[]>(fetch, 5000);

  const scan = async () => {
    const result = await api.runComplianceScan();
    setMessage(`Scan complete — ${result.alerts_found} alert(s)`);
    refresh();
  };

  return (
    <PlatformPage
      title="Surveillance & Compliance"
      subtitle="Pattern detection — wash trades, high cancel ratios (read-only alerts)"
      actions={role === "ops" ? <button className="btn btn-primary" onClick={scan}>Run Scan</button> : undefined}
    >
      <div className="banner banner-info">
        <strong>Automation opportunity:</strong> Pure read-only pattern-detection agent — no write access needed.
      </div>
      {message && <div className="banner banner-success">{message}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Entity</th>
              <th>Description</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {!alerts?.length ? (
              <tr><td colSpan={6} className="empty-row">No alerts — run scan to detect patterns</td></tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id}>
                  <td>#{a.id}</td>
                  <td><span className="entity-tag">{a.alert_type}</span></td>
                  <td><span className={`badge ${a.severity === "HIGH" ? "badge-rejected" : "badge-pending"}`}>{a.severity}</span></td>
                  <td className="mono">{a.entity_type} #{a.entity_id}</td>
                  <td>{a.description}</td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformPage>
  );
}
