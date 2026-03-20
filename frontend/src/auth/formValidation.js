const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  if (!email) return "Email is required.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password, { minLength = 8 } = {}) {
  if (!password) return "Password is required.";
  if (password.length < minLength) return `Password must be at least ${minLength} characters.`;
  return null;
}

export function serverIssuesToFieldErrors(issues) {
  const next = {};
  if (!Array.isArray(issues)) return next;

  for (const issue of issues) {
    // Zod issues have shape { path: ['email'], message: '...' }
    const key = Array.isArray(issue?.path) ? issue.path[0] : null;
    if (!key) continue;
    next[key] = issue?.message || "Invalid value.";
  }

  return next;
}

export function serverPayloadToFormError(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.error === "email_in_use") return "That email is already registered.";
  if (payload.error === "invalid_credentials") return "Email or password is incorrect.";
  if (payload.error === "server_error") return "Something went wrong. Please try again.";
  if (payload.error === "unauthorized") return "Please log in again.";

  // Fallback: show error code.
  if (typeof payload.error === "string") return payload.error;
  return null;
}

