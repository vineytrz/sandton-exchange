import { Link } from "react-router-dom";
import { useRole } from "../context/RoleContext";

export default function QuickActions() {
  const { role } = useRole();

  const traderActions = [
    { to: "/order-entry", label: "New Order", desc: "Place limit order", primary: true },
    { to: "/orders", label: "My Orders", desc: "Track & cancel" },
    { to: "/book", label: "Order Book", desc: "Live depth" },
    { to: "/portfolio", label: "Portfolio", desc: "Holdings & cash" },
  ];

  const opsActions = [
    { to: "/affirmation", label: "Affirm Trades", desc: "T+0 confirmation", primary: true },
    { to: "/settlement", label: "Settlements", desc: "T+3 batch & confirm" },
    { to: "/audit", label: "Audit Trail", desc: "Full event log" },
    { to: "/accounts", label: "Accounts", desc: "Balance overview" },
  ];

  const actions = role === "ops" ? opsActions : traderActions;

  return (
    <div className="panel">
      <h3>Quick Actions</h3>
      <div className="quick-actions">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={`quick-action${a.primary ? " primary" : ""}`}
          >
            <span className="qa-label">{a.label}</span>
            <span className="qa-desc">{a.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
