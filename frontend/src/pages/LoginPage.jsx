import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err?.details?.error || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authLayout">
      <div className="card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <img className="brandMark" src="/logo.svg" alt="" />
          <div className="brandTitle">
            <strong>Mini Booking System</strong>
            <span>Log in to continue</span>
          </div>
        </div>

        <h1 className="sectionTitle">Login</h1>
        <form onSubmit={onSubmit} className="formGrid">
          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>

          {error ? <div className="alert alertError">{error}</div> : null}

          <button className="btn btnPrimary" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: 18 }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

