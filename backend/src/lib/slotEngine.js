export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd <= bStart || aStart >= bEnd);
}

/**
 * @param {object} opts
 * @param {number} opts.duration
 * @param {{ start_minute: number, end_minute: number }[]} opts.windows
 * @param {{ start_minute: number, end_minute: number }[]} opts.existingBookings
 * @param {number} [opts.step=15]
 * @returns {number[]} start minutes
 */
export function computeSlotStartsForDay({ duration, windows, existingBookings, step = 15 }) {
  if (!windows?.length) return [];

  const slotsSet = new Set();

  for (const w of windows) {
    const windowStart = w.start_minute;
    const windowEnd = w.end_minute;
    const maxStart = windowEnd - duration;
    if (maxStart < windowStart) continue;

    const first = windowStart + ((step - (windowStart % step)) % step);

    for (let start = first; start <= maxStart; start += step) {
      const end = start + duration;
      let overlaps = false;
      for (const b of existingBookings) {
        if (intervalsOverlap(start, end, b.start_minute, b.end_minute)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) slotsSet.add(start);
    }
  }

  return Array.from(slotsSet).sort((a, b) => a - b);
}
