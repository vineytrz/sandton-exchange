import { useCallback } from "react";
import PlatformPage from "../components/PlatformPage";
import { usePolling } from "../hooks/usePolling";
import { api, type ExceptionItem } from "../lib/api";

const CATEGORY_CLASS: Record<string, string> = {
  RETRY_SAFE: "badge-open",
  NEEDS_HUMAN: "badge-pending",
  INFORMATIONAL: "badge-filled",
};

const SEVERITY_CLASS: Record<string, string> = {
  LOW: "badge-open",
  MEDIUM: "badge-pending",
  HIGH: "badge-rejected",
};

export default function ExceptionQueue() {
  const fetch = useCallback(() => api.getExceptions(), []);
  const { data: exceptions, error } = usePolling<ExceptionItem[]>(fetch, 4000);

  const byCategory = {
    NEEDS_HUMAN: exceptions?.filter((e) => e.category === "NEEDS_HUMAN").length ?? 0,
    RETRY_SAFE: exceptions?.filter((e) => e.category === "RETRY_SAFE").length ?? 0,
    INFORMATIONAL: exceptions?.filter((e) => e.category === "INFORMATIONAL").length ?? 0,
  };

  return (
    <PlatformPage
      title="Exception Queue"
      subtitle="Triage dashboard — failed settlements, recon breaks, pending affirmations, compliance alerts"
    >
      {error && <div className="banner banner-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card accent-warn">
          <span className="stat-value">{exceptions?.length ?? 0}</span>
          <span className="stat-label">Total Open</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{byCategory.NEEDS_HUMAN}</span>
          <span className="stat-label">Needs Human</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{byCategory.RETRY_SAFE}</span>
          <span className="stat-label">Retry Safe</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{byCategory.INFORMATIONAL}</span>
          <span className="stat-label">Informational</span>
        </div>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Entity</th>
              <th>Description</th>
              <th>Automation hint</th>
            </tr>
          </thead>
          <tbody>
            {!exceptions?.length ? (
              <tr><td colSpan={6} className="empty-row">No open exceptions — all clean</td></tr>
            ) : (
              exceptions.map((e) => (
                <tr key={e.id}>
                  <td><span className="entity-tag">{e.type}</span></td>
                  <td><span className={`badge ${SEVERITY_CLASS[e.severity] ?? ""}`}>{e.severity}</span></td>
                  <td><span className={`badge ${CATEGORY_CLASS[e.category] ?? ""}`}>{e.category}</span></td>
                  <td className="mono">{e.entity_type} #{e.entity_id}</td>
                  <td>{e.description}</td>
                  <td className="automation-hint">
                    {e.category === "RETRY_SAFE" && "Agent: auto-retry eligible"}
                    {e.category === "NEEDS_HUMAN" && "Agent: route to Ops queue"}
                    {e.category === "INFORMATIONAL" && "Agent: log & monitor"}
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
