import { useCallback } from "react";
import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Account } from "../lib/api";

export default function Accounts() {
  const fetch = useCallback(() => api.getAccounts(), []);
  const { data: accounts, error } = usePolling<Account[]>(fetch, 5000);

  const traders = accounts?.filter((a) => a.role_hint === "trader") ?? [];
  const ops = accounts?.filter((a) => a.role_hint === "ops") ?? [];
  const totalCash =
    traders.reduce((sum, a) => sum + a.cash_balance, 0) ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Accounts</h2>
          <p className="page-subtitle">Registered trading and operations accounts</p>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{accounts?.length ?? 0}</span>
          <span className="stat-label">Total Accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{traders.length}</span>
          <span className="stat-label">Trader Accounts</span>
        </div>
        <div className="stat-card accent-ok">
          <span className="stat-value">{formatZAR(totalCash)}</span>
          <span className="stat-label">Combined Cash</span>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Trader Accounts</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Cash Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {traders.map((a) => (
                <tr key={a.id}>
                  <td>#{a.id}</td>
                  <td>{a.name}</td>
                  <td className="mono">{formatZAR(a.cash_balance)}</td>
                  <td>
                    <Link to="/portfolio" className="link-sm">
                      Portfolio →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Operations Accounts</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((a) => (
                <tr key={a.id}>
                  <td>#{a.id}</td>
                  <td>{a.name}</td>
                  <td>
                    <span className="badge badge-pending">OPS</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
