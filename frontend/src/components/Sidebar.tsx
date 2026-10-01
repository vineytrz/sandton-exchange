import { NavLink } from "react-router-dom";
import { useRole } from "../context/RoleContext";

const SECTIONS = [
  {
    title: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: "📊" },
      { to: "/market", label: "Market Overview", icon: "📈" },
    ],
  },
  {
    title: "Trading",
    items: [
      { to: "/order-entry", label: "Order Entry", icon: "✚" },
      { to: "/orders", label: "My Orders", icon: "📋" },
      { to: "/book", label: "Order Book", icon: "📖" },
      { to: "/blotter", label: "Trade Blotter", icon: "📰" },
      { to: "/portfolio", label: "Portfolio", icon: "💼" },
    ],
  },
  {
    title: "Back Office",
    items: [
      { to: "/affirmation", label: "Trade Affirmation", icon: "✓" },
      { to: "/settlement", label: "Settlement", icon: "🏦" },
      { to: "/audit", label: "Audit Log", icon: "🔍" },
    ],
  },
  {
    title: "Reference",
    items: [{ to: "/accounts", label: "Accounts", icon: "👤" }],
  },
];

export default function Sidebar() {
  const { role, setRole } = useRole();

  return (
    <aside className="sidebar">
      <div className="sidebar-role">
        <label htmlFor="role-select">Active Role</label>
        <select
          id="role-select"
          value={role}
          onChange={(e) => setRole(e.target.value as "trader" | "ops")}
        >
          <option value="trader">Trader</option>
          <option value="ops">Ops</option>
        </select>
        <span className={`role-pill role-${role}`}>{role.toUpperCase()}</span>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="sidebar-section">
          <div className="sidebar-section-title">{section.title}</div>
          {section.items.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <span className="sidebar-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="sidebar-help">
          <strong>Quick tips</strong>
          <p>Trader: place orders, view book</p>
          <p>Ops: affirm → batch → confirm</p>
        </div>
      </div>
    </aside>
  );
}
