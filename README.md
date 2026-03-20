# Mini Booking System (Piyata Challenge)

This repository contains a small full-stack booking system:

- Frontend: React + Vite
- Backend: Node.js + Express (ESM) with PostgreSQL
- Auth: JWT

## Repo Layout

- `frontend` - React frontend (deployed to Vercel)
- `backend` - Express API + PostgreSQL access (deployed to Railway)

## Architecture Decisions

### Monorepo for submission

Piyata requires a single public GitHub link, so this project uses an npm-workspaces monorepo:

- `frontend` holds the React + Vite frontend
- `backend` holds the Node.js + Express backend

This keeps versioning and environment docs in one place.

### Backend: Express (ESM) + PostgreSQL

Backend is implemented in pure ES modules (no CommonJS) via:

- `backend/package.json` sets `"type": "module"`
- ESM `import`/`export` across the API code

PostgreSQL access is done using the `pg` driver with a simple migration runner (`backend/src/db/migrate.js`).

### Data model (time + availability)

Times are stored as minutes-from-midnight (`0..1440`), using half-open intervals `[start, end)`:

- `availability_windows` represents business-open windows for a specific `booking_date`
- `bookings` represents consumer bookings for a `service` on a specific date

This keeps slot math consistent and avoids off-by-one issues at boundaries.

### Slot generation algorithm (15-minute granularity)

`GET /api/slots?serviceId&date=YYYY-MM-DD`:

1. Loads the service duration and owning business
2. Loads all `availability_windows` for that business + date
3. Loads confirmed bookings for that business + date
4. Generates candidate start times in `15`-minute steps that fully fit inside at least one availability window
5. Filters out any candidate interval that overlaps an existing confirmed booking

The response returns both `startMinute/endMinute` and `startTime/endTime` (HH:MM) for display.

### Booking conflict checks

`POST /api/bookings` (consumer):

1. Verifies the selected service exists and computes `endMinute = startMinute + duration`
2. Ensures the requested interval is fully contained in a business availability window
3. Checks for overlap against existing confirmed bookings for the same business + date
4. Creates the booking with status `confirmed`

Overlap uses the half-open rule: intervals `[aStart,aEnd)` and `[bStart,bEnd)` conflict when
`aStart < bEnd && aEnd > bStart`.

### Pagination + status codes

`GET /api/bookings?page&limit` returns:

- `bookings`
- `page`, `limit`, `totalCount`, `totalPages`

Status codes used:

- `200` for successful reads
- `201` for successful creates
- `400` for invalid payloads/queries
- `401` for missing/invalid JWT
- `403` for role-based forbidden actions
- `404` when requested resources (e.g., service) do not exist
- `409` for booking/availability conflicts

## Local Development

### Requirements

- Node.js 20+ (or compatible)
- PostgreSQL

### Environment variables

Backend (`backend/.env.example`):

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`

Frontend (`frontend/.env.example`):

- `VITE_API_BASE_URL`

### Setup

1. Create a PostgreSQL database
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` + `JWT_SECRET`
3. Run DB migrations:

```bash
node backend/scripts/setup-db.js
```

4. Run the app:

```bash
npm run dev
```

Frontend will be served by Vite, and the API on `PORT` (default `3001`).

## Deployment Notes

### Frontend (Vercel)

- Deploy `frontend`
- Set `VITE_API_BASE_URL` to the deployed API URL

### Backend (Railway)

- Deploy `backend`
- Ensure `DATABASE_URL` and `JWT_SECRET` are configured in Railway
- The backend runs migrations once using `backend/scripts/setup-db.js` (run it during deployment or manually before traffic)

### CORS

Backend supports `CORS_ORIGIN`. Set it to the deployed frontend origin.

