import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, type OpsDashboard as OpsDashboardData } from "../lib/api";

function StatCard({
  label,
  value,
  accent,
  link,
}: {
  label: string;
  value: number;
  accent?: string;
  link?: string;
}) {
  const inner = (
    <div className={`stat-card ${accent ?? ""}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

export default function OpsDashboard() {
  const { role } = useRole();
  const fetch = useCallback(() => api.getOpsDashboard(), []);
  const { data, error, loading } = usePolling<OpsDashboardData>(fetch, 4000);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Operations Dashboard</h2>
          <p className="page-subtitle">
            Real-time back-office queue overview
          </p>
        </div>
        {data && (
          <span
            className={`market-badge ${data.market_open ? "open" : "closed"}`}
          >
            {data.market_open ? "● Market Open" : "● Market Closed"}
          </span>
        )}
      </div>

      {loading && !data && <div className="panel">Loading dashboard…</div>}
      {error && <div className="panel error">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <StatCard
              label="Open Orders"
              value={data.open_orders}
              link="/book"
            />
            <StatCard
              label="Pending Affirmations"
              value={data.pending_affirmations}
              accent="accent-warn"
              link="/affirmation"
            />
            <StatCard
              label="Pending Settlements"
              value={data.pending_settlements}
              accent="accent-warn"
              link="/settlement"
            />
            <StatCard label="Trades Today" value={data.todays_trades} link="/blotter" />
            <StatCard
              label="Confirmed Settlements"
              value={data.confirmed_settlements}
              accent="accent-ok"
            />
            <StatCard
              label="Audit Events Today"
              value={data.audit_events_today}
              link="/audit"
            />
          </div>

          {role !== "ops" && (
            <div className="banner banner-info">
              Switch to <strong>Ops</strong> role to action affirmations and
              settlements.
            </div>
          )}

          <div className="panel">
            <h3>Workflow Pipeline</h3>
            <div className="pipeline">
              <div className="pipeline-step">
                <span className="step-num">1</span>
                <span>Order Entry</span>
              </div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step">
                <span className="step-num">2</span>
                <span>Match / Trade</span>
              </div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step active">
                <span className="step-num">3</span>
                <span>Ops Affirmation</span>
                <span className="step-count">{data.pending_affirmations}</span>
              </div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step active">
                <span className="step-num">4</span>
                <span>T+3 Settlement</span>
                <span className="step-count">{data.pending_settlements}</span>
              </div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step">
                <span className="step-num">5</span>
                <span>Balance Update</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
