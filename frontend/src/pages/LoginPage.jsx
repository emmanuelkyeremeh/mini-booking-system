import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import {
  serverIssuesToFieldErrors,
  serverPayloadToFormError,
  validateEmail,
  validatePassword,
} from "../auth/formValidation.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ email: null, password: null });

  async function onSubmit(e) {
    e.preventDefault();

    setFormError(null);
    setFieldErrors({ email: null, password: null });

    const nextFieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password, { minLength: 1 }),
    };

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setLoading(true);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      const payload = err?.details;

      if (payload?.error === "invalid_request" && Array.isArray(payload.details)) {
        setFieldErrors(serverIssuesToFieldErrors(payload.details));
        setFormError(null);
        return;
      }

      setFieldErrors({ email: null, password: null });
      setFormError(serverPayloadToFormError(payload) || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authLayout">
        <div className="card authCard">
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
              className={`input ${fieldErrors.email ? "inputError" : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
            />
            {fieldErrors.email ? <div id="login-email-error" className="fieldError">{fieldErrors.email}</div> : null}
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className={`input ${fieldErrors.password ? "inputError" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            />
            {fieldErrors.password ? (
              <div id="login-password-error" className="fieldError">
                {fieldErrors.password}
              </div>
            ) : null}
          </label>

          {formError ? <div className="alert alertError">{formError}</div> : null}

          <button className="btn btnPrimary" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: 18 }}>
          No account? <Link to="/register">Register</Link>
        </p>
        </div>
      </div>
    </div>
  );
}

