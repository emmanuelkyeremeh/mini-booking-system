const TOKEN_KEY = "mini_booking_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch(path, { method = "GET", body } = {}) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  const url = `${baseUrl}${path}`;

  const headers = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.ok) {
    // Some endpoints are pure-JSON always; still, handle empty bodies.
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // ignore
  }

  const message =
    payload?.error === "invalid_request"
      ? "Invalid request."
      : payload?.error
        ? `Request failed: ${payload.error}`
        : `Request failed with status ${res.status}`;

  throw new ApiError(message, { status: res.status, details: payload });
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

