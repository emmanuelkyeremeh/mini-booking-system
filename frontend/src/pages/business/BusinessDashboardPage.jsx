import { useEffect, useState } from "react";
import { createAvailability, createService, listBookings } from "../../api/miniBookingApi.js";

function minutesToHHMM(minute) {
  const hh = Math.floor(minute / 60);
  const mm = minute % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function todayPlusOne() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(value) {
  const [hh, mm] = value.split(":").map((v) => Number(v));
  return hh * 60 + mm;
}

export default function BusinessDashboardPage() {
  const [serviceName, setServiceName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const [serviceSuccess, setServiceSuccess] = useState(null);

  const [bookingDate, setBookingDate] = useState(todayPlusOne());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [availabilitySuccess, setAvailabilitySuccess] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      setBookingsLoading(true);
      setBookingsError(null);
      try {
        const data = await listBookings({ page, limit });
        if (cancelled) return;
        setBookings(data.bookings || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        if (cancelled) return;
        setBookingsError(err?.message || "Failed to load bookings");
      } finally {
        if (!cancelled) setBookingsLoading(false);
      }
    }

    loadBookings();
    return () => {
      cancelled = true;
    };
  }, [page, limit]);

  async function onCreateService(e) {
    e.preventDefault();
    setServiceLoading(true);
    setServiceError(null);
    setServiceSuccess(null);
    try {
      await createService({ name: serviceName, durationMinutes: Number(durationMinutes) });
      setServiceSuccess("Service created.");
      setServiceName("");
    } catch (err) {
      setServiceError(err?.message || "Failed to create service");
    } finally {
      setServiceLoading(false);
    }
  }

  async function onCreateAvailability(e) {
    e.preventDefault();
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setAvailabilitySuccess(null);
    try {
      const startMinute = timeToMinutes(startTime);
      const endMinute = timeToMinutes(endTime);
      await createAvailability({ bookingDate, startMinute, endMinute });
      setAvailabilitySuccess("Availability saved.");
    } catch (err) {
      setAvailabilityError(err?.message || "Failed to save availability");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 className="sectionTitle">Create a service</h2>

        <form onSubmit={onCreateService} className="formGrid">
          <label className="field">
            <span className="label">Service name</span>
            <input className="input" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />
          </label>

          <label className="field">
            <span className="label">Duration (minutes)</span>
            <input
              className="input"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </label>

          {serviceError ? <div className="alert alertError">{serviceError}</div> : null}
          {serviceSuccess ? <div className="alert alertOk">{serviceSuccess}</div> : null}

          <button className="btn btnPrimary" disabled={serviceLoading}>
            {serviceLoading ? "Creating…" : "Create service"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="sectionTitle">Add availability</h2>

        <form onSubmit={onCreateAvailability} className="formGrid">
          <label className="field">
            <span className="label">Date</span>
            <input
              className="input"
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              required
            />
          </label>

          <div className="formGrid formGridTwo">
            <label className="field">
              <span className="label">Start time</span>
              <input
                className="input"
                type="time"
                value={startTime}
                step={900}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="label">End time</span>
              <input
                className="input"
                type="time"
                value={endTime}
                step={900}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>
          </div>

          {availabilityError ? <div className="alert alertError">{availabilityError}</div> : null}
          {availabilitySuccess ? <div className="alert alertOk">{availabilitySuccess}</div> : null}

          <button className="btn btnPrimary" disabled={availabilityLoading}>
            {availabilityLoading ? "Saving…" : "Save availability"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="sectionTitle">Bookings</h2>
        {bookingsLoading ? <p className="muted">Loading bookings…</p> : null}
        {bookingsError ? <div className="alert alertError">{bookingsError}</div> : null}
        {bookings.length === 0 && !bookingsLoading ? <p className="muted">No bookings yet.</p> : null}

        {bookings.length > 0 ? (
          <div className="listGrid" style={{ marginTop: 14 }}>
            {bookings.map((b) => (
              <div key={b.id} className="itemRow">
                <div>
                  <strong>{b.service.name}</strong>
                  <div className="muted">
                    {b.bookingDate} ({minutesToHHMM(b.startMinute)} - {minutesToHHMM(b.endMinute)})
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Consumer: {b.consumerEmail}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{b.status}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span className="muted">
            Page {page} of {totalPages}
          </span>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

