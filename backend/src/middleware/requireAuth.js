import { verifyAccessToken } from "../lib/jwt.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const decoded = verifyAccessToken(token);
    // decoded is controlled by our own signer, but keep shape checks.
    if (!decoded || typeof decoded !== "object" || !decoded.userId || !decoded.role) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.user = {
      id: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

