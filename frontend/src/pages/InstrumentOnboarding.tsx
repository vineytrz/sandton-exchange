import { FormEvent, useCallback, useState } from "react";
import PlatformPage from "../components/PlatformPage";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type PendingInstrument } from "../lib/api";

export default function InstrumentOnboarding() {
  const { role } = useRole();
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(100);
  const [message, setMessage] = useState<string | null>(null);

  const fetch = useCallback(() => api.getPendingInstruments(), []);
  const { data: pending, refresh, error } = usePolling<PendingInstrument[]>(fetch, 5000);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api.onboardInstrument({ ticker, name, last_price: price });
    setMessage(`${ticker.toUpperCase()} submitted for review`);
    setTicker("");
    setName("");
    refresh();
  };

  return (
    <PlatformPage title="Instrument Onboarding" subtitle="New listings require Ops approval before trading">
      <div className="banner banner-info">
        <strong>Automation opportunity:</strong> Agent pre-checks listing against rules checklist, routes to human for final approval.
      </div>
      {message && <div className="banner banner-success">{message}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {role === "ops" && (
        <div className="panel">
          <h3>Submit New Listing</h3>
          <form onSubmit={submit} className="form-grid">
            <label>Ticker<input value={ticker} onChange={(e) => setTicker(e.target.value)} required maxLength={10} /></label>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label>Reference Price<input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0.01} step={0.01} /></label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn btn-primary">Submit for Review</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <h3>Pending Approval</h3>
        <table className="data-table">
          <thead>
            <tr><th>Ticker</th><th>Name</th><th>Ref Price</th><th>Status</th>{role === "ops" && <th>Actions</th>}</tr>
          </thead>
          <tbody>
            {!pending?.length ? (
              <tr><td colSpan={role === "ops" ? 5 : 4} className="empty-row">No pending listings</td></tr>
            ) : (
              pending.map((i) => (
                <tr key={i.id}>
                  <td><span className="ticker-pill">{i.ticker}</span></td>
                  <td>{i.name}</td>
                  <td>{formatZAR(i.last_price)}</td>
                  <td><span className="badge badge-pending">{i.onboarding_status}</span></td>
                  {role === "ops" && (
                    <td className="action-cell">
                      <button className="btn btn-sm btn-primary" onClick={() => api.approveInstrument(i.id).then(refresh)}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => api.rejectInstrument(i.id).then(refresh)}>Reject</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformPage>
  );
}
