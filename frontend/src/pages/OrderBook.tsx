import { useCallback, useEffect, useState } from "react";
import { usePolling } from "../hooks/usePolling";
import { api, type Instrument, type OrderBook } from "../lib/api";

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

  return (
    <div className="panel">
      <h2>Order Book</h2>
      <div className="form-row">
        <label>
          Instrument
          <select
            value={instrumentId}
            onChange={(e) => setInstrumentId(Number(e.target.value))}
          >
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.ticker}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && !book && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {book && (
        <>
          <p>
            <strong>{book.ticker}</strong> — polling every 3s
          </p>
          <div className="order-book">
            <div className="bids">
              <h3>Bids</h3>
              <table>
                <thead>
                  <tr>
                    <th>Price (ZAR)</th>
                    <th>Qty</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {book.bids.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No bids</td>
                    </tr>
                  ) : (
                    book.bids.map((level) => (
                      <tr key={`bid-${level.price}`}>
                        <td className="price">{level.price.toFixed(2)}</td>
                        <td>{level.qty}</td>
                        <td>{level.order_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="asks">
              <h3>Asks</h3>
              <table>
                <thead>
                  <tr>
                    <th>Price (ZAR)</th>
                    <th>Qty</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {book.asks.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No asks</td>
                    </tr>
                  ) : (
                    book.asks.map((level) => (
                      <tr key={`ask-${level.price}`}>
                        <td className="price">{level.price.toFixed(2)}</td>
                        <td>{level.qty}</td>
                        <td>{level.order_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
