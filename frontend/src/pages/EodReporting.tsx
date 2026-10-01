import { useCallback, useEffect, useState } from "react";
import PlatformPage from "../components/PlatformPage";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Account, type AccountStatement, type EodReport } from "../lib/api";

export default function EodReporting() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState(0);
  const [statement, setStatement] = useState<AccountStatement | null>(null);

  const fetchEod = useCallback(() => api.getEodReport(), []);
  const { data: eod, error } = usePolling<EodReport>(fetchEod, 8000);

  useEffect(() => {
    api.getAccounts().then((accts) => {
      const traders = accts.filter((a) => a.role_hint === "trader");
      setAccounts(traders);
      if (traders.length) setAccountId(traders[0].id);
    });
  }, []);

  useEffect(() => {
    if (!accountId) return;
    api.getAccountStatement(accountId).then(setStatement).catch(() => setStatement(null));
  }, [accountId]);

  return (
    <PlatformPage title="EOD Reporting & Statements" subtitle="Daily account statements and NAV summary">
      <div className="banner banner-info">
        <strong>Automation opportunity:</strong> Agent generates and dispatches statements on schedule — low risk, read + generate.
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      {eod && (
        <div className="stat-grid">
          <div className="stat-card"><span className="stat-value">{eod.trades_today}</span><span className="stat-label">Trades Today</span></div>
          <div className="stat-card"><span className="stat-value">{eod.open_orders}</span><span className="stat-label">Open Orders</span></div>
          <div className="stat-card accent-warn"><span className="stat-value">{eod.pending_settlements}</span><span className="stat-label">Pending Settlements</span></div>
          <div className="stat-card accent-warn"><span className="stat-value">{eod.open_recon_breaks}</span><span className="stat-label">Recon Breaks</span></div>
          <div className="stat-card"><span className="stat-value">{eod.pending_affirmations}</span><span className="stat-label">Pending Affirmations</span></div>
          <div className="stat-card"><span className="stat-value">{eod.open_compliance_alerts}</span><span className="stat-label">Compliance Alerts</span></div>
        </div>
      )}

      <div className="panel">
        <h3>Client Statement</h3>
        <div className="form-row">
          <label>
            Account
            <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        </div>
        {statement && (
          <div className="statement-preview">
            <div className="statement-header">
              <strong>{statement.account_name}</strong>
              <span>As of {new Date(statement.statement_date).toLocaleString()}</span>
            </div>
            <p>Cash: <strong>{formatZAR(statement.cash_balance)}</strong></p>
            <h4>Positions</h4>
            {statement.positions.length === 0 ? (
              <p className="empty-row">No settled positions</p>
            ) : (
              <table className="data-table compact">
                <thead><tr><th>Ticker</th><th>Qty</th><th>Avg Price</th></tr></thead>
                <tbody>
                  {statement.positions.map((p) => (
                    <tr key={p.instrument_id}>
                      <td>{p.ticker}</td><td>{p.qty}</td><td>{formatZAR(p.avg_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h4>Recent Trades</h4>
            <table className="data-table compact">
              <thead><tr><th>ID</th><th>Ticker</th><th>Qty</th><th>Price</th></tr></thead>
              <tbody>
                {statement.recent_trades.map((t) => (
                  <tr key={t.id}>
                    <td>#{t.id}</td><td>{t.ticker}</td><td>{t.qty}</td><td>{formatZAR(t.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PlatformPage>
  );
}
