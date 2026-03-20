import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getDbPool } from "../src/db/pool.js";

function toISODatePlusOne(d = new Date()) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + 1);
  // Backend stores booking_date as a DATE and expects YYYY-MM-DD.
  return copy.toISOString().slice(0, 10);
}

function minutesFromHHMM(hhmm) {
  const [hh, mm] = hhmm.split(":").map((v) => Number(v));
  return hh * 60 + mm;
}

function randEmail(prefix) {
  const suffix = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${suffix}@example.com`;
}

const app = createApp();

async function clearCoreTables() {
  const pool = getDbPool();
  await pool.query("DELETE FROM bookings;");
  await pool.query("DELETE FROM availability_windows;");
  await pool.query("DELETE FROM services;");
}

async function registerUser({ email, password, role }) {
  const res = await request(app).post("/api/auth/register").send({ email, password, role });
  assert.equal(res.status, 201);
  assert.ok(res.body?.token, "Expected auth token");
  return res.body;
}

test("availability cannot be created without a service", async () => {
  await clearCoreTables();

  const date = toISODatePlusOne();
  const biz = await registerUser({
    email: randEmail("biz"),
    password: "Piyata!2345",
    role: "business",
  });

  const res = await request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({
      bookingDate: date,
      startMinute: minutesFromHHMM("09:00"),
      endMinute: minutesFromHHMM("10:00"),
    });

  assert.equal(res.status, 400);
  assert.equal(res.body?.error, "service_required");
});

test("full booking flow: service -> availability -> slots -> booking -> bookings list", async () => {
  await clearCoreTables();

  const date = toISODatePlusOne();
  const password = "Piyata!2345";

  const biz = await registerUser({ email: randEmail("biz"), password, role: "business" });
  const consumer = await registerUser({ email: randEmail("consumer"), password, role: "consumer" });

  const serviceRes = await request(app)
    .post("/api/services")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({ name: "Consultation", durationMinutes: 60 });
  assert.equal(serviceRes.status, 201);

  const serviceId = serviceRes.body?.service?.id;
  assert.ok(serviceId, "Expected created service id");

  const availRes = await request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({
      bookingDate: date,
      startMinute: minutesFromHHMM("09:00"),
      endMinute: minutesFromHHMM("10:00"),
    });
  assert.equal(availRes.status, 201);

  const slotsRes = await request(app)
    .get(`/api/slots?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`)
    .set("Authorization", `Bearer ${consumer.token}`);
  assert.equal(slotsRes.status, 200);
  assert.ok(Array.isArray(slotsRes.body?.slots), "Expected slots array");
  assert.ok(slotsRes.body.slots.length > 0, "Expected at least one slot");

  const chosen = slotsRes.body.slots[0];
  assert.ok(typeof chosen.startMinute === "number");

  const bookRes = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${consumer.token}`)
    .send({ serviceId, bookingDate: date, startMinute: chosen.startMinute });
  assert.equal(bookRes.status, 201);

  const listRes = await request(app)
    .get("/api/bookings?page=1&limit=5")
    .set("Authorization", `Bearer ${consumer.token}`);
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body?.bookings));
  assert.ok(listRes.body.bookings.length >= 1, "Expected booking in list");
  assert.equal(listRes.body.bookings[0].status, "confirmed");
});

test("booking overlap returns 409 time_slot_unavailable", async () => {
  await clearCoreTables();

  const date = toISODatePlusOne();
  const password = "Piyata!2345";

  const biz = await registerUser({ email: randEmail("biz"), password, role: "business" });
  const consumer = await registerUser({ email: randEmail("consumer"), password, role: "consumer" });

  const serviceRes = await request(app)
    .post("/api/services")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({ name: "Consultation", durationMinutes: 60 });
  const serviceId = serviceRes.body?.service?.id;
  assert.ok(serviceId);

  // Two overlapping 60-min slots exist inside 09:00-11:00.
  await request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({
      bookingDate: date,
      startMinute: minutesFromHHMM("09:00"),
      endMinute: minutesFromHHMM("11:00"),
    });

  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${consumer.token}`)
    .send({ serviceId, bookingDate: date, startMinute: minutesFromHHMM("09:00") });

  const res2 = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${consumer.token}`)
    .send({ serviceId, bookingDate: date, startMinute: minutesFromHHMM("09:15") });

  assert.equal(res2.status, 409);
  assert.equal(res2.body?.error, "time_slot_unavailable");
});

test("booking-calendar marks day as available then full after booking", async () => {
  await clearCoreTables();

  const date = toISODatePlusOne();
  const month = date.slice(0, 7); // YYYY-MM
  const password = "Piyata!2345";

  const biz = await registerUser({ email: randEmail("biz"), password, role: "business" });
  const consumer = await registerUser({ email: randEmail("consumer"), password, role: "consumer" });

  const serviceRes = await request(app)
    .post("/api/services")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({ name: "Consultation", durationMinutes: 60 });
  const serviceId = serviceRes.body?.service?.id;
  assert.ok(serviceId);

  // Only one 60-min slot exists: 09:00-10:00.
  await request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${biz.token}`)
    .send({
      bookingDate: date,
      startMinute: minutesFromHHMM("09:00"),
      endMinute: minutesFromHHMM("10:00"),
    });

  const cal1 = await request(app)
    .get(`/api/booking-calendar?serviceId=${encodeURIComponent(serviceId)}&month=${encodeURIComponent(month)}`)
    .set("Authorization", `Bearer ${consumer.token}`);
  assert.equal(cal1.status, 200);

  const day1 = (cal1.body?.days || []).find((d) => d.date === date);
  assert.ok(day1, "Expected calendar day entry");
  assert.equal(day1.status, "available");

  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${consumer.token}`)
    .send({ serviceId, bookingDate: date, startMinute: minutesFromHHMM("09:00") });

  const cal2 = await request(app)
    .get(`/api/booking-calendar?serviceId=${encodeURIComponent(serviceId)}&month=${encodeURIComponent(month)}`)
    .set("Authorization", `Bearer ${consumer.token}`);
  assert.equal(cal2.status, 200);

  const day2 = (cal2.body?.days || []).find((d) => d.date === date);
  assert.ok(day2);
  assert.equal(day2.status, "full");
});

test("consumer cannot create a service (403)", async () => {
  await clearCoreTables();

  const password = "Piyata!2345";
  const consumer = await registerUser({ email: randEmail("consumer"), password, role: "consumer" });

  const res = await request(app)
    .post("/api/services")
    .set("Authorization", `Bearer ${consumer.token}`)
    .send({ name: "Consultation", durationMinutes: 60 });

  assert.equal(res.status, 403);
  assert.equal(res.body?.error, "forbidden");
});

