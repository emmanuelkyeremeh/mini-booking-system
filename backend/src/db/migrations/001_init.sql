-- Core schema for the Mini Booking System.
-- Notes:
-- - We store times as minutes-from-midnight (0..1440).
-- - Availability is date-specific and independent of service duration.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('business', 'consumer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_date DATE NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute <= 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute >= 0 AND end_minute <= 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_minute < end_minute),
  UNIQUE (business_id, booking_date, start_minute, end_minute)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  business_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_date DATE NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute <= 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute >= 0 AND end_minute <= 1440),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_minute < end_minute)
);

CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_availability_business_date ON availability_windows(business_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_business_date ON bookings(business_id, booking_date);

