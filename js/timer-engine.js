// Pure Pomodoro timer engine.
//
// Every function takes the current time (`now`, ms since epoch) as an argument and
// never relies on an interval to count. The remaining time is always derived from
// the stored end timestamp, so switching tabs, minimising the browser or locking a
// phone cannot make the timer drift. When the page wakes up, `advance()` replays any
// sessions that finished while it was asleep, using their real end timestamps.

import { uuid, dayKey } from './util.js';

export const MODES = ['focus', 'short', 'long'];
export const MIN_RECORD_MS = 60 * 1000; // partial focus shorter than a minute is not recorded
const MAX_CATCHUP = 12; // safety limit when replaying sessions after a long sleep

export function durationFor(mode, settings) {
  const min = mode === 'focus' ? settings.focusMin : mode === 'short' ? settings.shortMin : settings.longMin;
  return Math.round(Number(min) * 60 * 1000);
}

export function createTimer(settings) {
  const durationMs = durationFor('focus', settings);
  return {
    mode: 'focus',
    status: 'idle', // idle | running | paused
    durationMs,
    remainingMs: durationMs, // authoritative while idle / paused
    endsAt: null, // authoritative while running
    startedAt: null, // when this session was first started
    cycleCount: 0, // focus sessions completed since the last long break
    taskId: null,
    label: '',
  };
}

export function remaining(t, now) {
  if (t.status === 'running') return Math.max(0, t.endsAt - now);
  return t.remainingMs;
}

export function elapsed(t, now) {
  return Math.max(0, t.durationMs - remaining(t, now));
}

export function start(t, now) {
  if (t.status === 'running') return t;
  const rem = t.remainingMs > 0 ? t.remainingMs : t.durationMs;
  return { ...t, status: 'running', endsAt: now + rem, startedAt: t.startedAt ?? now };
}

export function pause(t, now) {
  if (t.status !== 'running') return t;
  return { ...t, status: 'paused', remainingMs: Math.max(0, t.endsAt - now), endsAt: null };
}

function nextModeAfter(t, settings, completedFocus) {
  if (t.mode === 'focus') {
    const cycle = completedFocus ? t.cycleCount + 1 : t.cycleCount;
    const long = completedFocus && cycle >= settings.longEvery;
    return { mode: long ? 'long' : 'short', cycleCount: cycle };
  }
  // after any break → focus; a long break closes the cycle
  return { mode: 'focus', cycleCount: t.mode === 'long' ? 0 : t.cycleCount };
}

function makeRecord(t, { endedAt, actualMs, completed, tasks }) {
  const task = t.taskId && tasks ? tasks[t.taskId] : null;
  const startedAt = t.startedAt ?? endedAt - actualMs;
  return {
    id: uuid(),
    mode: t.mode,
    task_id: t.mode === 'focus' ? t.taskId || null : null,
    label: t.mode === 'focus' ? t.label || '' : '',
    subject: t.mode === 'focus' ? (task && task.subject) || '' : '',
    started_at: new Date(startedAt).toISOString(),
    ended_at: new Date(endedAt).toISOString(),
    planned_seconds: Math.round(t.durationMs / 1000),
    actual_seconds: Math.round(actualMs / 1000),
    completed,
    local_date: dayKey(startedAt),
  };
}

function enterMode(t, mode, cycleCount, settings, { run, at }) {
  const durationMs = durationFor(mode, settings);
  const base = { ...t, mode, cycleCount, durationMs, remainingMs: durationMs };
  if (run) return { ...base, status: 'running', startedAt: at, endsAt: at + durationMs };
  return { ...base, status: 'idle', startedAt: null, endsAt: null };
}

/**
 * Process every session that has finished by `now`.
 * Returns { timer, records, events } where events are {type:'complete', mode, next, at}.
 */
export function advance(t, settings, now, tasks) {
  const records = [];
  const events = [];
  let cur = t;
  let guard = 0;
  while (cur.status === 'running' && cur.endsAt <= now && guard++ < MAX_CATCHUP) {
    const endedAt = cur.endsAt;
    records.push(makeRecord(cur, { endedAt, actualMs: cur.durationMs, completed: true, tasks }));
    const { mode, cycleCount } = nextModeAfter(cur, settings, true);
    const auto = mode === 'focus' ? settings.autoFocus : settings.autoBreaks;
    events.push({ type: 'complete', mode: cur.mode, next: mode, at: endedAt, autoStarted: !!auto });
    cur = enterMode(cur, mode, cycleCount, settings, { run: !!auto, at: endedAt });
  }
  if (cur.status === 'running' && cur.endsAt <= now) {
    // hit the safety limit (device asleep for many hours) – park the timer
    cur = enterMode(cur, 'focus', 0, settings, { run: false });
  }
  return { timer: cur, records, events };
}

function partialRecord(t, now, tasks) {
  if (t.mode !== 'focus' || t.status === 'idle') return null;
  const ms = elapsed(t, now);
  if (ms < MIN_RECORD_MS) return null;
  return makeRecord(t, { endedAt: now, actualMs: ms, completed: false, tasks });
}

/** Skip to the next session. Partial focus time is kept as an (uncompleted) record. */
export function skip(t, settings, now, tasks) {
  const record = partialRecord(t, now, tasks);
  const wasRunning = t.status === 'running';
  const { mode, cycleCount } = nextModeAfter(t, settings, false);
  const timer = enterMode(t, mode, cycleCount, settings, { run: wasRunning, at: now });
  return { timer, records: record ? [record] : [] };
}

/** Reset the current session back to its full length. */
export function reset(t, settings, now, tasks) {
  const record = partialRecord(t, now, tasks);
  const timer = enterMode(t, t.mode, t.cycleCount, settings, { run: false });
  return { timer, records: record ? [record] : [] };
}

/** Manually switch mode (focus / short / long). */
export function switchMode(t, mode, settings, now, tasks) {
  if (!MODES.includes(mode)) throw new Error('unknown mode ' + mode);
  const record = partialRecord(t, now, tasks);
  const cycle = mode === 'focus' && t.mode === 'long' ? 0 : t.cycleCount;
  const timer = enterMode(t, mode, cycle, settings, { run: false });
  return { timer, records: record ? [record] : [] };
}

/** Settings changed: an idle timer picks up the new length immediately. */
export function applySettings(t, settings) {
  if (t.status !== 'idle') return t;
  const durationMs = durationFor(t.mode, settings);
  return { ...t, durationMs, remainingMs: durationMs };
}

export function setTask(t, taskId, label = '') {
  return { ...t, taskId: taskId || null, label: taskId ? '' : label };
}
