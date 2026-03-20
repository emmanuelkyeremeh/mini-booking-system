import { useAuth } from "../auth/authContext.js";
import ConsumerDashboardPage from "./consumer/ConsumerDashboardPage.jsx";
import BusinessDashboardPage from "./business/BusinessDashboardPage.jsx";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div>
      <div className="appHeader">
        <div className="brand">
          <img className="brandMark" src="/logo.svg" alt="" />
          <div className="brandTitle">
            <strong>Mini Booking System</strong>
            <span>{user.role === "business" ? "Business dashboard" : "Consumer dashboard"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="userEmail">{user.email}</span>
          <button className="btn btnDanger" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {user.role === "consumer" ? <ConsumerDashboardPage /> : null}
      {user.role === "business" ? <BusinessDashboardPage /> : null}
    </div>
  );
}

