import { useCallback } from "react";
import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Instrument } from "../lib/api";

export default function MarketOverview() {
  const fetch = useCallback(() => api.getInstruments(), []);
  const { data: instruments, error } = usePolling<Instrument[]>(fetch, 4000);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Market Overview</h2>
          <p className="page-subtitle">JSE-listed instruments · ZAR denominated</p>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="instrument-grid">
        {instruments?.map((i) => (
          <div key={i.id} className="instrument-card">
            <div className="inst-header">
              <span className="ticker-pill lg">{i.ticker}</span>
              <span className="inst-currency">{i.currency}</span>
            </div>
            <div className="inst-name">{i.name}</div>
            <div className="inst-price">{formatZAR(i.last_price)}</div>
            <div className="inst-actions">
              <Link to="/order-entry" className="btn btn-sm btn-primary">
                Buy
              </Link>
              <Link to="/book" className="btn btn-sm">
                Book
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: "1.25rem" }}>
        <h3>All Instruments</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th>Last Price</th>
              <th>Currency</th>
              <th>Actions</th>
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
                <td>{i.currency}</td>
                <td>
                  <Link to="/book" className="link-sm">
                    View book
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
