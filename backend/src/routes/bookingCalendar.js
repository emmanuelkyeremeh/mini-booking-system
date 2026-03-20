import { Router } from "express";
import { z } from "zod";
import { getDbPool } from "../db/pool.js";
import { computeSlotStartsForDay } from "../lib/slotEngine.js";

const router = Router();

const QuerySchema = z.object({
  serviceId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

function lastDayOfMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

router.get("/booking-calendar", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { serviceId, month } = parsed.data;
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthNum = Number(mStr);
  if (monthNum < 1 || monthNum > 12) {
    return res.status(400).json({ error: "invalid_month" });
  }

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

  const monthIndex0 = monthNum - 1;
  const startDate = `${year}-${pad2(monthNum)}-01`;
  const endDay = lastDayOfMonth(year, monthIndex0);
  const endDate = `${year}-${pad2(monthNum)}-${pad2(endDay)}`;

  const [windowsResult, bookingsResult] = await Promise.all([
    pool.query(
      `
      SELECT booking_date::text AS booking_date, start_minute, end_minute
      FROM availability_windows
      WHERE business_id = $1
        AND booking_date >= $2::date
        AND booking_date <= $3::date
      ORDER BY booking_date, start_minute;
      `,
      [businessId, startDate, endDate],
    ),
    pool.query(
      `
      SELECT booking_date::text AS booking_date, start_minute, end_minute
      FROM bookings
      WHERE business_id = $1
        AND booking_date >= $2::date
        AND booking_date <= $3::date
        AND status = 'confirmed'
      ORDER BY booking_date, start_minute;
      `,
      [businessId, startDate, endDate],
    ),
  ]);

  const windowsByDate = new Map();
  for (const row of windowsResult.rows) {
    const key = row.booking_date;
    if (!windowsByDate.has(key)) windowsByDate.set(key, []);
    windowsByDate.get(key).push({ start_minute: row.start_minute, end_minute: row.end_minute });
  }

  const bookingsByDate = new Map();
  for (const row of bookingsResult.rows) {
    const key = row.booking_date;
    if (!bookingsByDate.has(key)) bookingsByDate.set(key, []);
    bookingsByDate.get(key).push({ start_minute: row.start_minute, end_minute: row.end_minute });
  }

  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= endDay; d += 1) {
    const dateStr = `${year}-${pad2(monthNum)}-${pad2(d)}`;
    const dayDate = new Date(year, monthIndex0, d);
    dayDate.setHours(0, 0, 0, 0);

    if (dayDate < today) {
      days.push({ date: dateStr, status: "past" });
      continue;
    }

    const windows = windowsByDate.get(dateStr) || [];
    if (windows.length === 0) {
      days.push({ date: dateStr, status: "none" });
      continue;
    }

    const existing = bookingsByDate.get(dateStr) || [];
    const starts = computeSlotStartsForDay({ duration, windows, existingBookings: existing });
    days.push({ date: dateStr, status: starts.length > 0 ? "available" : "full" });
  }

  return res.status(200).json({ month, days });
});

export default router;
