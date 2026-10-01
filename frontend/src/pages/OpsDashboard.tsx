import { useCallback } from "react";
import { Link } from "react-router-dom";
import QuickActions from "../components/QuickActions";
import RecentActivity from "../components/RecentActivity";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import {
  api,
  formatZAR,
  type Instrument,
  type OpsDashboard as OpsDashboardData,
} from "../lib/api";

function StatCard({
  label,
  value,
  accent,
  link,
  display,
}: {
  label: string;
  value: number;
  accent?: string;
  link?: string;
  display?: string;
}) {
  const inner = (
    <div className={`stat-card ${accent ?? ""}`}>
      <span className="stat-value">{display ?? value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

export default function OpsDashboard() {
  const { role } = useRole();
  const fetchDash = useCallback(() => api.getOpsDashboard(), []);
  const fetchInst = useCallback(() => api.getInstruments(), []);
  const { data, error, loading } = usePolling<OpsDashboardData>(fetchDash, 4000);
  const { data: instruments } = usePolling<Instrument[]>(fetchInst, 5000);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Operations Dashboard</h2>
          <p className="page-subtitle">
            Real-time queues, market snapshot, and workflow status
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
      {error && <div className="banner banner-error">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <StatCard label="Open Orders" value={data.open_orders} link="/orders" />
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

          <div className="dashboard-grid">
            <div className="dashboard-main">
              {role !== "ops" && (
                <div className="banner banner-info">
                  Switch to <strong>Ops</strong> role to action affirmations and
                  settlements. As Trader you can place orders and monitor queues.
                </div>
              )}

              <div className="panel">
                <h3>Workflow Pipeline</h3>
                <div className="pipeline">
                  <Link to="/order-entry" className="pipeline-step">
                    <span className="step-num">1</span>
                    <span>Order Entry</span>
                  </Link>
                  <div className="pipeline-arrow">→</div>
                  <Link to="/blotter" className="pipeline-step">
                    <span className="step-num">2</span>
                    <span>Match / Trade</span>
                  </Link>
                  <div className="pipeline-arrow">→</div>
                  <Link to="/affirmation" className="pipeline-step active">
                    <span className="step-num">3</span>
                    <span>Ops Affirmation</span>
                    {data.pending_affirmations > 0 && (
                      <span className="step-count">{data.pending_affirmations}</span>
                    )}
                  </Link>
                  <div className="pipeline-arrow">→</div>
                  <Link to="/settlement" className="pipeline-step active">
                    <span className="step-num">4</span>
                    <span>T+3 Settlement</span>
                    {data.pending_settlements > 0 && (
                      <span className="step-count">{data.pending_settlements}</span>
                    )}
                  </Link>
                  <div className="pipeline-arrow">→</div>
                  <Link to="/portfolio" className="pipeline-step">
                    <span className="step-num">5</span>
                    <span>Balance Update</span>
                  </Link>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header-row">
                  <h3>Market Snapshot</h3>
                  <Link to="/market" className="link-sm">
                    Full overview →
                  </Link>
                </div>
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Name</th>
                      <th>Last</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {instruments?.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <span className="ticker-pill">{i.ticker}</span>
                        </td>
                        <td>{i.name}</td>
                        <td className="mono">{formatZAR(i.last_price)}</td>
                        <td>
                          <Link to="/book" className="link-sm">
                            Book
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-side">
              <QuickActions />
              <RecentActivity limit={10} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
