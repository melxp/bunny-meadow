// Statistics, computed only from recorded sessions.
// Study time = focus sessions only (never breaks). By default only completed focus
// sessions count; the "count partial focus" setting also counts focus time that was
// actually spent before a session was skipped or reset.

import { addDays, daysBetween, weekdayMon, startOfWeek, monthKey, dayKey } from './util.js';

export function studySeconds(s, countPartial = false) {
  if (s.deleted || s.mode !== 'focus') return 0;
  if (!s.completed && !countPartial) return 0;
  return Math.max(0, s.actual_seconds || 0);
}

export function isPomodoro(s) {
  return !s.deleted && s.mode === 'focus' && s.completed;
}

export function isBreak(s) {
  return !s.deleted && (s.mode === 'short' || s.mode === 'long') && s.completed;
}

/** Map dayKey → { seconds, pomodoros, breaks, subjects: {name: sec}, sessions: [] } */
export function byDay(sessions, { countPartial = false } = {}) {
  const map = new Map();
  for (const s of sessions) {
    if (s.deleted) continue;
    const key = s.local_date || dayKey(new Date(s.started_at));
    let d = map.get(key);
    if (!d) map.set(key, (d = { seconds: 0, pomodoros: 0, breaks: 0, subjects: {}, sessions: [] }));
    const sec = studySeconds(s, countPartial);
    d.seconds += sec;
    if (isPomodoro(s)) d.pomodoros++;
    if (isBreak(s)) d.breaks++;
    if (sec > 0) {
      const subj = s.subject || 'No subject';
      d.subjects[subj] = (d.subjects[subj] || 0) + sec;
    }
    d.sessions.push(s);
  }
  for (const d of map.values()) d.sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return map;
}

export function emptyDay() {
  return { seconds: 0, pomodoros: 0, breaks: 0, subjects: {}, sessions: [] };
}

export function tasksCompletedOn(tasks, key) {
  return tasks.filter((t) => !t.deleted && t.completed && t.completed_at && dayKey(new Date(t.completed_at)) === key);
}

export function rangeTotal(days, fromKey, toKey) {
  let sec = 0;
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) sec += days.get(k)?.seconds || 0;
  return sec;
}

/** 7 entries Mon–Sun for the week containing `key`. */
export function weekSeries(days, key) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => {
    const k = addDays(start, i);
    return { key: k, seconds: days.get(k)?.seconds || 0 };
  });
}

/** Last `n` weeks (oldest first), each {start, seconds}. */
export function weeklyTotals(days, todayKey, n = 8) {
  const thisWeek = startOfWeek(todayKey);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    out.push({ start, seconds: rangeTotal(days, start, addDays(start, 6)) });
  }
  return out;
}

/** Last `n` months (oldest first), each {month:'YYYY-MM', seconds, activeDays}. */
export function monthlyTotals(days, todayKey, n = 6) {
  const [y, m] = todayKey.split('-').map(Number);
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const totals = Object.fromEntries(months.map((mo) => [mo, { month: mo, seconds: 0, activeDays: 0 }]));
  for (const [k, d] of days) {
    const mo = monthKey(k);
    if (totals[mo] && d.seconds > 0) {
      totals[mo].seconds += d.seconds;
      totals[mo].activeDays++;
    }
  }
  return months.map((mo) => totals[mo]);
}

/** Days in a month as [{key, seconds}] */
export function monthDays(days, month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const k = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { key: k, seconds: days.get(k)?.seconds || 0 };
  });
}

function activeKeys(days) {
  return [...days.entries()].filter(([, d]) => d.seconds > 0).map(([k]) => k).sort();
}

/**
 * Streaks count consecutive days with any recorded study time.
 * The current streak stays alive through today until midnight (if you studied yesterday).
 */
export function streaks(days, todayKey) {
  const keys = activeKeys(days).filter((k) => k <= todayKey);
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  let current = 0;
  const has = (k) => (days.get(k)?.seconds || 0) > 0;
  let k = has(todayKey) ? todayKey : addDays(todayKey, -1);
  while (has(k)) {
    current++;
    k = addDays(k, -1);
  }
  return { current, longest, studiedToday: has(todayKey) };
}

/** Average study time per day since the first recorded study day (zero days included). */
export function dailyAverage(days, todayKey) {
  const keys = activeKeys(days).filter((k) => k <= todayKey);
  if (!keys.length) return { perDay: 0, perStudyDay: 0, span: 0, activeDays: 0 };
  const total = keys.reduce((a, k) => a + days.get(k).seconds, 0);
  const span = daysBetween(keys[0], todayKey) + 1;
  return { perDay: total / span, perStudyDay: total / keys.length, span, activeDays: keys.length, total };
}

/** Weekday with the most study time on average (Mon=0). */
export function weekdayProfile(days) {
  const totals = Array(7).fill(0);
  for (const [k, d] of days) totals[weekdayMon(k)] += d.seconds;
  const max = Math.max(...totals);
  return { totals, best: max > 0 ? totals.indexOf(max) : -1 };
}

/** Subject → seconds within [from, to] (inclusive keys), sorted desc. */
export function subjectBreakdown(days, fromKey, toKey) {
  const agg = {};
  for (const [k, d] of days) {
    if ((fromKey && k < fromKey) || (toKey && k > toKey)) continue;
    for (const [s, sec] of Object.entries(d.subjects)) agg[s] = (agg[s] || 0) + sec;
  }
  return Object.entries(agg)
    .map(([subject, seconds]) => ({ subject, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

/** Per-task pomodoro count and focus time. */
export function perTask(sessions, { countPartial = false } = {}) {
  const map = {};
  for (const s of sessions) {
    if (s.deleted || s.mode !== 'focus' || !s.task_id) continue;
    const m = (map[s.task_id] ||= { pomodoros: 0, seconds: 0 });
    if (s.completed) m.pomodoros++;
    m.seconds += studySeconds(s, countPartial);
  }
  return map;
}

/** Heatmap intensity 0–4 relative to the daily goal. */
export function heatLevel(seconds, goalMin) {
  if (!seconds) return 0;
  const goal = Math.max(1, goalMin) * 60;
  const r = seconds / goal;
  if (r < 0.25) return 1;
  if (r < 0.6) return 2;
  if (r < 1) return 3;
  return 4;
}
