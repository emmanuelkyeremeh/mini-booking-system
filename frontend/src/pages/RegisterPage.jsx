import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import {
  serverIssuesToFieldErrors,
  serverPayloadToFormError,
  validateEmail,
  validatePassword,
} from "../auth/formValidation.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("consumer");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ email: null, password: null, role: null });

  async function onSubmit(e) {
    e.preventDefault();

    setFormError(null);
    setFieldErrors({ email: null, password: null, role: null });

    const nextFieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password, { minLength: 8 }),
      role: role === "consumer" || role === "business" ? null : "Choose a valid role.",
    };

    if (nextFieldErrors.email || nextFieldErrors.password || nextFieldErrors.role) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setLoading(true);
    try {
      await register({ email, password, role });
      navigate("/dashboard");
    } catch (err) {
      const payload = err?.details;

      if (payload?.error === "invalid_request" && Array.isArray(payload.details)) {
        setFieldErrors(serverIssuesToFieldErrors(payload.details));
        setFormError(null);
        return;
      }

      setFieldErrors({ email: null, password: null, role: null });
      setFormError(serverPayloadToFormError(payload) || err?.message || "Register failed");
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
            <span>Create your account</span>
          </div>
        </div>

        <h1 className="sectionTitle">Register</h1>
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
              aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
            />
            {fieldErrors.email ? <div id="register-email-error" className="fieldError">{fieldErrors.email}</div> : null}
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
              aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
            />
            {fieldErrors.password ? (
              <div id="register-password-error" className="fieldError">
                {fieldErrors.password}
              </div>
            ) : null}
          </label>

          <label className="field">
            <span className="label">Role</span>
            <select
              className={`select ${fieldErrors.role ? "inputError" : ""}`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-invalid={Boolean(fieldErrors.role)}
              aria-describedby={fieldErrors.role ? "register-role-error" : undefined}
            >
              <option value="consumer">Consumer</option>
              <option value="business">Business</option>
            </select>
            {fieldErrors.role ? (
              <div id="register-role-error" className="fieldError">
                {fieldErrors.role}
              </div>
            ) : null}
          </label>

          {formError ? <div className="alert alertError">{formError}</div> : null}

          <button className="btn btnPrimary" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 18 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
        </div>
      </div>
    </div>
  );
}

