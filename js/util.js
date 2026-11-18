// Small shared helpers: ids, dates, formatting, HTML escaping.

export function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  // RFC4122 v4 fallback
  const b = new Uint8Array(16);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day key, e.g. "2026-11-18", for a timestamp (ms) or Date. */
export function dayKey(t = Date.now()) {
  const d = t instanceof Date ? t : new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight Date for a day key. */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a, b) {
  // whole days from a to b (b - a), DST-safe via UTC dates
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Monday-based weekday index: Mon=0 … Sun=6 */
export function weekdayMon(key) {
  return (keyToDate(key).getDay() + 6) % 7;
}

export function startOfWeek(key) {
  return addDays(key, -weekdayMon(key));
}

export function monthKey(key) {
  return key.slice(0, 7);
}

/** "1h 25m", "25m", "40s" (seconds only when under a minute and > 0). */
export function fmtDuration(sec, { short = false } = {}) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h && m) return short ? `${h}h${pad(m)}` : `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return sec > 0 ? `${sec}s` : '0m';
}

export function fmtHours(sec) {
  const h = sec / 3600;
  return h >= 10 ? h.toFixed(0) : h.toFixed(1);
}

/** mm:ss for the timer face (ceil so it never shows 00:00 while running). */
export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad(m)}:${pad(s)}`;
}

export function fmtTime(t) {
  return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function fmtLongDate(key) {
  return keyToDate(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtShortDate(key) {
  return keyToDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/** Stable pick from a list based on a string (e.g. today's date) */
export function pickDaily(list, seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
