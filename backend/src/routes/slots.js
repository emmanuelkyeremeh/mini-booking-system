import { Router } from "express";
import { z } from "zod";
import { getDbPool } from "../db/pool.js";

const router = Router();

const QuerySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function minutesToHHMM(minute) {
  const m = Math.max(0, Math.min(1440, minute));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  // Treat as [start, end) half-open intervals.
  return !(aEnd <= bStart || aStart >= bEnd);
}

router.get("/slots", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { serviceId, date } = parsed.data;
  const pool = getDbPool();

  const serviceResult = await pool.query(
    `
    SELECT id, business_id, duration_minutes
    FROM services
    WHERE id = $1;
    `,
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
    WHERE business_id = $1 AND booking_date = $2
    ORDER BY start_minute ASC;
    `,
    [businessId, date],
  );
  const windows = windowsResult.rows;

  if (windows.length === 0) {
    return res.status(200).json({ slots: [] });
  }

  const bookingsResult = await pool.query(
    `
    SELECT start_minute, end_minute
    FROM bookings
    WHERE business_id = $1
      AND booking_date = $2
      AND status = 'confirmed';
    `,
    [businessId, date],
  );
  const existing = bookingsResult.rows;

  const step = 15;
  const slotsSet = new Set();

  for (const w of windows) {
    const windowStart = w.start_minute;
    const windowEnd = w.end_minute;
    // Candidate interval must fit inside the window.
    const maxStart = windowEnd - duration;
    if (maxStart < windowStart) continue;

    // Snap first candidate to 15-min step.
    const first = windowStart + ((step - (windowStart % step)) % step);

    for (let start = first; start <= maxStart; start += step) {
      const end = start + duration;
      let overlaps = false;
      for (const b of existing) {
        if (intervalsOverlap(start, end, b.start_minute, b.end_minute)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        slotsSet.add(start);
      }
    }
  }

  const slots = Array.from(slotsSet)
    .sort((a, b) => a - b)
    .map((startMinute) => ({
      startMinute,
      startTime: minutesToHHMM(startMinute),
      endTime: minutesToHHMM(startMinute + duration),
    }));

  return res.status(200).json({ slots });
});

export default router;

