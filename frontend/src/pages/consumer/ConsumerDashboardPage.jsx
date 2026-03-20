import { useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { createBooking, getBookingCalendar, getSlots, listBookings, listServices } from "../../api/miniBookingApi.js";

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

function formatMonthYYYYMM(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateFromYYYYMMDD(s) {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export default function ConsumerDashboardPage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(null);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  const [dayStatusByDate, setDayStatusByDate] = useState(() => new Map());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(null);

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

  const [bookingError, setBookingError] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);

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
  }, [page, limit, bookingsRefreshKey]);

  useEffect(() => {
    if (!selectedServiceId) {
      setDayStatusByDate(new Map());
      setCalendarError(null);
      setCalendarLoading(false);
      return;
    }

    let cancelled = false;
    const month = formatMonthYYYYMM(calendarMonth);

    async function loadCalendar() {
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const data = await getBookingCalendar({ serviceId: selectedServiceId, month });
        if (cancelled) return;
        const next = new Map();
        for (const d of data.days || []) {
          next.set(d.date, d.status);
        }
        setDayStatusByDate(next);

        const todayStr = formatLocalDateYYYYMMDD(new Date());
        setSelectedDate((prev) => {
          const prevKey = prev ? formatLocalDateYYYYMMDD(prev) : "";
          if (prevKey && next.get(prevKey) === "available") return prev;
          const candidates = (data.days || [])
            .filter((d) => d.status === "available" && d.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
          if (candidates[0]) return dateFromYYYYMMDD(candidates[0].date);
          return null;
        });
      } catch (err) {
        if (cancelled) return;
        setDayStatusByDate(new Map());
        setCalendarError(err?.message || "Failed to load calendar");
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }

    loadCalendar();
    return () => {
      cancelled = true;
    };
  }, [selectedServiceId, calendarMonth, calendarRefreshKey]);

  const loadSlotsForDate = useCallback(
    async (date) => {
      if (!selectedServiceId || !date) return;
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedStartMinute(null);
      try {
        const data = await getSlots({
          serviceId: selectedServiceId,
          date: formatLocalDateYYYYMMDD(date),
        });
        setSlots(data.slots || []);
      } catch (err) {
        setSlotsError(err?.message || "Failed to load slots");
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [selectedServiceId],
  );

  useEffect(() => {
    if (!selectedServiceId || !selectedDate) {
      setSlots([]);
      setSelectedStartMinute(null);
      return;
    }
    const key = formatLocalDateYYYYMMDD(selectedDate);
    if (dayStatusByDate.get(key) !== "available") return;
    loadSlotsForDate(selectedDate);
  }, [selectedServiceId, selectedDate, dayStatusByDate, loadSlotsForDate]);

  const dayClassName = useCallback(
    (date) => {
      const key = formatLocalDateYYYYMMDD(date);
      const status = dayStatusByDate.get(key);
      if (status === "available") return "booking-cal-day booking-cal-day--available";
      if (status === "full") return "booking-cal-day booking-cal-day--full";
      if (status === "none") return "booking-cal-day booking-cal-day--none";
      if (status === "past") return "booking-cal-day booking-cal-day--past";
      return "booking-cal-day";
    },
    [dayStatusByDate],
  );

  const filterSelectableDate = useCallback(
    (date) => {
      const key = formatLocalDateYYYYMMDD(date);
      return dayStatusByDate.get(key) === "available";
    },
    [dayStatusByDate],
  );

  const onCalendarChange = (date) => {
    if (!date) return;
    setSelectedDate(date);
    setBookingSuccess(null);
    setBookingError(null);
  };

  const onMonthChange = (date) => {
    setCalendarMonth(startOfMonth(date));
  };

  const selectedServiceLabel = useMemo(() => {
    const s = services.find((x) => x.id === selectedServiceId);
    return s ? s.name : "";
  }, [services, selectedServiceId]);

  async function onBook(e) {
    e.preventDefault();
    if (!selectedStartMinute && selectedStartMinute !== 0) return;
    if (!selectedServiceId) return;
    if (!selectedDate) return;

    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(null);
    try {
      await createBooking({
        serviceId: selectedServiceId,
        bookingDate: formatLocalDateYYYYMMDD(selectedDate),
        startMinute: selectedStartMinute,
      });
      setBookingSuccess("Booked successfully.");
      setSlots([]);
      setSelectedStartMinute(null);
      setPage(1);
      setCalendarRefreshKey((k) => k + 1);
      setBookingsRefreshKey((k) => k + 1);
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
                  onClick={() => {
                    setSelectedServiceId(s.id);
                    setSlots([]);
                    setSelectedStartMinute(null);
                    setBookingSuccess(null);
                    setBookingError(null);
                  }}
                  aria-pressed={active}
                >
                  <strong>{s.name}</strong>
                  <div className="muted">
                    {s.durationMinutes} min
                    {s.businessEmail ? ` · ${s.businessEmail}` : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 className="sectionTitle">Book a service</h2>

        {!selectedServiceId ? (
          <p className="muted">Select a service above to see the calendar and available days.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {selectedServiceLabel ? (
                <>
                  Booking <strong>{selectedServiceLabel}</strong>. Green days have open times; grey days are full; light days are not on the schedule.
                </>
              ) : null}
            </p>

            {calendarError ? <div className="alert alertError">{calendarError}</div> : null}
            {calendarLoading ? <p className="muted">Loading availability…</p> : null}

            <div className="bookingCalWrap">
              <DatePicker
                inline
                calendarClassName="bookingCal"
                selected={selectedDate}
                onChange={onCalendarChange}
                onMonthChange={onMonthChange}
                openToDate={calendarMonth}
                minDate={new Date()}
                filterDate={filterSelectableDate}
                dayClassName={dayClassName}
                dateFormat="dd/MM/yyyy"
                placeholderText="Pick a green day"
              />
            </div>

            {!calendarLoading && selectedServiceId && selectedDate === null ? (
              <p className="muted" style={{ marginTop: 12 }}>
                No bookable days in this month. Try another month or ask the business to add availability.
              </p>
            ) : null}

            <div className="bookingCalLegend" aria-label="Calendar legend">
              <span className="bookingCalLegendItem">
                <span className="bookingCalSwatch bookingCalSwatch--available" /> Available
              </span>
              <span className="bookingCalLegendItem">
                <span className="bookingCalSwatch bookingCalSwatch--full" /> Unavailable / filled
              </span>
              <span className="bookingCalLegendItem">
                <span className="bookingCalSwatch bookingCalSwatch--none" /> Not scheduled
              </span>
            </div>

            {slotsError ? <div className="alert alertError">{slotsError}</div> : null}

            {slotsLoading && slots.length === 0 ? <p className="muted">Loading times for this day…</p> : null}

            {slots.length > 0 ? (
              <form onSubmit={onBook} style={{ marginTop: 18 }}>
                <p className="label" style={{ marginBottom: 8 }}>
                  Times on {selectedDate ? formatLocalDateYYYYMMDD(selectedDate) : ""}
                </p>
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
                        <span style={{ fontWeight: 700 }}>{slot.label || `${minutesToHHMM(slot.startMinute)} - ${minutesToHHMM(slot.endMinute)}`}</span>
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

            {!slotsLoading && selectedDate && dayStatusByDate.get(formatLocalDateYYYYMMDD(selectedDate)) === "available" && slots.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                No open times left on this day.
              </p>
            ) : null}

            {selectedDate && dayStatusByDate.get(formatLocalDateYYYYMMDD(selectedDate)) === "full" ? (
              <p className="muted" style={{ marginTop: 12 }}>
                This day is fully booked. Try another green day.
              </p>
            ) : null}
          </>
        )}
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
