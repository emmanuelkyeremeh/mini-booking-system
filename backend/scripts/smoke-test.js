// Manual end-to-end smoke test for the Mini Booking System.
// Usage (in a separate terminal):
//   1) Ensure Postgres is available and API env is configured
//   2) Run DB migrations (see setup-db.js)
//   3) Start API (npm run dev in backend, or npm run dev at repo root)
//   4) Run: node backend/scripts/smoke-test.js

function toISODate(d) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + 1);
  return copy.toISOString().slice(0, 10);
}

function timeToMinutes(hhmm) {
  const [hh, mm] = hhmm.split(":").map((v) => Number(v));
  return hh * 60 + mm;
}

async function postJson(url, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.error ? `POST ${url} failed: ${payload.error}` : `POST ${url} failed`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

async function getJson(url, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "GET", headers });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.error ? `GET ${url} failed: ${payload.error}` : `GET ${url} failed`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

async function main() {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3001";
  const date = toISODate(new Date());

  const startMinute = timeToMinutes("09:00");
  const endMinute = timeToMinutes("10:00");

  const timestamp = Date.now();
  const bizEmail = `biz_${timestamp}@example.com`;
  const consumerEmail = `consumer_${timestamp}@example.com`;
  const password = "Piyata!2345";

  console.log("1) Register business + consumer");
  const bizReg = await postJson(`${baseUrl}/api/auth/register`, null, {
    email: bizEmail,
    password,
    role: "business",
  });
  const consumerReg = await postJson(`${baseUrl}/api/auth/register`, null, {
    email: consumerEmail,
    password,
    role: "consumer",
  });

  console.log("2) Create service + availability (business)");
  const bizToken = bizReg.token;
  const service = await postJson(`${baseUrl}/api/services`, bizToken, {
    name: "Consultation",
    durationMinutes: 60,
  });
  const serviceId = service.service.id;

  await postJson(`${baseUrl}/api/availability`, bizToken, {
    bookingDate: date,
    startMinute,
    endMinute,
  });

  console.log("3) Fetch slots (consumer)");
  const consumerToken = consumerReg.token;
  const slotsPayload = await getJson(
    `${baseUrl}/api/slots?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
    consumerToken,
  );
  const slots = slotsPayload.slots || [];
  if (slots.length === 0) throw new Error("No slots returned; check availability/windows logic.");
  const chosen = slots[0];

  console.log("4) Book a slot (consumer)");
  await postJson(`${baseUrl}/api/bookings`, consumerToken, {
    serviceId,
    bookingDate: date,
    startMinute: chosen.startMinute,
  });

  console.log("5) List bookings (consumer)");
  const listPayload = await getJson(`${baseUrl}/api/bookings?page=1&limit=5`, consumerToken);
  if (!Array.isArray(listPayload.bookings) || listPayload.bookings.length === 0) {
    throw new Error("Booking was created but no bookings returned.");
  }

  const created = listPayload.bookings[0];
  console.log("Smoke test passed.");
  console.log({
    serviceName: created.service?.name,
    bookingDate: created.bookingDate,
    startMinute: created.startMinute,
    endMinute: created.endMinute,
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Smoke test failed:", err?.message || err);
  if (err?.status) {
    // eslint-disable-next-line no-console
    console.error("HTTP status:", err.status);
  }
  process.exit(1);
});

