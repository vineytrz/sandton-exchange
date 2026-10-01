import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatZAR, type Account, type Portfolio } from "../lib/api";

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number>(0);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAccounts()
      .then((accts) => {
        const traders = accts.filter((a) => a.role_hint === "trader");
        setAccounts(traders);
        if (traders.length) setAccountId(traders[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!accountId) return;
    const load = () => {
      api
        .getPortfolio(accountId)
        .then(setPortfolio)
        .catch((err) => setError(err.message));
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [accountId]);

  const positionsValue =
    portfolio?.positions.reduce((s, p) => s + p.qty * p.avg_price, 0) ?? 0;
  const totalValue = (portfolio?.cash_balance ?? 0) + positionsValue;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Portfolio</h2>
          <p className="page-subtitle">
            Holdings update after settlement confirmation (T+3 legacy)
          </p>
        </div>
        <Link to="/order-entry" className="btn btn-primary">
          Trade
        </Link>
      </div>

      <div className="form-row">
        <label>
          Account
          <select
            value={accountId}
            onChange={(e) => setAccountId(Number(e.target.value))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {portfolio && (
        <>
          <div className="stat-grid">
            <div className="stat-card accent-ok">
              <span className="stat-value">{formatZAR(portfolio.cash_balance)}</span>
              <span className="stat-label">Cash Balance</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatZAR(positionsValue)}</span>
              <span className="stat-label">Positions Value</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatZAR(totalValue)}</span>
              <span className="stat-label">Total (Est.)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{portfolio.positions.length}</span>
              <span className="stat-label">Holdings</span>
            </div>
          </div>

          <div className="panel">
            <h3>Positions — {portfolio.account_name}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Qty</th>
                  <th>Avg Price</th>
                  <th>Market Value</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      No settled positions —{" "}
                      <Link to="/order-entry">place a trade</Link>
                    </td>
                  </tr>
                ) : (
                  portfolio.positions.map((p) => {
                    const mv = p.qty * p.avg_price;
                    const weight =
                      totalValue > 0 ? ((mv / totalValue) * 100).toFixed(1) : "0";
                    return (
                      <tr key={p.instrument_id}>
                        <td>
                          <span className="ticker-pill">{p.ticker}</span>
                        </td>
                        <td>{p.qty.toLocaleString()}</td>
                        <td>{formatZAR(p.avg_price)}</td>
                        <td>{formatZAR(mv)}</td>
                        <td>
                          <div className="weight-bar">
                            <div
                              className="weight-fill"
                              style={{ width: `${weight}%` }}
                            />
                            <span>{weight}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
