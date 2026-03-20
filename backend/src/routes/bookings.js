import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { getDbPool } from "../db/pool.js";

const router = Router();

const BookingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateBookingSchema = z.object({
  serviceId: z.string().uuid(),
  bookingDate: BookingDateSchema,
  startMinute: z.number().int().min(0).max(1440),
});

const ListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1))
    .refine((n) => Number.isInteger(n) && n >= 1, "page must be >= 1"),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 10))
    .refine((n) => Number.isInteger(n) && n >= 1 && n <= 50, "limit must be 1..50"),
});

router.post("/bookings", requireAuth, async (req, res) => {
  const parsed = CreateBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  if (req.user.role !== "consumer") {
    return res.status(403).json({ error: "forbidden" });
  }

  const { serviceId, bookingDate, startMinute } = parsed.data;
  const pool = getDbPool();

  try {
    const serviceResult = await pool.query(
      `
      SELECT id, business_id, duration_minutes
      FROM services
      WHERE id = $1;
      `,
      [serviceId],
    );
    const service = serviceResult.rows[0];
    if (!service) return res.status(404).json({ error: "service_not_found" });

    const duration = service.duration_minutes;
    const endMinute = startMinute + duration;
    if (startMinute < 0 || endMinute > 1440 || startMinute >= endMinute) {
      return res.status(400).json({ error: "invalid_time_range" });
    }
    if (startMinute % 15 !== 0) {
      return res.status(400).json({ error: "start_must_align_to_15_minutes" });
    }

    // Ensure the requested interval fits inside at least one availability window.
    const availabilityResult = await pool.query(
      `
      SELECT 1
      FROM availability_windows
      WHERE business_id = $1
        AND booking_date = $2
        AND start_minute <= $3
        AND end_minute >= $4
      LIMIT 1;
      `,
      [service.business_id, bookingDate, startMinute, endMinute],
    );
    if (availabilityResult.rowCount === 0) {
      return res.status(409).json({ error: "not_within_availability" });
    }

    // Conflict check: no overlap with confirmed bookings for the same business/date.
    const conflictResult = await pool.query(
      `
      SELECT 1
      FROM bookings
      WHERE business_id = $1
        AND booking_date = $2
        AND status = 'confirmed'
        AND start_minute < $4
        AND end_minute > $3
      LIMIT 1;
      `,
      [service.business_id, bookingDate, startMinute, endMinute],
    );
    if (conflictResult.rowCount > 0) {
      return res.status(409).json({ error: "time_slot_unavailable" });
    }

    const insertResult = await pool.query(
      `
      INSERT INTO bookings (consumer_id, service_id, business_id, booking_date, start_minute, end_minute, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
      RETURNING id, consumer_id, service_id, business_id, booking_date, start_minute, end_minute, status;
      `,
      [req.user.id, serviceId, service.business_id, bookingDate, startMinute, endMinute],
    );

    const b = insertResult.rows[0];
    return res.status(201).json({
      booking: {
        id: b.id,
        consumerId: b.consumer_id,
        serviceId: b.service_id,
        businessId: b.business_id,
        bookingDate: b.booking_date,
        startMinute: b.start_minute,
        endMinute: b.end_minute,
        status: b.status,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/bookings", requireAuth, async (req, res) => {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const pool = getDbPool();

  try {
    if (req.user.role === "consumer") {
      const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM bookings WHERE consumer_id = $1;`, [
        req.user.id,
      ]);
      const totalCount = countResult.rows[0].count;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      const bookingsResult = await pool.query(
        `
        SELECT
          b.id,
          b.booking_date,
          b.start_minute,
          b.end_minute,
          b.status,
          s.name AS service_name,
          s.duration_minutes,
          biz.email AS business_email
        FROM bookings b
        JOIN services s ON s.id = b.service_id
        JOIN users biz ON biz.id = b.business_id
        WHERE b.consumer_id = $1
        ORDER BY b.created_at DESC
        LIMIT $2 OFFSET $3;
        `,
        [req.user.id, limit, offset],
      );

      return res.status(200).json({
        bookings: bookingsResult.rows.map((b) => ({
          id: b.id,
          bookingDate: b.booking_date,
          startMinute: b.start_minute,
          endMinute: b.end_minute,
          status: b.status,
          service: { name: b.service_name, durationMinutes: b.duration_minutes },
          businessEmail: b.business_email,
        })),
        page,
        limit,
        totalCount,
        totalPages,
      });
    }

    if (req.user.role === "business") {
      const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM bookings WHERE business_id = $1;`, [
        req.user.id,
      ]);
      const totalCount = countResult.rows[0].count;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      const bookingsResult = await pool.query(
        `
        SELECT
          b.id,
          b.booking_date,
          b.start_minute,
          b.end_minute,
          b.status,
          s.name AS service_name,
          s.duration_minutes,
          consumer.email AS consumer_email
        FROM bookings b
        JOIN services s ON s.id = b.service_id
        JOIN users consumer ON consumer.id = b.consumer_id
        WHERE b.business_id = $1
        ORDER BY b.created_at DESC
        LIMIT $2 OFFSET $3;
        `,
        [req.user.id, limit, offset],
      );

      return res.status(200).json({
        bookings: bookingsResult.rows.map((b) => ({
          id: b.id,
          bookingDate: b.booking_date,
          startMinute: b.start_minute,
          endMinute: b.end_minute,
          status: b.status,
          service: { name: b.service_name, durationMinutes: b.duration_minutes },
          consumerEmail: b.consumer_email,
        })),
        page,
        limit,
        totalCount,
        totalPages,
      });
    }

    // Should be unreachable due to auth token signer.
    return res.status(403).json({ error: "forbidden" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;

