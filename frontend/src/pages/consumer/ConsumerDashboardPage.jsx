import { useEffect, useState } from "react";
import { createBooking, getSlots, listBookings, listServices } from "../../api/miniBookingApi.js";

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

export default function ConsumerDashboardPage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(null);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayPlusOne());

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [selectedStartMinute, setSelectedStartMinute] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      setServicesLoading(true);
      setServicesError(null);
      try {
        const data = await listServices();
        if (cancelled) return;
        setServices(data.services || []);
      } catch (err) {
        if (cancelled) return;
        setServicesError(err?.message || "Failed to load services");
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    }

    loadServices();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function onFindSlots(e) {
    e.preventDefault();
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedStartMinute(null);
    try {
      const data = await getSlots({ serviceId: selectedServiceId, date: selectedDate });
      setSlots(data.slots || []);
    } catch (err) {
      setSlotsError(err?.message || "Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }

  const [bookingError, setBookingError] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  async function onBook(e) {
    e.preventDefault();
    if (!selectedStartMinute && selectedStartMinute !== 0) return;
    if (!selectedServiceId) return;

    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(null);
    try {
      await createBooking({
        serviceId: selectedServiceId,
        bookingDate: selectedDate,
        startMinute: selectedStartMinute,
      });
      setBookingSuccess("Booked successfully.");
      setSlots([]);
      setSelectedStartMinute(null);
      setPage(1);
    } catch (err) {
      setBookingError(err?.message || "Failed to create booking");
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 className="sectionTitle">Browse services</h2>

        {servicesLoading ? <p className="muted">Loading services…</p> : null}
        {servicesError ? <div className="alert alertError">{servicesError}</div> : null}

        {!servicesLoading && services.length === 0 ? <p className="muted">No services yet.</p> : null}

        {services.length > 0 ? (
          <div className="serviceGrid" style={{ marginTop: 14 }}>
            {services.map((s) => {
              const active = s.id === selectedServiceId;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`serviceOption ${active ? "serviceOptionActive" : ""}`}
                  onClick={() => setSelectedServiceId(s.id)}
                  aria-pressed={active}
                >
                  <strong>{s.name}</strong>
                  <div className="muted">{s.durationMinutes} min</div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 className="sectionTitle">Book a service</h2>

        <form onSubmit={onFindSlots} className="formGrid" style={{ marginBottom: 10 }}>
          <label className="field">
            <span className="label">Date</span>
            <input className="input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>

          <button className="btn btnPrimary" disabled={!selectedServiceId || slotsLoading}>
            {slotsLoading ? "Finding slots…" : "Find slots"}
          </button>
        </form>

        {slotsError ? <div className="alert alertError">{slotsError}</div> : null}

        {slotsLoading && slots.length === 0 ? <p className="muted">Generating availability…</p> : null}

        {slots.length > 0 ? (
          <form onSubmit={onBook} style={{ marginTop: 18 }}>
            <div className="slotGrid">
              {slots.map((slot) => {
                const active = selectedStartMinute === slot.startMinute;
                return (
                  <label key={slot.startMinute} className={`slotOption ${active ? "slotOptionActive" : ""}`}>
                    <input
                      type="radio"
                      name="slot"
                      checked={active}
                      onChange={() => setSelectedStartMinute(slot.startMinute)}
                    />
                    <span style={{ fontWeight: 700 }}>
                      {slot.startTime} - {slot.endTime}
                    </span>
                  </label>
                );
              })}
            </div>

            <button className="btn btnPrimary" disabled={bookingLoading || selectedStartMinute === null} style={{ marginTop: 14 }}>
              {bookingLoading ? "Booking…" : "Confirm booking"}
            </button>

            {bookingError ? <div className="alert alertError">{bookingError}</div> : null}
            {bookingSuccess ? <div className="alert alertOk">{bookingSuccess}</div> : null}
          </form>
        ) : null}

        {slots.length === 0 && !slotsLoading ? <p className="muted" style={{ marginTop: 12 }}>Pick a service and date to see available slots.</p> : null}
      </div>

      <div className="card">
        <h2 className="sectionTitle">Your bookings</h2>
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
                    Business: {b.businessEmail}
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

