import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import MarketTicker from "./components/MarketTicker";
import { useRole } from "./context/RoleContext";
import { setApiRole } from "./lib/api";
import AuditLog from "./pages/AuditLog";
import BackOfficeSettlement from "./pages/BackOfficeSettlement";
import OpsDashboard from "./pages/OpsDashboard";
import OrderBook from "./pages/OrderBook";
import OrderEntry from "./pages/OrderEntry";
import Portfolio from "./pages/Portfolio";
import TradeAffirmation from "./pages/TradeAffirmation";
import TradeBlotter from "./pages/TradeBlotter";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/", label: "Order Entry", end: true },
  { to: "/book", label: "Order Book" },
  { to: "/blotter", label: "Blotter" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/affirmation", label: "Affirmation" },
  { to: "/settlement", label: "Settlement" },
  { to: "/audit", label: "Audit Log" },
];

export default function App() {
  const { role, setRole } = useRole();

  useEffect(() => {
    setApiRole(role);
  }, [role]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-brand">
          <h1>Sandton Exchange</h1>
          <span className="header-tagline">Legacy Back Office</span>
        </div>
        <nav className="app-nav">
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="role-switcher">
          <span className="role-label">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "trader" | "ops")}
          >
            <option value="trader">Trader</option>
            <option value="ops">Ops</option>
          </select>
        </div>
      </header>
      <MarketTicker />
      <main className="app-main">
        <Routes>
          <Route path="/dashboard" element={<OpsDashboard />} />
          <Route path="/" element={<OrderEntry />} />
          <Route path="/book" element={<OrderBook />} />
          <Route path="/blotter" element={<TradeBlotter />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/affirmation" element={<TradeAffirmation />} />
          <Route path="/settlement" element={<BackOfficeSettlement />} />
          <Route path="/audit" element={<AuditLog />} />
        </Routes>
      </main>
      <footer className="app-footer">
        Sandton Exchange · JSE Legacy Sim · REST + Polling · T+3 Settlement
      </footer>
    </div>
  );
}
