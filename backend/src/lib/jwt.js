import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

export function signAccessToken(payload) {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyAccessToken(token) {
  const env = getEnv();
  return jwt.verify(token, env.JWT_SECRET);
}

