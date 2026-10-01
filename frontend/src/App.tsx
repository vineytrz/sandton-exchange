import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useRole } from "./context/RoleContext";
import { setApiRole } from "./lib/api";
import BackOfficeSettlement from "./pages/BackOfficeSettlement";
import OrderBook from "./pages/OrderBook";
import OrderEntry from "./pages/OrderEntry";
import Portfolio from "./pages/Portfolio";
import TradeBlotter from "./pages/TradeBlotter";

export default function App() {
  const { role, setRole } = useRole();

  useEffect(() => {
    setApiRole(role);
  }, [role]);

  return (
    <>
      <header className="app-header">
        <h1>Sandton Exchange</h1>
        <nav className="app-nav">
          <NavLink to="/" end>
            Order Entry
          </NavLink>
          <NavLink to="/book">Order Book</NavLink>
          <NavLink to="/blotter">Trade Blotter</NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/settlement">Settlement</NavLink>
          <div className="role-switcher">
            <label htmlFor="role-select">Role:</label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as "trader" | "ops")}
            >
              <option value="trader">Trader</option>
              <option value="ops">Ops</option>
            </select>
          </div>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<OrderEntry />} />
          <Route path="/book" element={<OrderBook />} />
          <Route path="/blotter" element={<TradeBlotter />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/settlement" element={<BackOfficeSettlement />} />
        </Routes>
      </main>
    </>
  );
}
