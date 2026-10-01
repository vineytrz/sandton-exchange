import { useCallback } from "react";
import { usePolling } from "../hooks/usePolling";
import { api, formatZAR, type Instrument } from "../lib/api";

export default function MarketTicker() {
  const fetch = useCallback(() => api.getInstruments(), []);
  const { data: instruments } = usePolling<Instrument[]>(fetch, 5000);

  if (!instruments?.length) return null;

  return (
    <div className="market-ticker">
      <div className="ticker-scroll">
        {instruments.map((i) => (
          <span key={i.ticker} className="ticker-item">
            <strong>{i.ticker}</strong> {formatZAR(i.last_price)}
          </span>
        ))}
      </div>
    </div>
  );
}
