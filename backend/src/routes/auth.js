import { Router } from "express";
import { z } from "zod";
import { getDbPool } from "../db/pool.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAccessToken } from "../lib/jwt.js";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["business", "consumer"]),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { email, password, role } = parsed.data;
  const pool = getDbPool();

  const passwordHash = await hashPassword(password);

  try {
    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id, email, role;
      `,
      [email, passwordHash, role],
    );

    const user = result.rows[0];
    const token = signAccessToken({ userId: user.id, role: user.role, email: user.email });

    return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    // Unique email constraint violation.
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "email_in_use" });
    }
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { email, password } = parsed.data;
  const pool = getDbPool();

  try {
    const result = await pool.query(`SELECT id, email, role, password_hash FROM users WHERE email = $1;`, [
      email,
    ]);

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const token = signAccessToken({ userId: user.id, role: user.role, email: user.email });
    return res.status(200).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;

