import { Router } from "express";
import { z } from "zod";
import { getDbPool } from "../db/pool.js";
import { computeSlotStartsForDay } from "../lib/slotEngine.js";

const router = Router();

const QuerySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function minutesToHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

router.get("/slots", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { serviceId, date } = parsed.data;
  const pool = getDbPool();

  const serviceResult = await pool.query(
    `SELECT id, business_id, duration_minutes FROM services WHERE id = $1;`,
    [serviceId],
  );
  const service = serviceResult.rows[0];
  if (!service) {
    return res.status(404).json({ error: "service_not_found" });
  }

  const businessId = service.business_id;
  const duration = service.duration_minutes;

  const windowsResult = await pool.query(
    `
    SELECT start_minute, end_minute
    FROM availability_windows
    WHERE business_id = $1 AND booking_date = $2::date
    ORDER BY start_minute;
    `,
    [businessId, date],
  );

  const bookingsResult = await pool.query(
    `
    SELECT start_minute, end_minute
    FROM bookings
    WHERE business_id = $1
      AND booking_date = $2::date
      AND status = 'confirmed'
    ORDER BY start_minute;
    `,
    [businessId, date],
  );

  const windows = windowsResult.rows;
  const existingBookings = bookingsResult.rows;

  const starts = computeSlotStartsForDay({ duration, windows, existingBookings });

  const slots = starts.map((start) => ({
    startMinute: start,
    endMinute: start + duration,
    label: `${minutesToHHMM(start)} - ${minutesToHHMM(start + duration)}`,
  }));

  return res.status(200).json({ date, slots });
});

export default router;
