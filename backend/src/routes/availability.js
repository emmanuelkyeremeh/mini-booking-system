import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { getDbPool } from "../db/pool.js";

const router = Router();

const BookingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "bookingDate must be YYYY-MM-DD");

const AvailabilitySchema = z.object({
  bookingDate: BookingDateSchema,
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

function isAlignedTo15(minute) {
  return minute % 15 === 0;
}

router.post("/availability", requireAuth, async (req, res) => {
  const parsed = AvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  if (req.user.role !== "business") {
    return res.status(403).json({ error: "forbidden" });
  }

  const { bookingDate, startMinute, endMinute } = parsed.data;

  if (startMinute >= endMinute) {
    return res.status(400).json({ error: "invalid_time_range" });
  }
  if (!isAlignedTo15(startMinute) || !isAlignedTo15(endMinute)) {
    return res.status(400).json({ error: "time_must_align_to_15_minutes" });
  }

  const pool = getDbPool();
  try {
    // Product rule: business must create at least one service before adding availability.
    const serviceCheck = await pool.query(
      `SELECT 1 FROM services WHERE business_id = $1 LIMIT 1;`,
      [req.user.id],
    );
    if (serviceCheck.rowCount === 0) {
      return res.status(400).json({ error: "service_required" });
    }

    const result = await pool.query(
      `
      INSERT INTO availability_windows (business_id, booking_date, start_minute, end_minute)
      VALUES ($1, $2, $3, $4)
      RETURNING id, booking_date, start_minute, end_minute;
      `,
      [req.user.id, bookingDate, startMinute, endMinute],
    );

    const row = result.rows[0];
    return res.status(201).json({
      availability: {
        id: row.id,
        bookingDate: row.booking_date,
        startMinute: row.start_minute,
        endMinute: row.end_minute,
      },
    });
  } catch (err) {
    // Unique window conflict (same date + identical interval).
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "availability_already_exists" });
    }

    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;

