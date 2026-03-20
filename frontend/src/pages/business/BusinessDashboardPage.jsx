import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { createAvailability, createService, listBookings, listServices } from "../../api/miniBookingApi.js";
import { useAuth } from "../../auth/authContext.js";

function minutesToHHMM(minute) {
  const hh = Math.floor(minute / 60);
  const mm = minute % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatLocalDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDayKey(date) {
  // Normalize to local midnight so day-matching works even if Date instances differ.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d.getTime();
}

function uniqueSortedDays(dates) {
  const map = new Map();
  for (const d of dates || []) {
    map.set(normalizeDayKey(d), d);
  }
  return Array.from(map.values()).sort(
    (a, b) => normalizeDayKey(a) - normalizeDayKey(b),
  );
}

function timeToMinutes(value) {
  const [hh, mm] = value.split(":").map((v) => Number(v));
  return hh * 60 + mm;
}

export default function BusinessDashboardPage() {
  const { user } = useAuth();

  const [serviceName, setServiceName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const [serviceSuccess, setServiceSuccess] = useState(null);

  const [myServices, setMyServices] = useState([]);
  const [myServicesLoading, setMyServicesLoading] = useState(false);
  const [myServicesError, setMyServicesError] = useState(null);

  const [bookingDates, setBookingDates] = useState([]);
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

  useEffect(() => {
    let cancelled = false;

    async function loadMyServices() {
      if (!user?.id) return;
      setMyServicesLoading(true);
      setMyServicesError(null);
      try {
        const data = await listServices();
        if (cancelled) return;
        const mine = (data.services || []).filter((s) => s.businessId === user.id);
        setMyServices(mine);
      } catch (err) {
        if (cancelled) return;
        setMyServicesError(err?.message || "Failed to load services");
        setMyServices([]);
      } finally {
        if (!cancelled) setMyServicesLoading(false);
      }
    }

    loadMyServices();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const hasServices = myServices.length > 0;

  async function onCreateService(e) {
    e.preventDefault();
    setServiceLoading(true);
    setServiceError(null);
    setServiceSuccess(null);
    try {
      await createService({ name: serviceName, durationMinutes: Number(durationMinutes) });
      setServiceSuccess("Service created.");
      setServiceName("");

      if (user?.id) {
        try {
          const data = await listServices();
          const mine = (data.services || []).filter((s) => s.businessId === user.id);
          setMyServices(mine);
        } catch {
          // Non-fatal: backend rule will still enforce availability creation.
        }
      }
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
      if (myServicesLoading) {
        setAvailabilityError("Loading services, try again in a moment.");
        return;
      }
      if (!hasServices) {
        setAvailabilityError("Create a service before adding availability.");
        return;
      }
      if (!bookingDates?.length) {
        setAvailabilityError("Please choose at least one date.");
        return;
      }
      const startMinute = timeToMinutes(startTime);
      const endMinute = timeToMinutes(endTime);
      if (endMinute <= startMinute) {
        setAvailabilityError("End time must be after start time.");
        return;
      }

      // Save one availability row per selected date.
      for (const d of bookingDates) {
        await createAvailability({
          bookingDate: formatLocalDateYYYYMMDD(d),
          startMinute,
          endMinute,
        });
      }
      setAvailabilitySuccess("Availability saved.");
      setBookingDates([]);
    } catch (err) {
      const code = err?.details?.error || err?.status;
      if (code === "service_required") {
        setAvailabilityError("Create a service before adding availability.");
      } else {
        setAvailabilityError(err?.message || "Failed to save availability");
      }
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
            <div className="durationControl" role="group" aria-label="Duration minutes">
              <button
                type="button"
                className="durationBtn"
                onClick={() => setDurationMinutes((v) => Math.max(15, Number(v) - 15))}
                aria-label="Decrease duration"
              >
                -
              </button>
              <input className="input durationInput" value={durationMinutes} readOnly aria-label="Duration value" />
              <button
                type="button"
                className="durationBtn"
                onClick={() => setDurationMinutes((v) => Math.min(240, Number(v) + 15))}
                aria-label="Increase duration"
              >
                +
              </button>
            </div>
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

          <div className="field" style={{ marginTop: 6 }}>
            <span className="label">Select dates (multiple)</span>
            <div className="businessCalWrap">
              <DatePicker
                inline
                calendarClassName="businessCal"
                selectsMultiple
                selectedDates={bookingDates}
                onChange={(dates) => {
                  const rawDates = dates
                    ? Array.isArray(dates)
                      ? dates
                      : [dates]
                    : [];
                  const nextDates = uniqueSortedDays(rawDates);

                  const currKeys = uniqueSortedDays(bookingDates).map(normalizeDayKey);
                  const nextKeys = nextDates.map(normalizeDayKey);

                  const same =
                    currKeys.length === nextKeys.length &&
                    currKeys.every((k, idx) => k === nextKeys[idx]);

                  if (!same) setBookingDates(nextDates);
                }}
                minDate={new Date()}
                dateFormat="dd/MM/yyyy"
                disabled={!hasServices || myServicesLoading}
              />
            </div>
          </div>

          {!hasServices && !myServicesLoading ? (
            <p className="muted" style={{ marginTop: 6 }}>
              Create a service first to unlock availability.
            </p>
          ) : null}
          {myServicesError ? <div className="alert alertError">{myServicesError}</div> : null}

          {availabilityError ? <div className="alert alertError">{availabilityError}</div> : null}
          {availabilitySuccess ? <div className="alert alertOk">{availabilitySuccess}</div> : null}

          <button className="btn btnPrimary" disabled={availabilityLoading || !hasServices}>
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

