import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("consumer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ email, password, role });
      navigate("/dashboard");
    } catch (err) {
      setError(err?.details?.error || err?.message || "Register failed");
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
            <span>Create your account</span>
          </div>
        </div>

        <h1 className="sectionTitle">Register</h1>
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

          <label className="field">
            <span className="label">Role</span>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="consumer">Consumer</option>
              <option value="business">Business</option>
            </select>
          </label>

          {error ? <div className="alert alertError">{error}</div> : null}

          <button className="btn btnPrimary" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 18 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

