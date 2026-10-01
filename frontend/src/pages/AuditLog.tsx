import { useCallback, useState } from "react";
import { usePolling } from "../hooks/usePolling";
import { api, type AuditEvent } from "../lib/api";

const ENTITY_TYPES = ["", "order", "trade", "settlement"];

const ACTION_COLORS: Record<string, string> = {
  order_placed: "badge-open",
  order_validated: "badge-open",
  order_open: "badge-open",
  order_matched: "badge-filled",
  order_cancelled: "badge-pending",
  order_rejected: "badge-rejected",
  trade_created: "badge-filled",
  trade_affirmed: "badge-confirmed",
  settlement_batched: "badge-pending",
  settlement_confirmed: "badge-confirmed",
};

export default function AuditLog() {
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const fetch = useCallback(() => {
    const params: { entity_type?: string; entity_id?: number; limit: number } =
      { limit: 200 };
    if (entityType) params.entity_type = entityType;
    if (entityId) params.entity_id = Number(entityId);
    return api.getAuditEvents(params);
  }, [entityType, entityId]);

  const { data: events, error, loading } = usePolling<AuditEvent[]>(
    fetch,
    4000
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Audit Trail</h2>
          <p className="page-subtitle">
            Append-only log of every state transition
          </p>
        </div>
      </div>

      <div className="panel filters-panel">
        <div className="form-row">
          <label>
            Entity Type
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t || "All types"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entity ID
            <input
              type="number"
              placeholder="Any"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </label>
        </div>
      </div>

      {loading && !events && <div className="panel">Loading audit events…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel">
        <table className="data-table audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {!events?.length ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No audit events found
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className="entity-tag">{e.entity_type}</span>
                    <span className="mono">#{e.entity_id}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${ACTION_COLORS[e.action] ?? "badge-open"}`}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td>{e.actor}</td>
                  <td className="payload-cell">
                    <code>{e.payload_json}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
