import { useCallback } from "react";
import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { api, type AuditEvent } from "../lib/api";

const ACTION_LABELS: Record<string, string> = {
  order_placed: "Order placed",
  order_validated: "Validated",
  order_open: "On book",
  order_matched: "Matched",
  order_cancelled: "Cancelled",
  trade_created: "Trade created",
  trade_affirmed: "Trade affirmed",
  settlement_batched: "Settlement batched",
  settlement_confirmed: "Settlement confirmed",
};

export default function RecentActivity({ limit = 8 }: { limit?: number }) {
  const fetch = useCallback(
    () => api.getAuditEvents({ limit }),
    [limit]
  );
  const { data: events } = usePolling<AuditEvent[]>(fetch, 5000);

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h3>Recent Activity</h3>
        <Link to="/audit" className="link-sm">
          View all →
        </Link>
      </div>
      <ul className="activity-feed">
        {!events?.length ? (
          <li className="activity-empty">No activity yet</li>
        ) : (
          events.map((e) => (
            <li key={e.id} className="activity-item">
              <span className="activity-time">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
              <span className="activity-desc">
                <strong>{ACTION_LABELS[e.action] ?? e.action}</strong>
                <span className="activity-meta">
                  {e.entity_type} #{e.entity_id} · {e.actor}
                </span>
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
