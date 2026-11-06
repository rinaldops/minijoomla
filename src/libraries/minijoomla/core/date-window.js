/* Shared scheduling semantics: start inclusive, end exclusive. Empty bounds
 * are open; invalid dates or an empty/reversed interval never become active.
 * Keep the adapters' existing Date interpretation (including offsets and ms).
 */
function timestamp(value) {
  try { return new Date(value).getTime(); } catch { return NaN; }
}

export function dateWindowStatus(up, down, now = new Date()) {
  const current = timestamp(now);
  const start = up == null || up === '' ? -Infinity : timestamp(up);
  const end = down == null || down === '' ? Infinity : timestamp(down);
  if (!Number.isFinite(current) || !(Number.isFinite(start) || start === -Infinity)
    || !(Number.isFinite(end) || end === Infinity) || start >= end) return 'invalid';
  if (current < start) return 'scheduled';
  if (current >= end) return 'expired';
  return 'active';
}

export function inDateWindow(up, down, now = new Date()) {
  return dateWindowStatus(up, down, now) === 'active';
}
