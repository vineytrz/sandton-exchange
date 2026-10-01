import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MarketTicker from "./components/MarketTicker";
import Sidebar from "./components/Sidebar";
import { useRole } from "./context/RoleContext";
import { setApiRole } from "./lib/api";
import Accounts from "./pages/Accounts";
import AuditLog from "./pages/AuditLog";
import BackOfficeSettlement from "./pages/BackOfficeSettlement";
import MarketOverview from "./pages/MarketOverview";
import MyOrders from "./pages/MyOrders";
import OpsDashboard from "./pages/OpsDashboard";
import OrderBook from "./pages/OrderBook";
import OrderEntry from "./pages/OrderEntry";
import Portfolio from "./pages/Portfolio";
import TradeAffirmation from "./pages/TradeAffirmation";
import TradeBlotter from "./pages/TradeBlotter";
import ExceptionQueue from "./pages/ExceptionQueue";
import Reconciliation from "./pages/Reconciliation";
import SettlementFails from "./pages/SettlementFails";
import CorporateActions from "./pages/CorporateActions";
import RiskLimits from "./pages/RiskLimits";
import Surveillance from "./pages/Surveillance";
import EodReporting from "./pages/EodReporting";
import InstrumentOnboarding from "./pages/InstrumentOnboarding";

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
          <span className="header-tagline">Back Office</span>
        </div>
        <div className="header-meta">
          <span className="header-session">Session: SAST</span>
          <span className={`header-role role-${role}`}>{role.toUpperCase()}</span>
        </div>
      </header>
      <MarketTicker />
      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<OpsDashboard />} />
            <Route path="/market" element={<MarketOverview />} />
            <Route path="/order-entry" element={<OrderEntry />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/book" element={<OrderBook />} />
            <Route path="/blotter" element={<TradeBlotter />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/affirmation" element={<TradeAffirmation />} />
            <Route path="/settlement" element={<BackOfficeSettlement />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/exceptions" element={<ExceptionQueue />} />
            <Route path="/recon" element={<Reconciliation />} />
            <Route path="/settlement-fails" element={<SettlementFails />} />
            <Route path="/corporate-actions" element={<CorporateActions />} />
            <Route path="/risk-limits" element={<RiskLimits />} />
            <Route path="/surveillance" element={<Surveillance />} />
            <Route path="/reporting" element={<EodReporting />} />
            <Route path="/onboarding" element={<InstrumentOnboarding />} />
            <Route path="/accounts" element={<Accounts />} />
          </Routes>
        </main>
      </div>
      <footer className="app-footer">
        Sandton Exchange · Monolith · REST + Polling · T+3 Settlement · Append-only Audit
      </footer>
    </div>
  );
}
