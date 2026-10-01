import { FormEvent, useEffect, useState } from "react";
import { useRole } from "../context/RoleContext";
import { api, type Account, type Instrument, type OrderSide } from "../lib/api";

export default function OrderEntry() {
  const { role } = useRole();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [accountId, setAccountId] = useState<number>(0);
  const [instrumentId, setInstrumentId] = useState<number>(0);
  const [side, setSide] = useState<OrderSide>("BUY");
  const [qty, setQty] = useState(100);
  const [price, setPrice] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([api.getAccounts(), api.getInstruments()])
      .then(([accts, insts]) => {
        const traders = accts.filter((a) => a.role_hint === "trader");
        setAccounts(traders);
        setInstruments(insts);
        if (traders.length) setAccountId(traders[0].id);
        if (insts.length) {
          setInstrumentId(insts[0].id);
          setPrice(insts[0].last_price);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const onInstrumentChange = (id: number) => {
    setInstrumentId(id);
    const inst = instruments.find((i) => i.id === id);
    if (inst) setPrice(inst.last_price);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (role !== "trader") {
      setError("Switch to Trader role to place orders");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const order = await api.createOrder({
        account_id: accountId,
        instrument_id: instrumentId,
        side,
        qty,
        price,
      });
      setMessage(
        `Order #${order.id} submitted — status: ${order.status}${order.ticker ? ` (${order.ticker})` : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2>Order Entry</h2>
      {role !== "trader" && (
        <div className="ops-only-banner">
          You are in Ops mode. Switch to Trader to place orders.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Account
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (R{a.cash_balance.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <label>
            Instrument
            <select
              value={instrumentId}
              onChange={(e) => onInstrumentChange(Number(e.target.value))}
            >
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.ticker} — {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Side
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as OrderSide)}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
          <label>
            Limit Price (ZAR)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
        </div>
        <button type="submit" disabled={submitting || role !== "trader"}>
          {submitting ? "Submitting…" : "Submit Order"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
    </div>
  );
}
