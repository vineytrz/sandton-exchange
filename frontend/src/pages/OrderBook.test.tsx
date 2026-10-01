import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderBook from "./OrderBook";

vi.mock("../lib/api", () => ({
  api: {
    getInstruments: vi.fn().mockResolvedValue([
      { id: 1, ticker: "NPN", name: "Naspers", last_price: 2850, currency: "ZAR" },
    ]),
    getOrderBook: vi.fn().mockResolvedValue({
      instrument_id: 1,
      ticker: "NPN",
      bids: [{ price: 2840, qty: 100, order_count: 1 }],
      asks: [{ price: 2860, qty: 50, order_count: 1 }],
    }),
  },
}));

describe("OrderBook", () => {
  it("renders bid and ask tables", async () => {
    render(<OrderBook />);

    expect(await screen.findByText("Order Book")).toBeInTheDocument();
    expect(await screen.findByText("Bids")).toBeInTheDocument();
    expect(await screen.findByText("Asks")).toBeInTheDocument();
    expect(await screen.findByText("2840.00")).toBeInTheDocument();
    expect(await screen.findByText("2860.00")).toBeInTheDocument();
  });
});
