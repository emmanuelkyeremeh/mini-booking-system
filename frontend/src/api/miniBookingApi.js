import { apiFetch } from "./apiClient.js";

export function listServices() {
  return apiFetch("/api/services", { method: "GET" });
}

export function getSlots({ serviceId, date }) {
  const qs = new URLSearchParams({ serviceId, date }).toString();
  return apiFetch(`/api/slots?${qs}`, { method: "GET" });
}

export function createBooking({ serviceId, bookingDate, startMinute }) {
  return apiFetch("/api/bookings", {
    method: "POST",
    body: { serviceId, bookingDate, startMinute },
  });
}

export function listBookings({ page, limit }) {
  const qs = new URLSearchParams();
  if (page) qs.set("page", String(page));
  if (limit) qs.set("limit", String(limit));
  const query = qs.toString();
  return apiFetch(`/api/bookings${query ? `?${query}` : ""}`, { method: "GET" });
}

export function createService({ name, durationMinutes }) {
  return apiFetch("/api/services", {
    method: "POST",
    body: { name, durationMinutes },
  });
}

export function createAvailability({ bookingDate, startMinute, endMinute }) {
  return apiFetch("/api/availability", {
    method: "POST",
    body: { bookingDate, startMinute, endMinute },
  });
}

