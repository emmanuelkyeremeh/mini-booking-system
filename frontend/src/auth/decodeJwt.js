export function decodeJwt(token) {
  // JWT is three base64url segments: header.payload.signature.
  // We only decode (no verification) since backend enforces integrity.
  const parts = token.split(".");
  if (parts.length < 2) return null;

  const payload = parts[1];
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(padded);
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

