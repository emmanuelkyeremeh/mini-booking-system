import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { getDbPool } from "../db/pool.js";

const router = Router();

const CreateServiceSchema = z.object({
  name: z.string().min(2).max(120),
  durationMinutes: z.number().int().positive().max(24 * 60),
});

router.post("/services", requireAuth, async (req, res) => {
  const parsed = CreateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  if (req.user.role !== "business") {
    return res.status(403).json({ error: "forbidden" });
  }

  const { name, durationMinutes } = parsed.data;
  const pool = getDbPool();

  try {
    const result = await pool.query(
      `
      INSERT INTO services (business_id, name, duration_minutes)
      VALUES ($1, $2, $3)
      RETURNING id, business_id, name, duration_minutes;
      `,
      [req.user.id, name, durationMinutes],
    );

    const service = result.rows[0];
    return res
      .status(201)
      .json({ service: { id: service.id, businessId: service.business_id, name: service.name, durationMinutes: service.duration_minutes } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/services", async (_req, res) => {
  const pool = getDbPool();
  try {
    const result = await pool.query(
      `
      SELECT id, business_id, name, duration_minutes
      FROM services
      ORDER BY created_at DESC;
      `,
    );

    const services = result.rows.map((s) => ({
      id: s.id,
      businessId: s.business_id,
      name: s.name,
      durationMinutes: s.duration_minutes,
    }));
    return res.status(200).json({ services });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;

