import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import OrderBook from "./OrderBook";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    api: {
      getInstruments: vi.fn().mockResolvedValue([
        {
          id: 1,
          ticker: "NPN",
          name: "Naspers",
          last_price: 2850,
          currency: "ZAR",
        },
      ]),
      getOrderBook: vi.fn().mockResolvedValue({
        instrument_id: 1,
        ticker: "NPN",
        bids: [{ price: 2840, qty: 100, order_count: 1 }],
        asks: [{ price: 2860, qty: 50, order_count: 1 }],
      }),
    },
  };
});

describe("OrderBook", () => {
  it("renders bid and ask tables", async () => {
    render(
      <BrowserRouter>
        <OrderBook />
      </BrowserRouter>
    );

    expect(await screen.findByText("Order Book")).toBeInTheDocument();
    expect(await screen.findByText("Bids")).toBeInTheDocument();
    expect(screen.getByText("Asks")).toBeInTheDocument();
  });
});
