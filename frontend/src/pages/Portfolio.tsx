import { useEffect, useState } from "react";
import { api, type Account, type Portfolio } from "../lib/api";

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

  return (
    <div className="panel">
      <h2>Portfolio</h2>
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
      {error && <p className="error">{error}</p>}
      {portfolio && (
        <>
          <p>
            <strong>Cash Balance:</strong> R
            {portfolio.cash_balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            Positions update only after settlement confirmation (T+3 legacy
            behaviour).
          </p>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Qty</th>
                <th>Avg Price (ZAR)</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.length === 0 ? (
                <tr>
                  <td colSpan={3}>No settled positions</td>
                </tr>
              ) : (
                portfolio.positions.map((p) => (
                  <tr key={p.instrument_id}>
                    <td>{p.ticker}</td>
                    <td>{p.qty}</td>
                    <td>{p.avg_price.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
