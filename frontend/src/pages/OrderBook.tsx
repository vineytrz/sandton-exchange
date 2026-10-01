import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Instrument, type OrderBook } from "../lib/api";

export default function OrderBookPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentId, setInstrumentId] = useState<number>(0);

  useEffect(() => {
    api.getInstruments().then((insts) => {
      setInstruments(insts);
      if (insts.length) setInstrumentId(insts[0].id);
    });
  }, []);

  const fetchBook = useCallback(
    () => api.getOrderBook(instrumentId),
    [instrumentId]
  );

  const { data: book, error, loading } = usePolling<OrderBook>(
    fetchBook,
    3000,
    instrumentId > 0
  );

  const selected = instruments.find((i) => i.id === instrumentId);
  const bestBid = book?.bids[0];
  const bestAsk = book?.asks[0];
  const spread =
    bestBid && bestAsk ? bestAsk.price - bestBid.price : null;
  const totalBidQty = useMemo(
    () => book?.bids.reduce((s, l) => s + l.qty, 0) ?? 0,
    [book]
  );
  const totalAskQty = useMemo(
    () => book?.asks.reduce((s, l) => s + l.qty, 0) ?? 0,
    [book]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Order Book</h2>
          <p className="page-subtitle">Live depth · polling every 3s</p>
        </div>
        <Link to="/order-entry" className="btn btn-primary">
          Place Order
        </Link>
      </div>

      <div className="instrument-tabs">
        {instruments.map((i) => (
          <button
            key={i.id}
            className={`inst-tab${instrumentId === i.id ? " active" : ""}`}
            onClick={() => setInstrumentId(i.id)}
          >
            {i.ticker}
            <span className="inst-tab-price">{formatZAR(i.last_price)}</span>
          </button>
        ))}
      </div>

      {selected && book && (
        <div className="stat-grid book-stats">
          <div className="stat-card">
            <span className="stat-value">{formatZAR(selected.last_price)}</span>
            <span className="stat-label">Last Price</span>
          </div>
          <div className="stat-card accent-ok">
            <span className="stat-value">
              {bestBid ? formatZAR(bestBid.price) : "—"}
            </span>
            <span className="stat-label">Best Bid ({bestBid?.qty ?? 0})</span>
          </div>
          <div className="stat-card accent-warn">
            <span className="stat-value">
              {bestAsk ? formatZAR(bestAsk.price) : "—"}
            </span>
            <span className="stat-label">Best Ask ({bestAsk?.qty ?? 0})</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {spread != null ? formatZAR(spread) : "—"}
            </span>
            <span className="stat-label">Spread</span>
          </div>
        </div>
      )}

      {loading && !book && <div className="panel">Loading order book…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {book && (
        <div className="order-book-panel">
          <div className="book-side bids-panel">
            <div className="book-side-header">
              <h3>Bids</h3>
              <span className="book-total">{totalBidQty.toLocaleString()} total</span>
            </div>
            <table className="data-table depth-table">
              <thead>
                <tr>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Orders</th>
                  <th>Depth</th>
                </tr>
              </thead>
              <tbody>
                {book.bids.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">No bids</td>
                  </tr>
                ) : (
                  book.bids.map((level) => (
                    <tr key={`bid-${level.price}`}>
                      <td className="price bid">{formatZAR(level.price)}</td>
                      <td>{level.qty.toLocaleString()}</td>
                      <td>{level.order_count}</td>
                      <td>
                        <div
                          className="depth-bar bid-bar"
                          style={{
                            width: `${Math.min(100, (level.qty / (totalBidQty || 1)) * 100)}%`,
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="book-mid">
            <div className="mid-ticker">{book.ticker}</div>
            {spread != null && (
              <div className="mid-spread">Spread {formatZAR(spread)}</div>
            )}
          </div>

          <div className="book-side asks-panel">
            <div className="book-side-header">
              <h3>Asks</h3>
              <span className="book-total">{totalAskQty.toLocaleString()} total</span>
            </div>
            <table className="data-table depth-table">
              <thead>
                <tr>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Orders</th>
                  <th>Depth</th>
                </tr>
              </thead>
              <tbody>
                {book.asks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">No asks</td>
                  </tr>
                ) : (
                  book.asks.map((level) => (
                    <tr key={`ask-${level.price}`}>
                      <td className="price ask">{formatZAR(level.price)}</td>
                      <td>{level.qty.toLocaleString()}</td>
                      <td>{level.order_count}</td>
                      <td>
                        <div
                          className="depth-bar ask-bar"
                          style={{
                            width: `${Math.min(100, (level.qty / (totalAskQty || 1)) * 100)}%`,
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
