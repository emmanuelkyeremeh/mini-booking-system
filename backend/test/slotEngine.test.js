import test from "node:test";
import assert from "node:assert/strict";

import { computeSlotStartsForDay } from "../src/lib/slotEngine.js";

test("computeSlotStartsForDay returns only non-overlapping slots", () => {
  const duration = 60;
  const windows = [{ start_minute: 540, end_minute: 660 }]; // 09:00-11:00
  const existingBookings = [{ start_minute: 540, end_minute: 600 }]; // 09:00-10:00 booked

  const starts = computeSlotStartsForDay({ duration, windows, existingBookings, step: 15 });
  assert.deepEqual(starts, [600]); // Only 10:00-11:00 remains
});

test("computeSlotStartsForDay returns a single slot when window equals duration", () => {
  const duration = 60;
  const windows = [{ start_minute: 540, end_minute: 600 }]; // 09:00-10:00
  const existingBookings = [];

  const starts = computeSlotStartsForDay({ duration, windows, existingBookings, step: 15 });
  assert.deepEqual(starts, [540]);
});

