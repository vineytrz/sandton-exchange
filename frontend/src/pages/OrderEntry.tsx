import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { useRole } from "../context/RoleContext";
import { usePolling } from "../hooks/usePolling";
import {
  api,
  formatZAR,
  type Account,
  type Instrument,
  type Order,
  type OrderBook,
  type OrderSide,
} from "../lib/api";

const QTY_PRESETS = [10, 50, 100, 500, 1000];

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

  const fetchOrders = useCallback(() => api.getOrders(), []);
  const { data: recentOrders, refresh: refreshOrders } = usePolling<Order[]>(
    fetchOrders,
    4000
  );

  const fetchBook = useCallback(
    () => (instrumentId > 0 ? api.getOrderBook(instrumentId) : Promise.resolve(null)),
    [instrumentId]
  );
  const { data: book } = usePolling<OrderBook | null>(fetchBook, 4000, instrumentId > 0);

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

  const selectedInst = instruments.find((i) => i.id === instrumentId);
  const selectedAcct = accounts.find((a) => a.id === accountId);
  const notional = qty * price;
  const bestBid = book?.bids[0]?.price;
  const bestAsk = book?.asks[0]?.price;
  const spread =
    bestBid != null && bestAsk != null ? bestAsk - bestBid : null;

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
        `Order #${order.id} submitted — ${order.status}${order.ticker ? ` (${order.ticker})` : ""}`
      );
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Order Entry</h2>
          <p className="page-subtitle">Limit orders · price-time priority matching</p>
        </div>
        <Link to="/orders" className="btn">
          View My Orders
        </Link>
      </div>

      {role !== "trader" && (
        <div className="banner banner-warn">
          Ops mode — switch to <strong>Trader</strong> to place orders.
        </div>
      )}

      <div className="order-entry-grid">
        <div className="panel">
          <form onSubmit={handleSubmit}>
            <div className="side-toggle">
              <button
                type="button"
                className={`side-btn buy${side === "BUY" ? " active" : ""}`}
                onClick={() => setSide("BUY")}
              >
                BUY
              </button>
              <button
                type="button"
                className={`side-btn sell${side === "SELL" ? " active" : ""}`}
                onClick={() => setSide("SELL")}
              >
                SELL
              </button>
            </div>

            <div className="form-grid">
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

            <div className="qty-presets">
              {QTY_PRESETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chip"
                  onClick={() => setQty(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="order-preview">
              <div className="preview-row">
                <span>Notional value</span>
                <strong>{formatZAR(notional)}</strong>
              </div>
              <div className="preview-row">
                <span>Available cash</span>
                <strong>{selectedAcct ? formatZAR(selectedAcct.cash_balance) : "—"}</strong>
              </div>
            </div>

            <button
              type="submit"
              className={`btn btn-lg btn-primary${side === "SELL" ? " btn-sell" : ""}`}
              disabled={submitting || role !== "trader"}
            >
              {submitting ? "Submitting…" : `${side} ${selectedInst?.ticker ?? ""}`}
            </button>
          </form>
          {error && <div className="banner banner-error">{error}</div>}
          {message && <div className="banner banner-success">{message}</div>}
        </div>

        <div className="order-entry-side">
          {selectedInst && (
            <div className="panel inst-summary">
              <h3>{selectedInst.ticker}</h3>
              <p className="inst-summary-name">{selectedInst.name}</p>
              <div className="inst-summary-price">{formatZAR(selectedInst.last_price)}</div>
              {book && (
                <div className="book-mini">
                  <div>
                    <span className="label">Best Bid</span>
                    <span className="bid">{bestBid != null ? formatZAR(bestBid) : "—"}</span>
                  </div>
                  <div>
                    <span className="label">Best Ask</span>
                    <span className="ask">{bestAsk != null ? formatZAR(bestAsk) : "—"}</span>
                  </div>
                  <div>
                    <span className="label">Spread</span>
                    <span>{spread != null ? formatZAR(spread) : "—"}</span>
                  </div>
                </div>
              )}
              <Link to="/book" className="link-sm">
                Full order book →
              </Link>
            </div>
          )}

          <div className="panel">
            <div className="panel-header-row">
              <h3>Recent Orders</h3>
              <Link to="/orders" className="link-sm">
                All →
              </Link>
            </div>
            <ul className="mini-list">
              {!recentOrders?.length ? (
                <li className="mini-empty">No orders yet</li>
              ) : (
                recentOrders.slice(0, 6).map((o) => (
                  <li key={o.id} className="mini-item">
                    <span className={`side-badge side-${o.side.toLowerCase()}`}>
                      {o.side}
                    </span>
                    <span className="ticker-pill sm">{o.ticker}</span>
                    <span className="mono">{o.qty} @ {formatZAR(o.price)}</span>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
