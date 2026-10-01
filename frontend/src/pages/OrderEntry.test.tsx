import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RoleProvider } from "../context/RoleContext";
import OrderEntry from "./OrderEntry";

vi.mock("../lib/api", () => ({
  api: {
    getAccounts: vi.fn().mockResolvedValue([
      { id: 1, name: "Trader Alpha", role_hint: "trader", cash_balance: 1000000, created_at: "" },
    ]),
    getInstruments: vi.fn().mockResolvedValue([
      { id: 1, ticker: "NPN", name: "Naspers", last_price: 2850, currency: "ZAR" },
    ]),
    createOrder: vi.fn(),
  },
}));

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
    expect(screen.getByText("Submit Order")).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toBeInTheDocument();
    expect(screen.getByLabelText("Instrument")).toBeInTheDocument();
  });
});
