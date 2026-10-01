import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RoleProvider } from "../context/RoleContext";
import OrderEntry from "./OrderEntry";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    api: {
      getAccounts: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Trader Alpha",
          role_hint: "trader",
          cash_balance: 1000000,
          created_at: "",
        },
      ]),
      getInstruments: vi.fn().mockResolvedValue([
        {
          id: 1,
          ticker: "NPN",
          name: "Naspers",
          last_price: 2850,
          currency: "ZAR",
        },
      ]),
      getOrders: vi.fn().mockResolvedValue([]),
      getOrderBook: vi.fn().mockResolvedValue({
        instrument_id: 1,
        ticker: "NPN",
        bids: [],
        asks: [],
      }),
      createOrder: vi.fn(),
    },
  };
});

describe("OrderEntry", () => {
  it("renders order entry form", async () => {
    render(
      <BrowserRouter>
        <RoleProvider>
          <OrderEntry />
        </RoleProvider>
      </BrowserRouter>
    );

    expect(await screen.findByText("Order Entry")).toBeInTheDocument();
    expect(screen.getByText(/BUY NPN/)).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toBeInTheDocument();
  });
});
